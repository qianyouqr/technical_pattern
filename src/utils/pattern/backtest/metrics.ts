/**
 * 专业级绩效指标计算模块
 * 
 * 包含：
 * - 基础指标：胜率、盈亏比、总收益率、单次平均收益
 * - 风险指标：最大回撤、夏普比率、最大连续亏损次数
 * - 多空统计：多空胜率、多空平均收益
 * - 成本统计：总佣金、印花税、滑点成本
 */

import type { Trade, EquityPoint, PerformanceMetrics } from './types'

/**
 * 计算胜率
 */
export function calcWinRate(trades: Trade[]): number {
  if (trades.length === 0) return 0
  
  const wins = trades.filter(t => t.netPnL > 0).length
  return wins / trades.length
}

/**
 * 计算盈亏比（平均盈利 / 平均亏损）
 */
export function calcProfitLossRatio(trades: Trade[]): number {
  const wins = trades.filter(t => t.netPnL > 0)
  const losses = trades.filter(t => t.netPnL < 0)
  
  if (losses.length === 0) return wins.length > 0 ? Infinity : 0
  
  const avgWin = wins.length > 0 
    ? wins.reduce((sum, t) => sum + t.netPnL, 0) / wins.length 
    : 0
  const avgLoss = Math.abs(losses.reduce((sum, t) => sum + t.netPnL, 0) / losses.length)
  
  return avgLoss > 0 ? avgWin / avgLoss : 0
}

/**
 * 计算盈利因子（总盈利 / 总亏损）
 */
export function calcProfitFactor(trades: Trade[]): number {
  const wins = trades.filter(t => t.netPnL > 0)
  const losses = trades.filter(t => t.netPnL < 0)
  
  const totalWin = wins.reduce((sum, t) => sum + t.netPnL, 0)
  const totalLoss = Math.abs(losses.reduce((sum, t) => sum + t.netPnL, 0))
  
  return totalLoss > 0 ? totalWin / totalLoss : (totalWin > 0 ? Infinity : 0)
}

/**
 * 计算最大回撤
 */
export function calcMaxDrawdown(equityCurve: EquityPoint[]): { maxDrawdown: number; maxDrawdownPct: number } {
  if (equityCurve.length === 0) return { maxDrawdown: 0, maxDrawdownPct: 0 }
  
  let maxEquity = 0
  let maxDrawdown = 0
  let maxDrawdownPct = 0
  
  for (const point of equityCurve) {
    if (point.equity > maxEquity) {
      maxEquity = point.equity
    }
    
    const drawdown = maxEquity - point.equity
    const drawdownPct = maxEquity > 0 ? drawdown / maxEquity : 0
    
    if (drawdown > maxDrawdown) {
      maxDrawdown = drawdown
      maxDrawdownPct = drawdownPct
    }
  }
  
  return { maxDrawdown, maxDrawdownPct }
}

/**
 * 计算夏普比率（年化）
 * 
 * 公式：(年化收益率 - 无风险利率) / 年化波动率
 * 默认无风险利率 = 3%（年化）
 */
export function calcSharpeRatio(
  equityCurve: EquityPoint[],
  _tradingDays: number,
  riskFreeRate: number = 0.03
): number {
  if (equityCurve.length < 2) return 0
  
  // 计算每日收益率
  const dailyReturns: number[] = []
  for (let i = 1; i < equityCurve.length; i++) {
    const prevEquity = equityCurve[i - 1].equity
    const currEquity = equityCurve[i].equity
    if (prevEquity > 0) {
      dailyReturns.push((currEquity - prevEquity) / prevEquity)
    }
  }
  
  if (dailyReturns.length === 0) return 0
  
  // 计算平均日收益率
  const avgDailyReturn = dailyReturns.reduce((sum, r) => sum + r, 0) / dailyReturns.length
  
  // 计算日收益率标准差
  const variance = dailyReturns.reduce((sum, r) => sum + Math.pow(r - avgDailyReturn, 2), 0) / dailyReturns.length
  const stdDailyReturn = Math.sqrt(variance)
  
  if (stdDailyReturn === 0) return 0
  
  // 年化
  const tradingDaysPerYear = 252
  const annualizedReturn = avgDailyReturn * tradingDaysPerYear
  const annualizedStd = stdDailyReturn * Math.sqrt(tradingDaysPerYear)
  
  // 夏普比率
  return (annualizedReturn - riskFreeRate) / annualizedStd
}

/**
 * 计算索提诺比率（年化）
 * 
 * 与夏普比率类似，但只考虑下行波动率
 */
export function calcSortinoRatio(
  equityCurve: EquityPoint[],
  _tradingDays: number,
  riskFreeRate: number = 0.03
): number {
  if (equityCurve.length < 2) return 0
  
  // 计算每日收益率
  const dailyReturns: number[] = []
  for (let i = 1; i < equityCurve.length; i++) {
    const prevEquity = equityCurve[i - 1].equity
    const currEquity = equityCurve[i].equity
    if (prevEquity > 0) {
      dailyReturns.push((currEquity - prevEquity) / prevEquity)
    }
  }
  
  if (dailyReturns.length === 0) return 0
  
  const avgDailyReturn = dailyReturns.reduce((sum, r) => sum + r, 0) / dailyReturns.length
  
  // 只计算负收益的标准差（下行波动率）
  const negativeReturns = dailyReturns.filter(r => r < 0)
  if (negativeReturns.length === 0) return Infinity
  
  const downVariance = negativeReturns.reduce((sum, r) => sum + Math.pow(r, 2), 0) / negativeReturns.length
  const downStd = Math.sqrt(downVariance)
  
  if (downStd === 0) return 0
  
  // 年化
  const tradingDaysPerYear = 252
  const annualizedReturn = avgDailyReturn * tradingDaysPerYear
  const annualizedDownStd = downStd * Math.sqrt(tradingDaysPerYear)
  
  return (annualizedReturn - riskFreeRate) / annualizedDownStd
}

/**
 * 计算卡玛比率（年化收益 / 最大回撤）
 */
export function calcCalmarRatio(
  totalReturn: number,
  maxDrawdownPct: number,
  tradingDays: number
): number {
  if (maxDrawdownPct === 0) return totalReturn > 0 ? Infinity : 0
  
  // 年化收益率
  const tradingDaysPerYear = 252
  const annualizedReturn = Math.pow(1 + totalReturn, tradingDaysPerYear / tradingDays) - 1
  
  return annualizedReturn / maxDrawdownPct
}

/**
 * 计算最大连续亏损次数
 */
export function calcMaxConsecutiveLosses(trades: Trade[]): number {
  let maxConsecutive = 0
  let currentConsecutive = 0
  
  for (const trade of trades) {
    if (trade.netPnL < 0) {
      currentConsecutive++
      maxConsecutive = Math.max(maxConsecutive, currentConsecutive)
    } else {
      currentConsecutive = 0
    }
  }
  
  return maxConsecutive
}

/**
 * 计算最大连续盈利次数
 */
export function calcMaxConsecutiveWins(trades: Trade[]): number {
  let maxConsecutive = 0
  let currentConsecutive = 0
  
  for (const trade of trades) {
    if (trade.netPnL > 0) {
      currentConsecutive++
      maxConsecutive = Math.max(maxConsecutive, currentConsecutive)
    } else {
      currentConsecutive = 0
    }
  }
  
  return maxConsecutive
}

/**
 * 计算完整绩效指标
 */
export function calcPerformanceMetrics(
  trades: Trade[],
  equityCurve: EquityPoint[],
  initialCapital: number,
  totalDays: number
): PerformanceMetrics {
  const winningTrades = trades.filter(t => t.netPnL > 0)
  const losingTrades = trades.filter(t => t.netPnL < 0)
  
  // 基础指标
  const totalTrades = trades.length
  const winRate = calcWinRate(trades)
  
  // 收益指标
  const finalEquity = equityCurve[equityCurve.length - 1]?.equity ?? initialCapital
  const totalReturnAmount = finalEquity - initialCapital
  const totalReturn = totalReturnAmount / initialCapital
  const avgReturn = totalTrades > 0
    ? trades.reduce((sum, t) => sum + t.returnRate, 0) / totalTrades 
    : 0
  const avgWinReturn = winningTrades.length > 0 
    ? winningTrades.reduce((sum, t) => sum + t.returnRate, 0) / winningTrades.length 
    : 0
  const avgLossReturn = losingTrades.length > 0 
    ? losingTrades.reduce((sum, t) => sum + t.returnRate, 0) / losingTrades.length 
    : 0
  
  // 盈亏比
  const profitLossRatio = calcProfitLossRatio(trades)
  const profitFactor = calcProfitFactor(trades)
  
  // 风险指标
  const { maxDrawdown, maxDrawdownPct } = calcMaxDrawdown(equityCurve)
  const maxConsecutiveLosses = calcMaxConsecutiveLosses(trades)
  const maxConsecutiveWins = calcMaxConsecutiveWins(trades)
  
  // 风险调整收益
  const sharpeRatio = calcSharpeRatio(equityCurve, totalDays)
  const sortinoRatio = calcSortinoRatio(equityCurve, totalDays)
  const calmarRatio = calcCalmarRatio(totalReturn, maxDrawdownPct, totalDays)
  
  // 持仓统计
  const holdingDays = trades.map(t => t.holdingDays)
  const avgHoldingDays = totalTrades > 0 
    ? holdingDays.reduce((sum, d) => sum + d, 0) / totalTrades 
    : 0
  const maxHoldingDays = holdingDays.length > 0 ? Math.max(...holdingDays) : 0
  const minHoldingDays = holdingDays.length > 0 ? Math.min(...holdingDays) : 0
  
  // 极值统计
  const pnls = trades.map(t => t.netPnL)
  const maxProfit = pnls.length > 0 ? Math.max(...pnls) : 0
  const maxLoss = pnls.length > 0 ? Math.min(...pnls) : 0
  const maxProfitTrade = pnls.length > 0 ? pnls.indexOf(maxProfit) + 1 : 0
  const maxLossTrade = pnls.length > 0 ? pnls.indexOf(maxLoss) + 1 : 0
  
  // 多空统计
  const longTrades = trades.filter(t => t.direction === 'long')
  const shortTrades = trades.filter(t => t.direction === 'short')
  const longWinRate = calcWinRate(longTrades)
  const shortWinRate = calcWinRate(shortTrades)
  const longAvgReturn = longTrades.length > 0 
    ? longTrades.reduce((sum, t) => sum + t.returnRate, 0) / longTrades.length 
    : 0
  const shortAvgReturn = shortTrades.length > 0 
    ? shortTrades.reduce((sum, t) => sum + t.returnRate, 0) / shortTrades.length 
    : 0
  
  // 成本统计
  const totalCommission = trades.reduce((sum, t) => sum + t.entryCommission + t.exitCommission, 0)
  const totalStampDuty = trades.reduce((sum, t) => sum + t.stampDuty, 0)
  const totalSlippage = trades.reduce((sum, t) => sum + t.entrySlippage + t.exitSlippage, 0)
  const totalTradingCost = trades.reduce((sum, t) => sum + t.totalCost, 0)
  const costPctOfReturn = totalReturnAmount !== 0 
    ? Math.abs(totalTradingCost / totalReturnAmount) 
    : 0
  
  return {
    totalTrades,
    winningTrades: winningTrades.length,
    losingTrades: losingTrades.length,
    winRate,
    totalReturn,
    totalReturnAmount,
    avgReturn,
    avgWinReturn,
    avgLossReturn,
    profitLossRatio,
    profitFactor,
    maxDrawdown,
    maxDrawdownPct,
    maxConsecutiveLosses,
    maxConsecutiveWins,
    sharpeRatio,
    sortinoRatio,
    calmarRatio,
    avgHoldingDays,
    maxHoldingDays,
    minHoldingDays,
    maxProfit,
    maxLoss,
    maxProfitTrade,
    maxLossTrade,
    longTrades: longTrades.length,
    shortTrades: shortTrades.length,
    longWinRate,
    shortWinRate,
    longAvgReturn,
    shortAvgReturn,
    totalCommission,
    totalStampDuty,
    totalSlippage,
    totalTradingCost,
    costPctOfReturn,
  }
}