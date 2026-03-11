/**
 * 测试收敛三角形检测算法
 * 运行方式: npx tsx test-detection.ts
 */

import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// 导入检测函数
import { detectConvergingTriangle } from './src/utils/pattern/convergingTriangle.js'
import type { KLineData, ConvergingTriangleParams } from './src/utils/pattern/types.js'

// 读取数据
const dataPath = join(__dirname, 'src/assets/kline_data.json')
const rawData = JSON.parse(readFileSync(dataPath, 'utf-8'))

const klineData: KLineData = {
  open: rawData.data.open,
  high: rawData.data.high,
  low: rawData.data.low,
  close: rawData.data.close,
  volume: rawData.data.volume,
}

console.log('数据长度:', klineData.close.length)

// 执行检测
const result = detectConvergingTriangle(klineData)

console.log('\n=== 收敛三角形检测结果 ===')
console.log('isValid:', result.isValid)

if (result.isValid) {
  console.log('\n【分数维度】')
  console.log('  priceScoreUp:', result.priceScoreUp.toFixed(4))
  console.log('  priceScoreDown:', result.priceScoreDown.toFixed(4))
  console.log('  convergenceScore:', result.convergenceScore.toFixed(4))
  console.log('  volumeScore:', result.volumeScore.toFixed(4))
  console.log('  geometryScore:', result.geometryScore.toFixed(4))
  console.log('  activityScore:', result.activityScore.toFixed(4))
  console.log('  tiltScore:', result.tiltScore.toFixed(4))

  console.log('\n【综合强度】')
  console.log('  breakoutStrengthUp:', result.breakoutStrengthUp.toFixed(4))
  console.log('  breakoutStrengthDown:', result.breakoutStrengthDown.toFixed(4))

  console.log('\n【趋势线参数】')
  console.log('  upperSlope:', result.upperSlope.toFixed(6), '  upperIntercept:', result.upperIntercept.toFixed(6))
  console.log('  lowerSlope:', result.lowerSlope.toFixed(6), '  lowerIntercept:', result.lowerIntercept.toFixed(6))

  console.log('\n【形态特征】')
  console.log('  widthRatio:', result.widthRatio.toFixed(4))
  console.log('  touchesUpper:', result.touchesUpper, '  touchesLower:', result.touchesLower)
  console.log('  apexX:', result.apexX.toFixed(2))
  console.log('  breakoutDir:', result.breakoutDir)
  console.log('  upperPivots:', JSON.stringify(result.upperPivots))
  console.log('  lowerPivots:', JSON.stringify(result.lowerPivots))
  console.log('  windowStart:', result.windowStart, '  windowEnd:', result.windowEnd)
  console.log('  volumeConfirmed:', result.volumeConfirmed)
}
console.log('=========================')