/**
 * 收敛三角形检测算法 - 工具函数
 * 从 Python 版本移植
 */

import type { FitLineResult, PivotsResult } from './types'

/**
 * 过滤数组中的 null 和 undefined 值
 */
export function filterValidValues(arr: (number | null | undefined)[]): number[] {
  return arr.filter((v): v is number => v !== null && v !== undefined && !isNaN(v))
}

/**
 * 获取数组中的有效值索引
 */
export function getValidIndices(arr: (number | null | undefined)[]): number[] {
  return arr.reduce<number[]>((indices, v, i) => {
    if (v !== null && v !== undefined && !isNaN(v)) {
      indices.push(i)
    }
    return indices
  }, [])
}

/**
 * 检查值是否有效（非 null、非 undefined、非 NaN）
 */
export function isValid(value: number | null | undefined): value is number {
  return value !== null && value !== undefined && !isNaN(value)
}

/**
 * 安全获取数组值，返回 null 如果无效
 */
export function safeGet(arr: (number | null)[], index: number): number | null {
  if (index < 0 || index >= arr.length) return null
  const v = arr[index]
  return isValid(v) ? v : null
}

/**
 * 计算 NaN-aware 的最大值
 */
export function nanMax(arr: (number | null)[]): number {
  const valid = filterValidValues(arr)
  if (valid.length === 0) return NaN
  return Math.max(...valid)
}

/**
 * 计算 NaN-aware 的最小值
 */
export function nanMin(arr: (number | null)[]): number {
  const valid = filterValidValues(arr)
  if (valid.length === 0) return NaN
  return Math.min(...valid)
}

/**
 * 计算 NaN-aware 的平均值
 */
export function nanMean(arr: (number | null)[]): number {
  const valid = filterValidValues(arr)
  if (valid.length === 0) return NaN
  return valid.reduce((a, b) => a + b, 0) / valid.length
}

/**
 * 计算 NaN-aware 的标准差
 */
export function nanStd(arr: (number | null)[]): number {
  const valid = filterValidValues(arr)
  if (valid.length < 2) return NaN
  const mean = nanMean(valid)
  const squaredDiffs = valid.map(v => Math.pow(v - mean, 2))
  return Math.sqrt(squaredDiffs.reduce((a, b) => a + b, 0) / (valid.length - 1))
}

/**
 * 线性拟合 y = slope * x + intercept
 * 使用最小二乘法
 */
export function fitLine(x: number[], y: number[]): { slope: number; intercept: number } {
  const n = x.length
  if (n < 2) {
    return { slope: 0, intercept: n === 1 ? y[0] : 0 }
  }

  const sumX = x.reduce((a, b) => a + b, 0)
  const sumY = y.reduce((a, b) => a + b, 0)
  const sumXY = x.reduce((total, xi, i) => total + xi * y[i], 0)
  const sumX2 = x.reduce((total, xi) => total + xi * xi, 0)

  const denominator = n * sumX2 - sumX * sumX
  if (Math.abs(denominator) < 1e-10) {
    return { slope: 0, intercept: sumY / n }
  }

  const slope = (n * sumXY - sumX * sumY) / denominator
  const intercept = (sumY - slope * sumX) / n

  return { slope, intercept }
}

/**
 * 计算线上的 y 值
 */
export function lineY(slope: number, intercept: number, x: number): number {
  return slope * x + intercept
}

/**
 * 计算线上的 y 值数组
 */
export function lineYArray(slope: number, intercept: number, xArray: number[]): number[] {
  return xArray.map(x => lineY(slope, intercept, x))
}

/**
 * 混合枢轴点检测
 * 区分确认点和候选点
 *
 * @param high 最高价数组
 * @param low 最低价数组
 * @param k 标准窗口大小（左右各k天）
 * @param flexibleZone 灵活区域大小（最近几天使用降低标准）
 * @returns 枢轴点检测结果
 */
export function pivotsFractalHybrid(
  high: (number | null)[],
  low: (number | null)[],
  k: number = 15,
  flexibleZone: number = 5
): PivotsResult {
  const n = high.length

  // 确认枢轴点（完整窗口）
  const confirmedPh: number[] = []
  const confirmedPl: number[] = []

  for (let i = k; i < n - k; i++) {
    if (!isValid(high[i]) || !isValid(low[i])) continue

    // 检查是否为高点枢轴点
    let isHighPivot = true
    let isLowPivot = true

    for (let j = i - k; j <= i + k; j++) {
      if (!isValid(high[j]) || !isValid(low[j])) continue

      if (j !== i) {
        if (isValid(high[j]) && high[j]! > high[i]!) {
          isHighPivot = false
        }
        if (isValid(low[j]) && low[j]! < low[i]!) {
          isLowPivot = false
        }
      }
    }

    if (isHighPivot) confirmedPh.push(i)
    if (isLowPivot) confirmedPl.push(i)
  }

  // 候选枢轴点（灵活窗口，最近flexibleZone天）
  const candidatePh: number[] = []
  const candidatePl: number[] = []

  for (let i = Math.max(k, n - flexibleZone); i < n; i++) {
    if (!isValid(high[i]) || !isValid(low[i])) continue

    const rightAvail = n - 1 - i
    // 使用对称的短窗口
    const leftLook = Math.min(k, Math.max(rightAvail + 1, 3))
    const leftStart = Math.max(0, i - leftLook)
    const rightEnd = Math.min(n, i + rightAvail + 1)

    // 在对称窗口内检查是否为极值
    let isHighPivot = true
    let isLowPivot = true

    for (let j = leftStart; j < rightEnd; j++) {
      if (!isValid(high[j]) || !isValid(low[j])) continue

      if (j !== i) {
        if (high[j]! > high[i]!) isHighPivot = false
        if (low[j]! < low[i]!) isLowPivot = false
      }
    }

    if (isHighPivot) candidatePh.push(i)
    if (isLowPivot) candidatePl.push(i)
  }

  return {
    confirmedPh,
    confirmedPl,
    candidatePh,
    candidatePl,
  }
}

/**
 * 锚点法拟合枢轴点
 * 固定极值点，二分搜索最优斜率
 *
 * @param pivotIndices 枢轴点索引
 * @param pivotValues 枢轴点值
 * @param mode 'upper' 或 'lower'
 * @returns 拟合结果
 */
export function fitPivotLineAnchor(
  pivotIndices: number[],
  pivotValues: number[],
  mode: 'upper' | 'lower'
): FitLineResult {
  if (pivotIndices.length < 2) {
    if (pivotIndices.length === 1) {
      return {
        slope: 0,
        intercept: pivotValues[0],
        selectedIndices: [0],
      }
    }
    return { slope: 0, intercept: 0, selectedIndices: [] }
  }

  // 找锚点（极值点）
  let anchorIdx: number
  if (mode === 'upper') {
    // 上沿：找最高点
    anchorIdx = pivotValues.indexOf(Math.max(...pivotValues))
  } else {
    // 下沿：找最低点
    anchorIdx = pivotValues.indexOf(Math.min(...pivotValues))
  }

  const anchorX = pivotIndices[anchorIdx]
  const anchorY = pivotValues[anchorIdx]

  // 收集其他点
  const otherPoints: Array<{ idx: number; x: number; y: number }> = []
  for (let i = 0; i < pivotIndices.length; i++) {
    if (i !== anchorIdx) {
      otherPoints.push({
        idx: i,
        x: pivotIndices[i],
        y: pivotValues[i],
      })
    }
  }

  if (otherPoints.length === 0) {
    return {
      slope: 0,
      intercept: anchorY,
      selectedIndices: [anchorIdx],
    }
  }

  // 计算所有可能通过锚点的斜率
  const slopes = otherPoints.map(p => (p.y - anchorY) / (p.x - anchorX))

  // 对于上沿，找能包住所有点的最大斜率（最平坦的下降线）
  // 对于下沿，找能包住所有点的最小斜率（最平坦的上升线）
  let bestSlope: number

  if (mode === 'upper') {
    // 上沿应该下降或水平，斜率 <= 0
    // 找所有 <= 0 的斜率中最接近 0 的（绝对值最小）
    const validSlopes = slopes.filter(s => s <= 0)
    if (validSlopes.length > 0) {
      bestSlope = Math.max(...validSlopes)
    } else {
      // 所有斜率都是正的，取最小的正斜率
      bestSlope = Math.min(...slopes)
    }
  } else {
    // 下沿应该上升或水平，斜率 >= 0
    // 找所有 >= 0 的斜率中最接近 0 的
    const validSlopes = slopes.filter(s => s >= 0)
    if (validSlopes.length > 0) {
      bestSlope = Math.min(...validSlopes)
    } else {
      // 所有斜率都是负的，取最大的负斜率（最接近 0）
      bestSlope = Math.max(...slopes)
    }
  }

  // 计算截距（通过锚点）
  const intercept = anchorY - bestSlope * anchorX

  // 选出所有在拟合线附近的有效枢轴点
  const selectedIndices: number[] = [anchorIdx]
  const tolerance = 0.02 // 2% 容差

  for (let i = 0; i < pivotIndices.length; i++) {
    if (i === anchorIdx) continue

    const x = pivotIndices[i]
    const y = pivotValues[i]
    const lineY = bestSlope * x + intercept
    const diff = Math.abs(y - lineY) / lineY

    if (diff < tolerance) {
      selectedIndices.push(i)
    }
  }

  return {
    slope: bestSlope,
    intercept,
    selectedIndices: selectedIndices.sort((a, b) => a - b),
  }
}

/**
 * 检查收敛性
 * 上沿斜率 < 0，下沿斜率 > 0
 */
export function checkConvergence(
  upperSlope: number,
  lowerSlope: number,
  upperSlopeMax: number = 0,
  lowerSlopeMin: number = 0
): boolean {
  return upperSlope <= upperSlopeMax && lowerSlope >= lowerSlopeMin
}

/**
 * 计算宽度比率（收敛程度）
 */
export function calcWidthRatio(
  upperSlope: number,
  upperIntercept: number,
  lowerSlope: number,
  lowerIntercept: number,
  startIndex: number,
  endIndex: number
): number {
  const startWidth = Math.abs(
    (upperSlope * startIndex + upperIntercept) -
    (lowerSlope * startIndex + lowerIntercept)
  )
  const endWidth = Math.abs(
    (upperSlope * endIndex + upperIntercept) -
    (lowerSlope * endIndex + lowerIntercept)
  )

  if (startWidth < 1e-10) return 0
  return endWidth / startWidth
}

/**
 * 计算触碰次数
 */
export function calcTouches(
  pivotIndices: number[],
  pivotValues: number[],
  slope: number,
  intercept: number,
  tolerance: number = 0.03
): number {
  let touches = 0
  for (let i = 0; i < pivotIndices.length; i++) {
    const x = pivotIndices[i]
    const y = pivotValues[i]
    const lineY = slope * x + intercept
    const diff = Math.abs(y - lineY) / lineY
    if (diff < tolerance) {
      touches++
    }
  }
  return touches
}

/**
 * 归一化到 [0, 1] 范围
 */
export function normalize(value: number, min: number, max: number): number {
  if (max === min) return 0.5
  return Math.max(0, Math.min(1, (value - min) / (max - min)))
}

/**
 * Sigmoid 函数
 */
export function sigmoid(x: number): number {
  return 1 / (1 + Math.exp(-x))
}

/**
 * 计算 Z-Score
 */
export function zScore(value: number, mean: number, std: number): number {
  if (std < 1e-10) return 0
  return (value - mean) / std
}