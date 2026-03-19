/**
 * 专业级事件驱动回测引擎
 * 
 * 核心功能：
 * - 遍历历史数据，在突破信号触发时执行开仓
 * - 触发止盈/止损/超时时执行平仓
 * - 全程计算交易成本（佣金、印花税、滑点）
 */

import type { KLineData, ConvergingTriangleResult } from '../types'
import type {
  BacktestParams,
  BacktestResult,
  BacktestInput,
  Trade,
  Position,
  TradeDirection,
  ExitReason,
  EquityPoint,
  DEFAULT_BACKTEST_PARAMS,
} from './types'
import { DEFAULT_BACKTEST_PARAMS as DEFAULT_PARAMS } from './types'
import { calcPerformanceMetrics } from './metrics'

/**
 * 创建空持仓状态
 */
function createEmptyPosition(): Position {
  return {
    isOpen: false,
    direction: 'long',
    entryPrice: 0,
    entryDate: 0,
    entryIndex: 0,
    quantity: 0,
    patternHeight: 0,
    takeProfitPrice: 0,
    stopLossPrice: 0,
    holdingDays: 0,
    relatedPattern: null as any,
  }
}

/**
 * 计算实际成交价格（含滑点）
 * 
 * 做多：买入时滑点增加成本，卖出时滑点减少收入
 * 做空：卖出时滑点增加收入，买入时滑点减少成本（融券）
 */
function calcExecutionPrice(
  price: number,
  direction: TradeDirection,
  isEntry: boolean,
  slippageRate: number
): number {
  const slippage = price * slippageRate
  
  if (direction === 'long') {
    // 做多
    if (isEntry) {
      // 买入：滑点使成本增加
      return price + slippage
    } else {
      // 卖出：滑点使收入减少
      return price - slippage
    }
  } else {
    // 做空
    if (isEntry) {
      // 融券卖出：滑点使收入减少
      return price - slippage
    } else {
      // 买券还券：滑点使成本增加
      return price + slippage
    }
  }
}

/**
 * 计算交易成本
 */
function calcTransactionCost(
  price: number,
  quantity: number,
  isSell: boolean,
  commissionRate: number,
  stampDutyRate: number
): { commission: number; stampDuty: number; total: number } {
  const amount = price * quantity
  
  // 佣金（双向收取，最低 5 元）
  const commission = Math.max(amount * commissionRate, 5)
  
  // 印花税（仅卖出收取）
  const stampDuty = isSell ? amount * stampDutyRate : 0
  
  return {
    commission,
    stampDuty,
    total: commission + stampDuty,
  }
}

/**
 * 计算止盈止损价格
 */
function calcStopPrices(
  entryPrice: number,
  direction: TradeDirection,
  takeProfitRatio: number,
  stopLossRatio: number
): { takeProfitPrice: number; stopLossPrice: number } {
  if (direction === 'long') {
    return {
      takeProfitPrice: entryPrice * (1 + takeProfitRatio),
      stopLossPrice: entryPrice * (1 - stopLossRatio),
    }
  } else {
    // 做空时止盈止损方向相反
    return {
      takeProfitPrice: entryPrice * (1 - takeProfitRatio),
      stopLossPrice: entryPrice * (1 + stopLossRatio),
    }
  }
}

/**
 * 检查平仓条件
 */
function checkExitConditions(
  currentHigh: number,
  currentLow: number,
  position: Position,
  maxHoldingDays: number
): { shouldExit: boolean; reason: ExitReason | null; exitPrice: number | null } {
  if (!position.isOpen) {
    return { shouldExit: false, reason: null, exitPrice: null }
  }
  
  // 检查止盈
  if (position.direction === 'long') {
    // 做多止盈
    if (currentHigh >= position.takeProfitPrice) {
      return { shouldExit: true, reason: 'take_profit', exitPrice: position.takeProfitPrice }
    }
    // 做多止损
    if (currentLow <= position.stopLossPrice) {
      return { shouldExit: true, reason: 'stop_loss', exitPrice: position.stopLossPrice }
    }
  } else {
    // 做空止盈（价格下跌触发）
    if (currentLow <= position.takeProfitPrice) {
      return { shouldExit: true, reason: 'take_profit', exitPrice: position.takeProfitPrice }
    }
    // 做空止损（价格上涨触发）
    if (currentHigh >= position.stopLossPrice) {
      return { shouldExit: true, reason: 'stop_loss', exitPrice: position.stopLossPrice }
    }
  }
  
  // 检查超时
  if (position.holdingDays >= maxHoldingDays) {
    return { shouldExit: true, reason: 'timeout', exitPrice: null }
  }
  
  return { shouldExit: false, reason: null, exitPrice: null }
}

/**
 * 执行开仓
 */
function executeEntry(
  pattern: ConvergingTriangleResult,
  klineData: KLineData,
  index: number,
  cash: number,
  params: BacktestParams,
  tradeId: number
): { position: Position; trade: Trade | null } {
  const { close, high, low } = klineData
  
  // 确定交易方向
  const direction: TradeDirection = pattern.breakoutDir === 'up' ? 'long' : 'short'
  
  // 不允许做空时跳过向下突破
  if (direction === 'short' && !params.allowShort) {
    return { position: createEmptyPosition(), trade: null }
  }
  
  // 获取入场价格（使用突破日收盘价）
  const rawEntryPrice = close[index]
  if (rawEntryPrice === null || rawEntryPrice === undefined) {
    return { position: createEmptyPosition(), trade: null }
  }
  
  // 计算含滑点的入场价格
  const entryPrice = calcExecutionPrice(rawEntryPrice, direction, true, params.slippageRate)
  
  // 计算可买入数量（按仓位比例）
  const availableCash = cash * params.positionSize
  const quantity = Math.floor(availableCash / entryPrice / 100) * 100 // 向下取整到100股
  
  if (quantity <= 0) {
    return { position: createEmptyPosition(), trade: null }
  }
  
  // 计算入场成本
  const entryCost = calcTransactionCost(entryPrice, quantity, false, params.commissionRate, 0)
  const entrySlippage = Math.abs(rawEntryPrice - entryPrice) * quantity
  
  // 计算止盈止损价格
  const { takeProfitPrice, stopLossPrice } = calcStopPrices(
    entryPrice, direction, params.takeProfitRatio, params.stopLossRatio
  )
  
  // 创建持仓
  const position: Position = {
    isOpen: true,
    direction,
    entryPrice,
    entryDate: klineData.dates[index],
    entryIndex: index,
    quantity,
    patternHeight: pattern.patternHeight,
    takeProfitPrice,
    stopLossPrice,
    holdingDays: 0,
    relatedPattern: pattern,
  }
  
  return { position, trade: null }
}

/**
 * 执行平仓
 */
function executeExit(
  position: Position,
  klineData: KLineData,
  index: number,
  reason: ExitReason,
  exitPrice: number | null,
  params: BacktestParams,
  tradeId: number
): { trade: Trade; cash: number } {
  const { close, high, low } = klineData
  
  // 确定出场价格
  let rawExitPrice: number
  if (exitPrice !== null) {
    rawExitPrice = exitPrice
  } else {
    // 超时平仓使用收盘价
    const closePrice = close[index]
    rawExitPrice = closePrice !== null ? closePrice : position.entryPrice
  }
  
  // 计算含滑点的出场价格
  const finalExitPrice = calcExecutionPrice(rawExitPrice, position.direction, false, params.slippageRate)
  
  // 计算出场成本
  const exitCost = calcTransactionCost(finalExitPrice, position.quantity, true, params.commissionRate, params.stampDutyRate)
  const exitSlippage = Math.abs(rawExitPrice - finalExitPrice) * position.quantity
  
  // 计算盈亏
  let grossPnL: number
  if (position.direction === 'long') {
    // 做多：(卖出价 - 买入价) * 数量
    grossPnL = (finalExitPrice - position.entryPrice) * position.quantity
  } else {
    // 做空：(卖出价 - 买回价) * 数量
    grossPnL = (position.entryPrice - finalExitPrice) * position.quantity
  }
  
  const totalCost = exitCost.total
  const entrySlippage = Math.abs(position.entryPrice - position.entryPrice / (1 + params.slippageRate)) * position.quantity
  const netPnL = grossPnL - totalCost - entrySlippage - exitSlippage
  
  // 计算收益率
  const investedCapital = position.entryPrice * position.quantity
  const returnRate = netPnL / investedCapital
  
  // 计算回收资金
  const cashReturned = finalExitPrice * position.quantity - exitCost.total
  
  const trade: Trade = {
    tradeId,
    entryDate: position.entryDate,
    entryIndex: position.entryIndex,
    entryPrice: position.entryPrice,
    direction: position.direction,
    quantity: position.quantity,
    exitDate: klineData.dates[index],
    exitIndex: index,
    exitPrice: finalExitPrice,
    exitReason: reason,
    entryCommission: calcTransactionCost(position.entryPrice, position.quantity, false, params.commissionRate, 0).commission,
    exitCommission: exitCost.commission,
    stampDuty: exitCost.stampDuty,
    entrySlippage,
    exitSlippage,
    totalCost: totalCost + entrySlippage + exitSlippage,
    grossPnL,
    netPnL,
    returnRate,
    holdingDays: position.holdingDays,
    pattern: position.relatedPattern,
    breakoutDate: position.relatedPattern.breakoutDate!,
    breakoutDir: position.relatedPattern.breakoutDir,
  }
  
  return { trade, cash: cashReturned }
}

/**
 * 主回测函数
 */
export function runBacktest(
  klineData: KLineData,
  patterns: ConvergingTriangleResult[],
  params: Partial<BacktestParams> = {}
): BacktestResult {
  // 合并参数
  const p: BacktestParams = { ...DEFAULT_PARAMS, ...params }
  
  const { dates, open, high, low, close, volume } = klineData
  const n = close.length
  
  // 初始化状态
  let cash = p.initialCapital
  let position = createEmptyPosition()
  let tradeId = 0
  
  const trades: Trade[] = []
  const equityCurve: EquityPoint[] = []
  
  // 过滤有效的突破形态（按突破日排序）
  // 只计算已确认的突破，忽略待确认的突破
  const validPatterns = patterns
    .filter(pattern => 
      pattern.isValid && 
      pattern.breakoutDay !== null && 
      pattern.breakoutDir !== 'none' &&
      pattern.breakoutConfirmed === true  // 只计算已确认的突破
    )
    .sort((a, b) => (a.breakoutDay ?? 0) - (b.breakoutDay ?? 0))
  
  // 创建突破日索引映射
  const breakoutDays = new Map<number, ConvergingTriangleResult>()
  for (const pattern of validPatterns) {
    if (pattern.breakoutDay !== null) {
      breakoutDays.set(pattern.breakoutDay, pattern)
    }
  }
  
  console.log('[Backtest] 开始回测', {
    totalDays: n,
    validPatterns: validPatterns.length,
    params: p,
  })
  
  // 遍历每一天
  for (let i = 0; i < n; i++) {
    const currentDate = dates[i]
    const currentHigh = high[i]
    const currentLow = low[i]
    const currentClose = close[i]
    
    if (currentHigh === null || currentLow === null || currentClose === null) continue
    
    // === 检查平仓条件 ===
    if (position.isOpen) {
      position.holdingDays++
      
      const exitCheck = checkExitConditions(
        currentHigh, currentLow, position, p.maxHoldingDays
      )
      
      if (exitCheck.shouldExit && exitCheck.reason) {
        const { trade, cash: returnedCash } = executeExit(
          position, klineData, i, exitCheck.reason, exitCheck.exitPrice, p, tradeId
        )
        
        trades.push(trade)
        tradeId++
        cash += returnedCash
        position = createEmptyPosition()
        
        console.log(`[Backtest] 平仓 #${trade.tradeId}`, {
          date: currentDate,
          reason: exitCheck.reason,
          returnRate: (trade.returnRate * 100).toFixed(2) + '%',
          holdingDays: trade.holdingDays,
        })
      }
    }
    
    // === 检查开仓信号 ===
    if (!position.isOpen && breakoutDays.has(i)) {
      const pattern = breakoutDays.get(i)!
      
      const { position: newPosition } = executeEntry(
        pattern, klineData, i, cash, p, tradeId
      )
      
      if (newPosition.isOpen) {
        position = newPosition
        cash -= position.entryPrice * position.quantity
        
        console.log(`[Backtest] 开仓 #${tradeId}`, {
          date: currentDate,
          direction: position.direction,
          price: position.entryPrice.toFixed(2),
          quantity: position.quantity,
          takeProfit: position.takeProfitPrice.toFixed(2),
          stopLoss: position.stopLossPrice.toFixed(2),
        })
      }
    }
    
    // === 记录资金曲线 ===
    let positionValue = 0
    if (position.isOpen) {
      positionValue = position.quantity * currentClose
    }
    
    const equity = cash + positionValue
    const maxEquitySoFar = equityCurve.length > 0 
      ? Math.max(...equityCurve.map(e => e.equity)) 
      : equity
    const drawdown = maxEquitySoFar - equity
    const drawdownPct = maxEquitySoFar > 0 ? drawdown / maxEquitySoFar : 0
    
    equityCurve.push({
      date: currentDate,
      index: i,
      equity,
      cash,
      positionValue,
      drawdown,
      drawdownPct,
    })
  }
  
  // 强制平仓最后的持仓
  if (position.isOpen) {
    const lastIndex = n - 1
    const { trade, cash: returnedCash } = executeExit(
      position, klineData, lastIndex, 'timeout', null, p, tradeId
    )
    
    trades.push(trade)
    tradeId++
    cash += returnedCash
    position = createEmptyPosition()
    
    console.log(`[Backtest] 强制平仓 #${trade.tradeId}`, {
      returnRate: (trade.returnRate * 100).toFixed(2) + '%',
    })
  }
  
  // 计算绩效指标
  const metrics = calcPerformanceMetrics(
    trades, 
    equityCurve, 
    p.initialCapital,
    dates.length
  )
  
  const result: BacktestResult = {
    params: p,
    startDate: dates[0],
    endDate: dates[n - 1],
    totalDays: n,
    trades,
    equityCurve,
    metrics,
    initialCapital: p.initialCapital,
    finalEquity: equityCurve[equityCurve.length - 1]?.equity ?? p.initialCapital,
    totalReturn: metrics.totalReturn,
  }
  
  console.log('[Backtest] 回测完成', {
    totalTrades: trades.length,
    winRate: (metrics.winRate * 100).toFixed(1) + '%',
    totalReturn: (metrics.totalReturn * 100).toFixed(2) + '%',
    maxDrawdown: (metrics.maxDrawdownPct * 100).toFixed(2) + '%',
    sharpeRatio: metrics.sharpeRatio.toFixed(2),
  })
  
  return result
}