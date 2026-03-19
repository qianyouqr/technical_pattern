/**
 * 收敛三角形检测算法 - TypeScript 类型定义
 * 从 Python 版本移植
 */

/**
 * 收敛三角形检测参数
 */
export interface ConvergingTriangleParams {
  // 窗口设置
  window: number

  // 枢轴点检测
  pivotK: number

  // 边界线拟合
  boundaryNSegments: number
  boundarySource: 'full' | 'pivots'
  fittingMethod: 'iterative' | 'lp' | 'quantile' | 'anchor'

  // 斜率约束
  upperSlopeMax: number
  lowerSlopeMin: number

  // 触碰判定
  touchTol: number
  touchLossMax: number

  // 收敛要求
  shrinkRatio: number

  // 突破判定
  breakTol: number
  volWindow: number
  volK: number
  falseBreakM: number

  // === 新增参数：多形态识别 ===
  // 形态周期范围（有效形态的最小/最大天数）
  minPatternDays: number    // 下限：默认 20 天
  maxPatternDays: number    // 上限：默认 60 天

  // 突破确认参数
  confirmWindow: number     // 站稳确认窗口：默认 3 天
  confirmRatio: number      // 确认阈值：窗口内多少比例K线确认突破

  // 形态独立性判断
  cooldownDays: number      // 冷却期：两个形态之间的最小间隔，默认 15 天
  minBreakoutMove: number   // 突破后最小运行幅度（形态高度的倍数），默认 1.0

  // 最近形态检测参数
  recentSearchWindow: number // 最近形态搜索范围：在最近多少天内搜索已确认的形态，默认 60 天
}

/**
 * 收敛三角形检测结果
 */
export interface ConvergingTriangleResult {
  // 基础标识
  isValid: boolean

  // 突破强度 (0~1 连续分数)
  breakoutStrengthUp: number
  breakoutStrengthDown: number

  // 突破强度分量 (各维度分数)
  priceScoreUp: number
  priceScoreDown: number
  convergenceScore: number
  volumeScore: number
  geometryScore: number
  activityScore: number
  tiltScore: number

  // 几何属性
  upperSlope: number
  lowerSlope: number
  upperIntercept: number
  lowerIntercept: number
  widthRatio: number
  touchesUpper: number
  touchesLower: number
  apexX: number

  // 枢轴点坐标（用于绘图）
  upperPivots: Array<[number, number]>  // [[相对索引, 价格], ...]
  lowerPivots: Array<[number, number]>

  // 突破状态
  breakoutDir: 'up' | 'down' | 'none'
  volumeConfirmed: boolean | null
  falseBreakout: boolean | null

  // === 新增：突破日相关信息 ===
  breakoutDay: number | null        // 突破日索引（相对于原始数据）
  breakoutDate: number | null       // 突破日日期
  breakoutConfirmed: boolean        // 突破是否确认（站稳）
  breakoutConfirmDays: number       // 确认天数
  breakoutPrice: number | null      // 突破时价格
  breakoutVolume: number | null     // 突破时成交量

  // 窗口范围
  windowStart: number
  windowEnd: number

  // 检测模式
  detectionMode: 'standard' | 'realtime' | 'backtest'
  hasCandidatePivots: boolean
  candidatePivotCount: number

  // === 新增：形态属性 ===
  patternHeight: number             // 形态高度（上沿-下沿在起点的差值）
  patternStartDate: number | null   // 形态开始日期
  patternEndDate: number | null     // 形态结束日期
}

/**
 * 枢轴点检测结果
 */
export interface PivotsResult {
  confirmedPh: number[]  // 确认的高点枢轴点索引
  confirmedPl: number[]  // 确认的低点枢轴点索引
  candidatePh: number[]  // 候选的高点枢轴点索引
  candidatePl: number[]  // 候选的低点枢轴点索引
}

/**
 * 拟合线结果
 */
export interface FitLineResult {
  slope: number
  intercept: number
  selectedIndices: number[]
}

/**
 * K线数据格式
 */
export interface KLineData {
  dates: number[]
  open: (number | null)[]
  high: (number | null)[]
  low: (number | null)[]
  close: (number | null)[]
  volume: (number | null)[]
}

/**
 * API 返回的 K 线数据格式
 */
export interface KLineApiResponse {
  code: number
  data: {
    labels: number[]
    open: (number | null)[]
    high: (number | null)[]
    low: (number | null)[]
    close: (number | null)[]
    volume?: (number | null)[]
  }
}

/**
 * 默认参数配置
 */
export const DEFAULT_PARAMS: ConvergingTriangleParams = {
  window: 240,
  pivotK: 15,
  boundaryNSegments: 2,
  boundarySource: 'full',
  fittingMethod: 'anchor',
  upperSlopeMax: 0,
  lowerSlopeMin: 0,
  touchTol: 0.10,
  touchLossMax: 0.10,
  shrinkRatio: 0.8,
  breakTol: 0.001,
  volWindow: 20,
  volK: 1.3,
  falseBreakM: 5,
  // 新增参数
  minPatternDays: 20,
  maxPatternDays: 60,
  confirmWindow: 3,
  confirmRatio: 0.6,
  cooldownDays: 15,
  minBreakoutMove: 1.0,
  recentSearchWindow: 60,
}

/**
 * 频率默认参数
 */
export interface FreqDefaults {
  window: number
  pivotK: number
  shrinkRatio: number
  minConvergence: number
  breakoutThreshold: number
  volumeMultiplier: number
  displayBars: number
  volWindow: number
  falseBreakM: number
  flexibleZone: number
}

export const FREQ_DEFAULTS: Record<'D' | 'W' | 'M', FreqDefaults> = {
  D: {
    window: 240,
    pivotK: 15,
    shrinkRatio: 0.8,
    minConvergence: 0.45,
    breakoutThreshold: 0.005,
    volumeMultiplier: 1.5,
    displayBars: 300,
    volWindow: 20,
    falseBreakM: 5,
    flexibleZone: 15,
  },
  W: {
    window: 100,
    pivotK: 5,
    shrinkRatio: 0.75,
    minConvergence: 0.45,
    breakoutThreshold: 0.01,
    volumeMultiplier: 1.3,
    displayBars: 150,
    volWindow: 10,
    falseBreakM: 3,
    flexibleZone: 5,
  },
  M: {
    window: 60,
    pivotK: 3,
    shrinkRatio: 0.7,
    minConvergence: 0.50,
    breakoutThreshold: 0.015,
    volumeMultiplier: 1.2,
    displayBars: 80,
    volWindow: 6,
    falseBreakM: 2,
    flexibleZone: 3,
  },
}

/**
 * 模式权重配置
 */
export interface ModeWeights {
  price: number
  convergence: number
  volume: number
  geometry: number
  activity: number
  tilt: number
}

export const MODE_WEIGHTS: Record<string, ModeWeights> = {
  equal: {
    price: 1 / 6,
    convergence: 1 / 6,
    volume: 1 / 6,
    geometry: 1 / 6,
    activity: 1 / 6,
    tilt: 1 / 6,
  },
  aggressive: {
    price: 0.35,
    convergence: 0.10,
    volume: 0.25,
    geometry: 0.10,
    activity: 0.15,
    tilt: 0.05,
  },
  conservative: {
    price: 0.15,
    convergence: 0.30,
    volume: 0.10,
    geometry: 0.25,
    activity: 0.15,
    tilt: 0.05,
  },
  volume_focus: {
    price: 0.25,
    convergence: 0.10,
    volume: 0.35,
    geometry: 0.10,
    activity: 0.15,
    tilt: 0.05,
  },
}

/**
 * 多形态检测结果
 */
export interface MultiPatternResult {
  patterns: ConvergingTriangleResult[]  // 识别到的所有独立形态
  totalCount: number                    // 形态总数
  validBreakouts: number                // 有效突破数量
  lastPattern: ConvergingTriangleResult | null  // 最近的一个形态
}

/**
 * 突破日检测信息
 */
export interface BreakoutInfo {
  breakoutDay: number           // 突破日索引
  breakoutDate: number          // 突破日日期
  breakoutDir: 'up' | 'down'    // 突破方向
  breakoutPrice: number         // 突破价格
  breakoutVolume: number        // 突破成交量
  volumeRatio: number           // 成交量比率
  confirmed: boolean            // 是否确认
  confirmDays: number           // 确认天数
}