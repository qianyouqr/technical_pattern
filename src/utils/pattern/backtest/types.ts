/**
 * 专业级事件驱动回测模块 - 类型定义
 * 
 * 支持功能：
 * - 多空双向交易（向上突破做多，向下突破做空）
 * - 固定比例止盈止损
 * - 交易成本计算（佣金、印花税、滑点）
 * - 完整绩效指标体系
 */

import type { ConvergingTriangleResult, KLineData } from '../types'

/**
 * 回测参数配置
 */
export interface BacktestParams {
  // === 止盈止损参数（固定比例） ===
  takeProfitRatio: number    // 止盈比例，默认 0.10 (10%)
  stopLossRatio: number      // 止损比例，默认 0.05 (5%)
  
  // === 交易成本 ===
  commissionRate: number     // 佣金费率，默认 0.0003 (万三)
  stampDutyRate: number      // 印花税率，默认 0.001 (千一，仅卖出时收取)
  slippageRate: number       // 滑点率，默认 0.001 (千一)
  
  // === 仓位管理 ===
  positionSize: number       // 每笔交易仓位比例，默认 1.0 (全仓)
  maxHoldingDays: number     // 最大持仓天数，默认 20 天
  
  // === 资金配置 ===
  initialCapital: number     // 初始资金，默认 100000 (10万)
  
  // === 策略配置 ===
  allowShort: boolean        // 是否允许做空，默认 true
}

/**
 * 默认回测参数
 */
export const DEFAULT_BACKTEST_PARAMS: BacktestParams = {
  takeProfitRatio: 0.10,
  stopLossRatio: 0.05,
  commissionRate: 0.0003,
  stampDutyRate: 0.001,
  slippageRate: 0.001,
  positionSize: 1.0,
  maxHoldingDays: 20,
  initialCapital: 100000,
  allowShort: true,
}

/**
 * 交易方向
 */
export type TradeDirection = 'long' | 'short'

/**
 * 平仓原因
 */
export type ExitReason = 'take_profit' | 'stop_loss' | 'timeout' | 'signal_reverse'

/**
 * 持仓状态
 */
export interface Position {
  isOpen: boolean                    // 是否持仓
  direction: TradeDirection          // 方向
  entryPrice: number                 // 入场价格
  entryDate: number                  // 入场日期
  entryIndex: number                 // 入场索引
  quantity: number                   // 持仓数量（股数）
  patternHeight: number              // 形态高度（用于计算止盈止损）
  takeProfitPrice: number            // 止盈价格
  stopLossPrice: number              // 止损价格
  holdingDays: number                // 持仓天数
  entryCommission: number            // 入场佣金
  entryStampDuty: number             // 入场印花税
  entrySlippage: number              // 入场滑点成本
  relatedPattern: ConvergingTriangleResult  // 关联的形态
}

/**
 * 单笔交易记录
 */
export interface Trade {
  // 交易标识
  tradeId: number                    // 交易序号
  
  // 入场信息
  entryDate: number                  // 入场日期
  entryIndex: number                 // 入场索引
  entryPrice: number                 // 入场价格（含滑点）
  direction: TradeDirection          // 方向
  quantity: number                   // 交易数量（股数）
  
  // 出场信息
  exitDate: number | null            // 出场日期
  exitIndex: number | null           // 出场索引
  exitPrice: number | null           // 出场价格（含滑点）
  exitReason: ExitReason | null      // 平仓原因
  
  // 成本明细
  entryCommission: number            // 入场佣金
  exitCommission: number             // 出场佣金
  stampDuty: number                  // 印花税（仅卖出）
  entrySlippage: number              // 入场滑点成本
  exitSlippage: number               // 出场滑点成本
  totalCost: number                  // 总交易成本
  
  // 盈亏
  grossPnL: number                   // 毛盈亏（不含成本）
  netPnL: number                     // 净盈亏（扣除成本）
  returnRate: number                 // 收益率
  
  // 持仓信息
  holdingDays: number                // 持仓天数
  
  // 关联形态
  pattern: ConvergingTriangleResult  // 关联的形态
  breakoutDate: number               // 突破日
  breakoutDir: 'up' | 'down'         // 突破方向
}

/**
 * 资金曲线点
 */
export interface EquityPoint {
  date: number                       // 日期
  index: number                      // 索引
  equity: number                     // 资金总额
  cash: number                       // 现金
  positionValue: number              // 持仓市值
  drawdown: number                   // 当前回撤
  drawdownPct: number                // 回撤比例
}

/**
 * 绩效指标
 */
export interface PerformanceMetrics {
  // === 基础指标 ===
  totalTrades: number                // 总交易次数
  winningTrades: number              // 盈利交易数
  losingTrades: number               // 亏损交易数
  winRate: number                    // 胜率
  
  // === 收益指标 ===
  totalReturn: number                // 总收益率
  totalReturnAmount: number          // 总收益金额
  avgReturn: number                  // 单次平均收益率
  avgWinReturn: number               // 平均盈利收益率
  avgLossReturn: number              // 平均亏损收益率
  
  // === 盈亏比 ===
  profitLossRatio: number            // 盈亏比（平均盈利/平均亏损）
  profitFactor: number               // 盈利因子（总盈利/总亏损）
  
  // === 风险指标 ===
  maxDrawdown: number                // 最大回撤（金额）
  maxDrawdownPct: number             // 最大回撤比例
  maxConsecutiveLosses: number       // 最大连续亏损次数
  maxConsecutiveWins: number         // 最大连续盈利次数
  
  // === 风险调整收益 ===
  sharpeRatio: number                // 夏普比率（年化）
  sortinoRatio: number               // 索提诺比率（年化）
  calmarRatio: number                // 卡玛比率（年化收益/最大回撤）
  
  // === 持仓统计 ===
  avgHoldingDays: number             // 平均持仓天数
  maxHoldingDays: number             // 最大持仓天数
  minHoldingDays: number             // 最小持仓天数
  
  // === 极值统计 ===
  maxProfit: number                  // 最大单笔盈利
  maxLoss: number                    // 最大单笔亏损
  maxProfitTrade: number             // 最大盈利交易序号
  maxLossTrade: number               // 最大亏损交易序号
  
  // === 多空统计 ===
  longTrades: number                 // 做多交易次数
  shortTrades: number                // 做空交易次数
  longWinRate: number                // 做多胜率
  shortWinRate: number               // 做空胜率
  longAvgReturn: number              // 做多平均收益
  shortAvgReturn: number             // 做空平均收益
  
  // === 成本统计 ===
  totalCommission: number            // 总佣金
  totalStampDuty: number             // 总印花税
  totalSlippage: number              // 总滑点成本
  totalTradingCost: number           // 总交易成本
  costPctOfReturn: number            // 成本占收益比例
}

/**
 * 回测结果
 */
export interface BacktestResult {
  // 基础信息
  params: BacktestParams             // 回测参数
  startDate: number                  // 回测开始日期
  endDate: number                    // 回测结束日期
  totalDays: number                  // 回测总天数
  
  // 交易记录
  trades: Trade[]                    // 所有交易记录
  
  // 资金曲线
  equityCurve: EquityPoint[]         // 资金曲线
  
  // 绩效指标
  metrics: PerformanceMetrics        // 绩效指标
  
  // 汇总信息
  initialCapital: number             // 初始资金
  finalEquity: number                // 最终资金
  totalReturn: number                // 总收益率
}

/**
 * 回测输入数据
 */
export interface BacktestInput {
  klineData: KLineData               // K线数据
  patterns: ConvergingTriangleResult[] // 形态检测结果
  params?: Partial<BacktestParams>   // 回测参数（可选）
}