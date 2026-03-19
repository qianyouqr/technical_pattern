/**
 * 收敛三角形检测算法 - 核心实现
 * 从 Python 版本移植 (dunhe_dataServer/src/library/pattern/converging_triangle.py)
 * 
 * v2.0 新增功能：
 * - 滑动窗口识别多个历史形态
 * - 明确的突破日检测
 * - 突破确认机制（站稳确认）
 * - 形态独立性判断（冷却期）
 */

import type {
  ConvergingTriangleParams,
  ConvergingTriangleResult,
  KLineData,
  MultiPatternResult,
  BreakoutInfo,
} from './types'
import { DEFAULT_PARAMS } from './types'
import {
  isValid,
  nanMax,
  nanMin,
  nanMean,
  nanStd,
  lineY,
  pivotsFractalHybrid,
  fitPivotLineAnchor,
  checkConvergence,
  calcWidthRatio,
  calcTouches,
  normalize,
  sigmoid,
} from './utils'

/**
 * 创建默认的检测结果
 */
function createEmptyResult(): ConvergingTriangleResult {
  return {
    isValid: false,
    breakoutStrengthUp: 0,
    breakoutStrengthDown: 0,
    priceScoreUp: 0,
    priceScoreDown: 0,
    convergenceScore: 0,
    volumeScore: 0,
    geometryScore: 0,
    activityScore: 0,
    tiltScore: 0.5,
    upperSlope: 0,
    lowerSlope: 0,
    upperIntercept: 0,
    lowerIntercept: 0,
    widthRatio: 0,
    touchesUpper: 0,
    touchesLower: 0,
    apexX: 0,
    upperPivots: [],
    lowerPivots: [],
    breakoutDir: 'none',
    volumeConfirmed: null,
    falseBreakout: null,
    // 新增字段
    breakoutDay: null,
    breakoutDate: null,
    breakoutConfirmed: false,
    breakoutConfirmDays: 0,
    breakoutPrice: null,
    breakoutVolume: null,
    windowStart: 0,
    windowEnd: 0,
    detectionMode: 'standard',
    hasCandidatePivots: false,
    candidatePivotCount: 0,
    // 新增：形态属性
    patternHeight: 0,
    patternStartDate: null,
    patternEndDate: null,
  }
}

/**
 * 计算价格突破分数
 */
function calcPriceScore(
  close: number[],
  high: number[],
  low: number[],
  upperSlope: number,
  upperIntercept: number,
  lowerSlope: number,
  lowerIntercept: number,
  breakTol: number
): { scoreUp: number; scoreDown: number } {
  const n = close.length
  if (n < 2) return { scoreUp: 0, scoreDown: 0 }

  const lastClose = close[n - 1]
  const lastHigh = high[n - 1]
  const lastLow = low[n - 1]

  // 计算趋势线在最后位置的值
  const upperLineValue = lineY(upperSlope, upperIntercept, n - 1)
  const lowerLineValue = lineY(lowerSlope, lowerIntercept, n - 1)

  // 向上突破分数：收盘价接近上沿的程度
  const upperDistance = (upperLineValue - lastClose) / lastClose
  const scoreUp = Math.max(0, 1 - upperDistance / (breakTol * 10))

  // 向下突破分数：收盘价接近下沿的程度
  const lowerDistance = (lastClose - lowerLineValue) / lastClose
  const scoreDown = Math.max(0, 1 - lowerDistance / (breakTol * 10))

  // 检查是否已经突破
  if (lastHigh >= upperLineValue * (1 - breakTol)) {
    return { scoreUp: Math.min(1, scoreUp + 0.3), scoreDown }
  }
  if (lastLow <= lowerLineValue * (1 + breakTol)) {
    return { scoreUp, scoreDown: Math.min(1, scoreDown + 0.3) }
  }

  return { scoreUp, scoreDown }
}

/**
 * 计算收敛分数
 */
function calcConvergenceScore(widthRatio: number, shrinkRatio: number): number {
  // 宽度比越小，收敛程度越高
  // 目标是 widthRatio <= shrinkRatio
  if (widthRatio <= shrinkRatio) {
    return 1 - widthRatio / shrinkRatio * 0.5
  }
  return Math.max(0, 1 - (widthRatio - shrinkRatio) / (1 - shrinkRatio))
}

/**
 * 计算成交量分数
 */
function calcVolumeScore(
  volume: (number | null)[],
  _close: number[],  // 保留参数以备将来扩展
  volWindow: number,
  volK: number
): number {
  const n = volume.length
  if (n < volWindow) return 0

  // 获取最近的成交量
  const recentVol = volume.slice(-volWindow).filter(isValid)
  if (recentVol.length === 0) return 0

  const meanVol = nanMean(volume.slice(-volWindow))
  const lastVol = volume[n - 1]

  if (!isValid(lastVol) || meanVol === 0) return 0

  // 成交量放大倍数
  const volRatio = lastVol / meanVol

  // 根据放大倍数计算分数
  if (volRatio >= volK) {
    return Math.min(1, (volRatio - volK) / volK + 0.5)
  }

  return normalize(volRatio, 0, volK)
}

/**
 * 计算形态规则度分数
 */
function calcGeometryScore(
  touchesUpper: number,
  touchesLower: number,
  upperSlope: number,
  lowerSlope: number
): number {
  // 触碰次数越多，形态越规则
  const touchScore = normalize(touchesUpper + touchesLower, 3, 8)

  // 斜率接近对称（绝对值接近）越好
  const slopeSymmetry = 1 - Math.abs(Math.abs(upperSlope) - Math.abs(lowerSlope)) /
    Math.max(Math.abs(upperSlope), Math.abs(lowerSlope), 0.001)

  return touchScore * 0.6 + slopeSymmetry * 0.4
}

/**
 * 计算价格活跃度分数
 */
function calcActivityScore(
  close: number[],
  high: number[],
  low: number[]
): number {
  const n = close.length
  if (n < 20) return 0

  // 计算最近20天的波动率
  const recentClose = close.slice(-20)
  const meanClose = nanMean(recentClose)
  const stdClose = nanStd(recentClose)

  if (!isValid(meanClose) || meanClose === 0) return 0

  // 波动率
  const volatility = stdClose / meanClose

  // 计算振幅
  const recentHigh = nanMax(high.slice(-20))
  const recentLow = nanMin(low.slice(-20))
  const amplitude = (recentHigh - recentLow) / meanClose

  // 综合活跃度
  const score = normalize(volatility * 2 + amplitude, 0.05, 0.3)

  return Math.min(1, score)
}

/**
 * 计算倾斜度分数
 */
function calcTiltScore(upperSlope: number, lowerSlope: number): number {
  // 计算平均斜率（带符号）
  const avgSlope = (upperSlope + lowerSlope) / 2

  // 斜率接近0表示三角形对称，分数高
  // 斜率绝对值大表示三角形倾斜，分数低
  const absSlope = Math.abs(avgSlope)

  // 使用 sigmoid 函数映射到 [0, 1]
  // 斜率 0 对应 0.5，斜率越大越低
  return sigmoid(-absSlope * 50) * 0.5 + 0.25
}

/**
 * 检测收敛三角形
 *
 * @param klineData K线数据
 * @param params 检测参数
 * @returns 检测结果
 */
export function detectConvergingTriangle(
  klineData: KLineData,
  params: Partial<ConvergingTriangleParams> = {}
): ConvergingTriangleResult {
  // 合并默认参数
  const p: ConvergingTriangleParams = { ...DEFAULT_PARAMS, ...params }

  const { high, low, close, volume } = klineData
  const n = close.length

  // 基本检查
  if (n < p.window) {
    console.warn('[detectConvergingTriangle] 数据长度不足')
    return createEmptyResult()
  }

  // 获取检测窗口内的数据
  const windowStart = Math.max(0, n - p.window)
  const windowEnd = n - 1

  const windowHigh = high.slice(windowStart)
  const windowLow = low.slice(windowStart)
  const windowClose = close.slice(windowStart)
  const windowVolume = volume.slice(windowStart)

  // 过滤无效数据
  const validHigh = windowHigh.filter(isValid)
  const validLow = windowLow.filter(isValid)
  const validClose = windowClose.filter(isValid)

  if (validClose.length < p.pivotK * 2 + 1) {
    console.warn('[detectConvergingTriangle] 有效数据不足')
    return createEmptyResult()
  }

  // 1. 检测枢轴点
  const pivots = pivotsFractalHybrid(
    windowHigh,
    windowLow,
    p.pivotK,
    Math.floor(p.pivotK / 3)
  )

  const allPh = [...pivots.confirmedPh, ...pivots.candidatePh]
  const allPl = [...pivots.confirmedPl, ...pivots.candidatePl]

  if (allPh.length < 2 || allPl.length < 2) {
    console.warn('[detectConvergingTriangle] 枢轴点不足', {
      ph: allPh.length,
      pl: allPl.length,
    })
    return createEmptyResult()
  }

  // 2. 拟合边界线
  // 上沿：使用高点枢轴点
  const upperPivotValues = allPh.map(idx => windowHigh[idx]).filter(isValid) as number[]
  const upperFit = fitPivotLineAnchor(allPh, upperPivotValues, 'upper')

  // 下沿：使用低点枢轴点
  const lowerPivotValues = allPl.map(idx => windowLow[idx]).filter(isValid) as number[]
  const lowerFit = fitPivotLineAnchor(allPl, lowerPivotValues, 'lower')

  const { slope: upperSlope, intercept: upperIntercept } = upperFit
  const { slope: lowerSlope, intercept: lowerIntercept } = lowerFit

  // 3. 检查收敛性
  if (!checkConvergence(upperSlope, lowerSlope, p.upperSlopeMax, p.lowerSlopeMin)) {
    console.warn('[detectConvergingTriangle] 不满足收敛条件', {
      upperSlope,
      lowerSlope,
    })
    return createEmptyResult()
  }

  // 4. 计算宽度比率
  const widthRatio = calcWidthRatio(
    upperSlope, upperIntercept,
    lowerSlope, lowerIntercept,
    0, windowEnd - windowStart
  )

  // 5. 检查收敛程度
  if (widthRatio > p.shrinkRatio) {
    console.warn('[detectConvergingTriangle] 收敛程度不足', {
      widthRatio,
      shrinkRatio: p.shrinkRatio,
    })
    return createEmptyResult()
  }

  // 6. 计算触碰次数
  const touchesUpper = calcTouches(
    allPh, upperPivotValues,
    upperSlope, upperIntercept,
    p.touchTol
  )
  const touchesLower = calcTouches(
    allPl, lowerPivotValues,
    lowerSlope, lowerIntercept,
    p.touchTol
  )

  // 触碰次数检查
  if (touchesUpper < 2 || touchesLower < 2) {
    console.warn('[detectConvergingTriangle] 触碰次数不足', {
      touchesUpper,
      touchesLower,
    })
    return createEmptyResult()
  }

  // 7. 计算各维度分数
  const priceScore = calcPriceScore(
    validClose,
    validHigh,
    validLow,
    upperSlope, upperIntercept,
    lowerSlope, lowerIntercept,
    p.breakTol
  )

  const convergenceScore = calcConvergenceScore(widthRatio, p.shrinkRatio)
  const volumeScore = calcVolumeScore(windowVolume, validClose, p.volWindow, p.volK)
  const geometryScore = calcGeometryScore(touchesUpper, touchesLower, upperSlope, lowerSlope)
  const activityScore = calcActivityScore(validClose, validHigh, validLow)
  const tiltScore = calcTiltScore(upperSlope, lowerSlope)

  // 8. 计算突破强度
  const breakoutStrengthUp = (
    priceScore.scoreUp * 0.4 +
    convergenceScore * 0.2 +
    volumeScore * 0.15 +
    geometryScore * 0.1 +
    activityScore * 0.1 +
    tiltScore * 0.05
  )

  const breakoutStrengthDown = (
    priceScore.scoreDown * 0.4 +
    convergenceScore * 0.2 +
    volumeScore * 0.15 +
    geometryScore * 0.1 +
    activityScore * 0.1 +
    tiltScore * 0.05
  )

  // 9. 检测突破日
  const breakoutInfo = detectBreakoutDay(
    close, high, low, volume,
    upperSlope, upperIntercept,
    lowerSlope, lowerIntercept,
    windowStart, windowEnd,
    p,
    klineData.dates
  )
  
  // 确定突破方向
  let breakoutDir: 'up' | 'down' | 'none' = 'none'
  let breakoutDay: number | null = null
  let breakoutDate: number | null = null
  let breakoutConfirmed = false
  let breakoutConfirmDays = 0
  let breakoutPrice: number | null = null
  let breakoutVolume: number | null = null
  
  if (breakoutInfo) {
    breakoutDir = breakoutInfo.breakoutDir
    breakoutDay = breakoutInfo.breakoutDay
    breakoutDate = breakoutInfo.breakoutDate
    breakoutConfirmed = breakoutInfo.confirmed
    breakoutConfirmDays = breakoutInfo.confirmDays
    breakoutPrice = breakoutInfo.breakoutPrice
    breakoutVolume = breakoutInfo.breakoutVolume
  } else {
    // 兼容旧逻辑：如果没有明确突破日，检查最后价格
    const lastClose = validClose[validClose.length - 1]
    const lastIdx = windowEnd - windowStart
    const upperLineAtEnd = lineY(upperSlope, upperIntercept, lastIdx)
    const lowerLineAtEnd = lineY(lowerSlope, lowerIntercept, lastIdx)

    if (lastClose >= upperLineAtEnd * (1 - p.breakTol)) {
      breakoutDir = 'up'
    } else if (lastClose <= lowerLineAtEnd * (1 + p.breakTol)) {
      breakoutDir = 'down'
    }
  }

  // 10. 收集枢轴点坐标（全局索引）
  const upperPivots: Array<[number, number]> = allPh
    .filter((_, i) => isValid(upperPivotValues[i]))
    .map((idx, i) => [windowStart + idx, upperPivotValues[i]])

  const lowerPivots: Array<[number, number]> = allPl
    .filter((_, i) => isValid(lowerPivotValues[i]))
    .map((idx, i) => [windowStart + idx, lowerPivotValues[i]])

  // 11. 计算顶点位置
  let apexX = 0
  if (Math.abs(upperSlope - lowerSlope) > 1e-10) {
    apexX = (lowerIntercept - upperIntercept) / (upperSlope - lowerSlope)
  }
  
  // 12. 计算形态高度
  const upperLineAtStart = lineY(upperSlope, upperIntercept, 0)
  const lowerLineAtStart = lineY(lowerSlope, lowerIntercept, 0)
  const patternHeight = Math.abs(upperLineAtStart - lowerLineAtStart)

  // 打印详细的计算结果
  console.log('=== 收敛三角形检测结果 ===')
  console.log('【分数维度】')
  console.log('  priceScoreUp:', priceScore.scoreUp.toFixed(4))
  console.log('  priceScoreDown:', priceScore.scoreDown.toFixed(4))
  console.log('  convergenceScore:', convergenceScore.toFixed(4))
  console.log('  volumeScore:', volumeScore.toFixed(4))
  console.log('  geometryScore:', geometryScore.toFixed(4))
  console.log('  activityScore:', activityScore.toFixed(4))
  console.log('  tiltScore:', tiltScore.toFixed(4))
  console.log('【综合强度】')
  console.log('  breakoutStrengthUp:', breakoutStrengthUp.toFixed(4))
  console.log('  breakoutStrengthDown:', breakoutStrengthDown.toFixed(4))
  console.log('【趋势线参数】')
  console.log('  upperSlope:', upperSlope.toFixed(6), '  upperIntercept:', upperIntercept.toFixed(6))
  console.log('  lowerSlope:', lowerSlope.toFixed(6), '  lowerIntercept:', lowerIntercept.toFixed(6))
  console.log('【形态特征】')
  console.log('  widthRatio:', widthRatio.toFixed(4))
  console.log('  touchesUpper:', touchesUpper, '  touchesLower:', touchesLower)
  console.log('  apexX:', apexX.toFixed(2))
  console.log('  patternHeight:', patternHeight.toFixed(4))
  console.log('【突破信息】')
  console.log('  breakoutDir:', breakoutDir)
  console.log('  breakoutDay:', breakoutDay)
  console.log('  breakoutConfirmed:', breakoutConfirmed)
  console.log('  breakoutConfirmDays:', breakoutConfirmDays)
  console.log('  upperPivots:', upperPivots)
  console.log('  lowerPivots:', lowerPivots)
  console.log('  windowStart:', windowStart, '  windowEnd:', windowEnd)
  console.log('=========================')

  return {
    isValid: true,
    breakoutStrengthUp,
    breakoutStrengthDown,
    priceScoreUp: priceScore.scoreUp,
    priceScoreDown: priceScore.scoreDown,
    convergenceScore,
    volumeScore,
    geometryScore,
    activityScore,
    tiltScore,
    upperSlope,
    lowerSlope,
    upperIntercept,
    lowerIntercept,
    widthRatio,
    touchesUpper,
    touchesLower,
    apexX,
    upperPivots,
    lowerPivots,
    breakoutDir,
    volumeConfirmed: volumeScore > 0.5,
    falseBreakout: false,
    // 新增字段
    breakoutDay,
    breakoutDate,
    breakoutConfirmed,
    breakoutConfirmDays,
    breakoutPrice,
    breakoutVolume,
    windowStart,
    windowEnd,
    detectionMode: 'realtime',
    hasCandidatePivots: pivots.candidatePh.length > 0 || pivots.candidatePl.length > 0,
    candidatePivotCount: pivots.candidatePh.length + pivots.candidatePl.length,
    patternHeight,
    patternStartDate: klineData.dates?.[windowStart] ?? null,
    patternEndDate: klineData.dates?.[windowEnd] ?? null,
  }
}

/**
 * 计算综合强度分数
 */
export function calcStrength(
  result: ConvergingTriangleResult,
  mode: 'equal' | 'aggressive' | 'conservative' | 'volume_focus' = 'equal'
): number {
  if (!result.isValid) return 0

  const weights = {
    equal: { price: 1/6, convergence: 1/6, volume: 1/6, geometry: 1/6, activity: 1/6, tilt: 1/6 },
    aggressive: { price: 0.35, convergence: 0.10, volume: 0.25, geometry: 0.10, activity: 0.15, tilt: 0.05 },
    conservative: { price: 0.15, convergence: 0.30, volume: 0.10, geometry: 0.25, activity: 0.15, tilt: 0.05 },
    volume_focus: { price: 0.25, convergence: 0.10, volume: 0.35, geometry: 0.10, activity: 0.15, tilt: 0.05 },
  }

  const w = weights[mode]
  const priceScore = result.breakoutDir === 'up'
    ? result.priceScoreUp
    : result.breakoutDir === 'down'
      ? result.priceScoreDown
      : Math.max(result.priceScoreUp, result.priceScoreDown)

  return (
    w.price * priceScore +
    w.convergence * result.convergenceScore +
    w.volume * result.volumeScore +
    w.geometry * result.geometryScore +
    w.activity * result.activityScore +
    w.tilt * result.tiltScore
  )
}

// ============================================================
// 新增功能：突破日检测
// ============================================================

/**
 * 检测单个收敛三角形形态的突破日
 * 
 * @param close 收盘价数组
 * @param high 最高价数组
 * @param low 最低价数组
 * @param volume 成交量数组
 * @param upperSlope 上沿斜率
 * @param upperIntercept 上沿截距
 * @param lowerSlope 下沿斜率
 * @param lowerIntercept 下沿截距
 * @param patternStart 形态起始索引（相对于原数组）
 * @param patternEnd 形态结束索引（相对于原数组）
 * @param params 参数配置
 * @param dates 日期数组（可选）
 * @returns 突破信息，如果没有突破返回 null
 */
export function detectBreakoutDay(
  close: (number | null)[],
  high: (number | null)[],
  low: (number | null)[],
  volume: (number | null)[],
  upperSlope: number,
  upperIntercept: number,
  lowerSlope: number,
  lowerIntercept: number,
  patternStart: number,
  patternEnd: number,
  params: ConvergingTriangleParams,
  dates?: number[]
): BreakoutInfo | null {
  const n = close.length
  
  // 从形态结束后一天开始检测突破
  const checkStart = patternEnd + 1
  const checkEnd = Math.min(n - 1, patternEnd + params.confirmWindow + 10)
  
  if (checkStart >= n) return null
  
  // 计算形态高度（用于判断突破幅度）
  const upperLineAtStart = lineY(upperSlope, upperIntercept, 0)
  const lowerLineAtStart = lineY(lowerSlope, lowerIntercept, 0)
  const patternHeight = Math.abs(upperLineAtStart - lowerLineAtStart)
  
  // 遍历检测突破日
  for (let i = checkStart; i <= checkEnd; i++) {
    const currentClose = close[i]
    const currentHigh = high[i]
    const currentLow = low[i]
    const currentVolume = volume[i]
    
    if (!isValid(currentClose) || !isValid(currentHigh) || !isValid(currentLow)) continue
    
    // 计算当前K线对应的趋势线值（注意索引偏移）
    const relativeIdx = i - patternStart
    const upperLineValue = lineY(upperSlope, upperIntercept, relativeIdx)
    const lowerLineValue = lineY(lowerSlope, lowerIntercept, relativeIdx)
    
    // 检测向上突破
    if (isValid(currentHigh) && currentHigh >= upperLineValue * (1 - params.breakTol)) {
      // 找到突破日，检查确认
      const confirmResult = checkBreakoutConfirmation(
        close, high, low, volume,
        i, 'up', upperLineValue, patternHeight, params
      )
      
      if (confirmResult) {
        return {
          breakoutDay: i,
          breakoutDate: dates && dates.length > i ? dates[i] : i,
          breakoutDir: 'up',
          breakoutPrice: currentClose,
          breakoutVolume: isValid(currentVolume) ? currentVolume : 0,
          volumeRatio: confirmResult.volumeRatio,
          confirmed: confirmResult.confirmed,
          confirmDays: confirmResult.confirmDays,
        }
      }
    }
    
    // 检测向下突破
    if (isValid(currentLow) && currentLow <= lowerLineValue * (1 + params.breakTol)) {
      const confirmResult = checkBreakoutConfirmation(
        close, high, low, volume,
        i, 'down', lowerLineValue, patternHeight, params
      )
      
      if (confirmResult) {
        return {
          breakoutDay: i,
          breakoutDate: dates && dates.length > i ? dates[i] : i,
          breakoutDir: 'down',
          breakoutPrice: currentClose,
          breakoutVolume: isValid(currentVolume) ? currentVolume : 0,
          volumeRatio: confirmResult.volumeRatio,
          confirmed: confirmResult.confirmed,
          confirmDays: confirmResult.confirmDays,
        }
      }
    }
  }
  
  return null
}

/**
 * 检查突破确认（站稳确认）
 * 
 * @param close 收盘价数组
 * @param _high 最高价数组（保留以备将来扩展）
 * @param _low 最低价数组（保留以备将来扩展）
 * @param volume 成交量数组
 * @param breakoutDay 突破日索引
 * @param direction 突破方向
 * @param breakoutLevel 突破位置的趋势线值
 * @param _patternHeight 形态高度（保留以备将来扩展）
 * @param params 参数配置
 */
function checkBreakoutConfirmation(
  close: (number | null)[],
  _high: (number | null)[],
  _low: (number | null)[],
  volume: (number | null)[],
  breakoutDay: number,
  direction: 'up' | 'down',
  breakoutLevel: number,
  _patternHeight: number,
  params: ConvergingTriangleParams
): { confirmed: boolean; confirmDays: number; volumeRatio: number } | null {
  const n = close.length
  const confirmEnd = Math.min(n - 1, breakoutDay + params.confirmWindow)
  
  if (confirmEnd <= breakoutDay) {
    return { confirmed: false, confirmDays: 0, volumeRatio: 1 }
  }
  
  // 计算突破日成交量比率
  const volLookback = Math.min(params.volWindow, breakoutDay)
  const prevVolumes = volume.slice(breakoutDay - volLookback, breakoutDay).filter(isValid)
  const avgVolume = prevVolumes.length > 0 ? nanMean(prevVolumes) : 1
  const breakoutVolume = volume[breakoutDay]
  const volumeRatio = isValid(breakoutVolume) && avgVolume > 0 
    ? breakoutVolume / avgVolume 
    : 1
  
  // 检查确认窗口内的站稳情况
  let confirmCount = 0
  const confirmDays = confirmEnd - breakoutDay
  
  for (let i = breakoutDay + 1; i <= confirmEnd; i++) {
    const currentClose = close[i]
    
    if (!isValid(currentClose)) continue
    
    if (direction === 'up') {
      // 向上突破：收盘价应站稳在突破线上方
      if (currentClose >= breakoutLevel * (1 - params.breakTol * 2)) {
        confirmCount++
      }
    } else {
      // 向下突破：收盘价应站稳在突破线下方
      if (currentClose <= breakoutLevel * (1 + params.breakTol * 2)) {
        confirmCount++
      }
    }
  }
  
  // 确认标准：确认窗口内满足一定比例的K线站稳
  const confirmed = confirmDays > 0 && (confirmCount / confirmDays) >= params.confirmRatio
  
  return { confirmed, confirmDays, volumeRatio }
}

// ============================================================
// 新增功能：多形态识别
// ============================================================

/**
 * 检测所有独立的收敛三角形形态（滑动窗口版本）
 * 
 * @param klineData K线数据
 * @param params 检测参数
 * @returns 多形态检测结果
 */
export function detectMultiPatterns(
  klineData: KLineData,
  params: Partial<ConvergingTriangleParams> = {}
): MultiPatternResult {
  const p: ConvergingTriangleParams = { ...DEFAULT_PARAMS, ...params }
  const { high, low, close, volume, dates } = klineData
  const n = close.length
  
  const patterns: ConvergingTriangleResult[] = []
  let lastBreakoutDay = -Infinity // 上一个突破日的索引
  
  // 滑动窗口步长
  const stepSize = Math.floor(p.minPatternDays / 2)
  
  // 从最早的数据开始滑动检测
  for (let windowEnd = p.minPatternDays + p.pivotK * 2; windowEnd < n; windowEnd += stepSize) {
    // 计算窗口起点（根据形态周期限制）
    const minStart = Math.max(0, windowEnd - p.maxPatternDays)
    const maxStart = windowEnd - p.minPatternDays
    
    // 在有效范围内尝试不同的窗口起点
    for (let windowStart = minStart; windowStart <= maxStart; windowStart += stepSize) {
      // 检查冷却期：与上一个形态的突破日是否足够远
      if (lastBreakoutDay > 0 && windowStart < lastBreakoutDay + p.cooldownDays) {
        continue
      }
      
      // 提取窗口数据
      const windowHigh = high.slice(windowStart, windowEnd + 1)
      const windowLow = low.slice(windowStart, windowEnd + 1)
      const windowClose = close.slice(windowStart, windowEnd + 1)
      const windowVolume = volume.slice(windowStart, windowEnd + 1)
      
      // 尝试检测形态
      const result = detectSinglePattern(
        windowHigh, windowLow, windowClose, windowVolume,
        windowStart, windowEnd, dates, p
      )
      
      if (result && result.isValid) {
        // 检测突破日
        const breakoutInfo = detectBreakoutDay(
          close, high, low, volume,
          result.upperSlope, result.upperIntercept,
          result.lowerSlope, result.lowerIntercept,
          result.windowStart, result.windowEnd,
          p,
          dates
        )
        
        // 更新形态日期
        if (dates && dates.length > windowStart) {
          result.patternStartDate = dates[windowStart]
          result.patternEndDate = dates[windowEnd]
        }
        
        if (breakoutInfo) {
          // 更新结果中的突破信息
          result.breakoutDay = breakoutInfo.breakoutDay
          result.breakoutDate = breakoutInfo.breakoutDate
          result.breakoutDir = breakoutInfo.breakoutDir
          result.breakoutConfirmed = breakoutInfo.confirmed
          result.breakoutConfirmDays = breakoutInfo.confirmDays
          result.breakoutPrice = breakoutInfo.breakoutPrice
          result.breakoutVolume = breakoutInfo.breakoutVolume
          result.detectionMode = 'backtest'
        }
        
        // 检查形态独立性（基于形态结束时间，而不是突破时间）
        if (isIndependentPattern(patterns, result, p)) {
          patterns.push(result)
          // 更新冷却期标记（使用形态结束时间或突破时间）
          lastBreakoutDay = breakoutInfo ? breakoutInfo.breakoutDay : windowEnd
          
          // 跳过这个形态覆盖的范围
          break // 跳出窗口起点循环，进入下一个滑动位置
        }
      }
    }
  }
  
  // 按时间排序
  patterns.sort((a, b) => a.windowStart - b.windowStart)
  
  return {
    patterns,
    totalCount: patterns.length,
    validBreakouts: patterns.filter(p => p.breakoutConfirmed).length,
    lastPattern: patterns.length > 0 ? patterns[patterns.length - 1] : null,
  }
}

/**
 * 检测单个窗口内的收敛三角形形态
 */
function detectSinglePattern(
  windowHigh: (number | null)[],
  windowLow: (number | null)[],
  windowClose: (number | null)[],
  windowVolume: (number | null)[],
  globalStart: number,
  globalEnd: number,
  dates: number[] | undefined,
  params: ConvergingTriangleParams
): ConvergingTriangleResult | null {
  const validHigh = windowHigh.filter(isValid)
  const validLow = windowLow.filter(isValid)
  const validClose = windowClose.filter(isValid)
  
  // 基本检查
  if (validClose.length < params.pivotK * 2 + 1) return null
  if (validClose.length < params.minPatternDays) return null
  
  // 检测枢轴点
  const pivots = pivotsFractalHybrid(
    windowHigh, windowLow,
    params.pivotK,
    Math.floor(params.pivotK / 3)
  )
  
  const allPh = [...pivots.confirmedPh, ...pivots.candidatePh]
  const allPl = [...pivots.confirmedPl, ...pivots.candidatePl]
  
  if (allPh.length < 2 || allPl.length < 2) return null
  
  // 拟合边界线
  const upperPivotValues = allPh.map(idx => windowHigh[idx]).filter(isValid) as number[]
  const lowerPivotValues = allPl.map(idx => windowLow[idx]).filter(isValid) as number[]
  
  if (upperPivotValues.length < 2 || lowerPivotValues.length < 2) return null
  
  const upperFit = fitPivotLineAnchor(allPh, upperPivotValues, 'upper')
  const lowerFit = fitPivotLineAnchor(allPl, lowerPivotValues, 'lower')
  
  const { slope: upperSlope, intercept: upperIntercept } = upperFit
  const { slope: lowerSlope, intercept: lowerIntercept } = lowerFit
  
  // 检查收敛性
  if (!checkConvergence(upperSlope, lowerSlope, params.upperSlopeMax, params.lowerSlopeMin)) {
    return null
  }
  
  // 计算宽度比率
  const widthRatio = calcWidthRatio(
    upperSlope, upperIntercept,
    lowerSlope, lowerIntercept,
    0, windowClose.length - 1
  )
  
  if (widthRatio > params.shrinkRatio) return null
  
  // 计算触碰次数
  const touchesUpper = calcTouches(allPh, upperPivotValues, upperSlope, upperIntercept, params.touchTol)
  const touchesLower = calcTouches(allPl, lowerPivotValues, lowerSlope, lowerIntercept, params.touchTol)
  
  if (touchesUpper < 2 || touchesLower < 2) return null
  
  // 计算形态高度
  const upperLineAtStart = lineY(upperSlope, upperIntercept, 0)
  const lowerLineAtStart = lineY(lowerSlope, lowerIntercept, 0)
  const patternHeight = Math.abs(upperLineAtStart - lowerLineAtStart)
  
  // 计算顶点位置
  let apexX = 0
  if (Math.abs(upperSlope - lowerSlope) > 1e-10) {
    apexX = (lowerIntercept - upperIntercept) / (upperSlope - lowerSlope)
  }
  
  // 收集枢轴点坐标
  const upperPivots: Array<[number, number]> = allPh
    .filter((_, i) => isValid(upperPivotValues[i]))
    .map((idx, i) => [globalStart + idx, upperPivotValues[i]])
  
  const lowerPivots: Array<[number, number]> = allPl
    .filter((_, i) => isValid(lowerPivotValues[i]))
    .map((idx, i) => [globalStart + idx, lowerPivotValues[i]])
  
  // 计算各维度分数
  const priceScore = calcPriceScore(
    validClose, validHigh, validLow,
    upperSlope, upperIntercept,
    lowerSlope, lowerIntercept,
    params.breakTol
  )
  
  const convergenceScore = calcConvergenceScore(widthRatio, params.shrinkRatio)
  const volumeScore = calcVolumeScore(windowVolume, validClose, params.volWindow, params.volK)
  const geometryScore = calcGeometryScore(touchesUpper, touchesLower, upperSlope, lowerSlope)
  const activityScore = calcActivityScore(validClose, validHigh, validLow)
  const tiltScore = calcTiltScore(upperSlope, lowerSlope)
  
  // 计算突破强度
  const breakoutStrengthUp = (
    priceScore.scoreUp * 0.4 +
    convergenceScore * 0.2 +
    volumeScore * 0.15 +
    geometryScore * 0.1 +
    activityScore * 0.1 +
    tiltScore * 0.05
  )
  
  const breakoutStrengthDown = (
    priceScore.scoreDown * 0.4 +
    convergenceScore * 0.2 +
    volumeScore * 0.15 +
    geometryScore * 0.1 +
    activityScore * 0.1 +
    tiltScore * 0.05
  )
  
  return {
    isValid: true,
    breakoutStrengthUp,
    breakoutStrengthDown,
    priceScoreUp: priceScore.scoreUp,
    priceScoreDown: priceScore.scoreDown,
    convergenceScore,
    volumeScore,
    geometryScore,
    activityScore,
    tiltScore,
    upperSlope,
    lowerSlope,
    upperIntercept,
    lowerIntercept,
    widthRatio,
    touchesUpper,
    touchesLower,
    apexX,
    upperPivots,
    lowerPivots,
    breakoutDir: 'none',
    volumeConfirmed: volumeScore > 0.5,
    falseBreakout: false,
    breakoutDay: null,
    breakoutDate: null,
    breakoutConfirmed: false,
    breakoutConfirmDays: 0,
    breakoutPrice: null,
    breakoutVolume: null,
    windowStart: globalStart,
    windowEnd: globalEnd,
    detectionMode: 'backtest',
    hasCandidatePivots: pivots.candidatePh.length > 0 || pivots.candidatePl.length > 0,
    candidatePivotCount: pivots.candidatePh.length + pivots.candidatePl.length,
    patternHeight,
    patternStartDate: dates && dates.length > globalStart ? dates[globalStart] : null,
    patternEndDate: dates && dates.length > globalEnd ? dates[globalEnd] : null,
  }
}

/**
 * 检查形态独立性
 * 
 * 规则：
 * 1. 时间规则：两个形态之间间隔 >= 冷却期
 * 2. 空间规则：前一形态突破后运行幅度达标
 * 3. 结构规则：不共用枢轴点
 */
function isIndependentPattern(
  existingPatterns: ConvergingTriangleResult[],
  newPattern: ConvergingTriangleResult,
  params: ConvergingTriangleParams
): boolean {
  for (const existing of existingPatterns) {
    // 时间规则：新形态起点必须在前一形态结束/突破日 + 冷却期之后
    // 使用突破日（如果有）或形态结束时间作为参考点
    const existingEndTime = existing.breakoutDay !== null ? existing.breakoutDay : existing.windowEnd
    if (existingEndTime !== null && newPattern.windowStart !== null) {
      const gapDays = newPattern.windowStart - existingEndTime
      if (gapDays < params.cooldownDays) {
        return false
      }
    }
    
    // 结构规则：检查枢轴点是否重叠
    const existingUpperIdx = new Set(existing.upperPivots.map(p => p[0]))
    const existingLowerIdx = new Set(existing.lowerPivots.map(p => p[0]))
    const newUpperIdx = new Set(newPattern.upperPivots.map(p => p[0]))
    const newLowerIdx = new Set(newPattern.lowerPivots.map(p => p[0]))
    
    // 检查是否有重叠的枢轴点
    for (const idx of newUpperIdx) {
      if (existingUpperIdx.has(idx) || existingLowerIdx.has(idx)) {
        return false
      }
    }
    for (const idx of newLowerIdx) {
      if (existingUpperIdx.has(idx) || existingLowerIdx.has(idx)) {
        return false
      }
    }
  }
  
  return true
}

// ============================================================
// 新增功能：检测最近一个已确认突破的形态
// ============================================================

/**
 * 检测最近一个已确认突破的收敛三角形形态
 * 
 * 与 detectConvergingTriangle 的区别：
 * 1. 不仅检测最近窗口内的形态，还要求形态必须有突破日
 * 2. 突破必须被确认（使用 confirmWindow 参数）
 * 3. 在 recentSearchWindow 范围内搜索，找到最近一个满足条件的形态
 * 
 * @param klineData K线数据
 * @param params 检测参数
 * @returns 检测结果，如果找不到已确认的形态返回空结果
 */
export function detectLatestConfirmedPattern(
  klineData: KLineData,
  params: Partial<ConvergingTriangleParams> = {}
): ConvergingTriangleResult {
  const p: ConvergingTriangleParams = { ...DEFAULT_PARAMS, ...params }
  const { high, low, close, volume, dates } = klineData
  const n = close.length
  
  // 基本检查
  if (n < p.minPatternDays + p.confirmWindow) {
    console.warn('[detectLatestConfirmedPattern] 数据长度不足')
    return createEmptyResult()
  }
  
  // 计算搜索范围：从最近的数据往前搜索
  const searchEnd = n - 1
  const searchStart = Math.max(0, n - p.recentSearchWindow)
  
  // 存储找到的形态候选
  const candidates: ConvergingTriangleResult[] = []
  
  // 从搜索范围的末尾开始，向前搜索最近的形态
  // 步长为 minPatternDays / 3，保证不会遗漏
  const stepSize = Math.max(1, Math.floor(p.minPatternDays / 3))
  
  for (let windowEnd = searchEnd - p.confirmWindow; windowEnd >= searchStart + p.minPatternDays; windowEnd -= stepSize) {
    // 形态的结束点应该在搜索范围内
    // 尝试不同的形态长度
    const minWindowStart = Math.max(searchStart, windowEnd - p.maxPatternDays)
    const maxWindowStart = windowEnd - p.minPatternDays
    
    for (let windowStart = maxWindowStart; windowStart >= minWindowStart; windowStart -= stepSize) {
      // 提取窗口数据
      const windowHigh = high.slice(windowStart, windowEnd + 1)
      const windowLow = low.slice(windowStart, windowEnd + 1)
      const windowClose = close.slice(windowStart, windowEnd + 1)
      const windowVolume = volume.slice(windowStart, windowEnd + 1)
      
      // 检测形态
      const result = detectSinglePattern(
        windowHigh, windowLow, windowClose, windowVolume,
        windowStart, windowEnd, dates, p
      )
      
      if (!result || !result.isValid) continue
      
      // 检测突破日（必须在当前数据范围内）
      const breakoutInfo = detectBreakoutDay(
        close, high, low, volume,
        result.upperSlope, result.upperIntercept,
        result.lowerSlope, result.lowerIntercept,
        result.windowStart, result.windowEnd,
        p,
        dates
      )
      
      if (!breakoutInfo) {
        // 没有突破，跳过这个形态
        continue
      }
      
      // 更新突破信息
      result.breakoutDay = breakoutInfo.breakoutDay
      result.breakoutDate = breakoutInfo.breakoutDate
      result.breakoutDir = breakoutInfo.breakoutDir
      result.breakoutConfirmed = breakoutInfo.confirmed
      result.breakoutConfirmDays = breakoutInfo.confirmDays
      result.breakoutPrice = breakoutInfo.breakoutPrice
      result.breakoutVolume = breakoutInfo.breakoutVolume
      result.detectionMode = 'realtime'
      
      // 只保留已确认突破的形态
      if (result.breakoutConfirmed) {
        candidates.push(result)
        
        // 找到最近的已确认形态，可以直接返回
        // 因为我们是从后往前搜索的，第一个找到的就是最近的
        console.log('[detectLatestConfirmedPattern] 找到最近的已确认形态', {
          patternStart: result.patternStartDate,
          patternEnd: result.patternEndDate,
          breakoutDay: result.breakoutDate,
          breakoutDir: result.breakoutDir,
          confirmDays: result.breakoutConfirmDays,
        })
        
        return result
      }
    }
  }
  
  // 如果没有找到已确认的形态，返回空结果
  console.log('[detectLatestConfirmedPattern] 未找到已确认的形态，候选数量:', candidates.length)
  return createEmptyResult()
}