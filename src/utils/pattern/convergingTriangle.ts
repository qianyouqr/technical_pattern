/**
 * 收敛三角形检测算法 - 核心实现
 * 从 Python 版本移植 (dunhe_dataServer/src/library/pattern/converging_triangle.py)
 */

import type {
  ConvergingTriangleParams,
  ConvergingTriangleResult,
  KLineData,
} from './types'
import { DEFAULT_PARAMS } from './types'
import {
  isValid,
  nanMax,
  nanMin,
  nanMean,
  nanStd,
  fitLine,
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
    windowStart: 0,
    windowEnd: 0,
    detectionMode: 'standard',
    hasCandidatePivots: false,
    candidatePivotCount: 0,
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
  close: number[],
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

  const { open, high, low, close, volume } = klineData
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

  // 9. 确定突破方向
  let breakoutDir: 'up' | 'down' | 'none' = 'none'
  const lastClose = validClose[validClose.length - 1]
  const lastIdx = windowEnd - windowStart
  const upperLineAtEnd = lineY(upperSlope, upperIntercept, lastIdx)
  const lowerLineAtEnd = lineY(lowerSlope, lowerIntercept, lastIdx)

  if (lastClose >= upperLineAtEnd * (1 - p.breakTol)) {
    breakoutDir = 'up'
  } else if (lastClose <= lowerLineAtEnd * (1 + p.breakTol)) {
    breakoutDir = 'down'
  }

  // 10. 收集枢轴点坐标
  const upperPivots: Array<[number, number]> = allPh
    .filter((_, i) => isValid(upperPivotValues[i]))
    .map((idx, i) => [idx, upperPivotValues[i]])

  const lowerPivots: Array<[number, number]> = allPl
    .filter((_, i) => isValid(lowerPivotValues[i]))
    .map((idx, i) => [idx, lowerPivotValues[i]])

  // 11. 计算顶点位置
  let apexX = 0
  if (Math.abs(upperSlope - lowerSlope) > 1e-10) {
    apexX = (lowerIntercept - upperIntercept) / (upperSlope - lowerSlope)
  }

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
  console.log('  breakoutDir:', breakoutDir)
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
    windowStart,
    windowEnd,
    detectionMode: 'realtime',
    hasCandidatePivots: pivots.candidatePh.length > 0 || pivots.candidatePl.length > 0,
    candidatePivotCount: pivots.candidatePh.length + pivots.candidatePl.length,
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