<template>
  <div class="pattern-container">
    <el-row :gutter="20">
      <!-- 左侧：参数配置 -->
      <el-col :span="6">
        <el-card class="params-card">
          <template #header>
            <div class="card-header">
              <span>参数配置</span>
            </div>
          </template>

          <el-form :model="params" label-width="100px" size="small">
            <el-form-item label="检测窗口">
              <el-input-number v-model="params.window" :min="50" :max="500" :step="10" />
            </el-form-item>

            <el-form-item label="枢轴点K值">
              <el-input-number v-model="params.pivotK" :min="3" :max="30" :step="1" />
            </el-form-item>

            <el-form-item label="收敛比">
              <el-slider v-model="params.shrinkRatio" :min="0.5" :max="1" :step="0.05" show-input />
            </el-form-item>

            <el-form-item label="触碰容差">
              <el-slider v-model="params.touchTol" :min="0.01" :max="0.2" :step="0.01" show-input />
            </el-form-item>

            <el-form-item label="突破阈值">
              <el-slider v-model="params.breakTol" :min="0.001" :max="0.02" :step="0.001" show-input />
            </el-form-item>

            <el-form-item label="成交量窗口">
              <el-input-number v-model="params.volWindow" :min="5" :max="50" :step="1" />
            </el-form-item>

            <el-form-item label="放量倍数">
              <el-slider v-model="params.volK" :min="1" :max="3" :step="0.1" show-input />
            </el-form-item>

            <el-form-item>
              <el-button type="primary" @click="runDetection" :loading="loading">
                执行检测
              </el-button>
              <el-button @click="resetParams">重置参数</el-button>
            </el-form-item>
          </el-form>
        </el-card>
      </el-col>

      <!-- 右侧：检测结果 -->
      <el-col :span="18">
        <!-- 检测结果卡片 -->
        <el-card class="result-card" v-if="result">
          <template #header>
            <div class="card-header">
              <span>检测结果</span>
              <el-tag :type="result.isValid ? 'success' : 'danger'" size="small">
                {{ result.isValid ? '有效形态' : '无效形态' }}
              </el-tag>
            </div>
          </template>

          <el-descriptions :column="4" border size="small" v-if="result.isValid">
            <el-descriptions-item label="综合强度">
              <el-progress
                :percentage="Math.round(strength * 100)"
                :color="getStrengthColor(strength)"
              />
            </el-descriptions-item>
            <el-descriptions-item label="突破方向">
              <el-tag :type="getDirectionType(result.breakoutDir)" size="small">
                {{ getDirectionText(result.breakoutDir) }}
              </el-tag>
            </el-descriptions-item>
            <el-descriptions-item label="宽度比率">
              {{ result.widthRatio.toFixed(4) }}
            </el-descriptions-item>
            <el-descriptions-item label="触碰次数">
              上: {{ result.touchesUpper }} / 下: {{ result.touchesLower }}
            </el-descriptions-item>

            <el-descriptions-item label="价格分(上)">
              <el-progress :percentage="Math.round(result.priceScoreUp * 100)" :stroke-width="10" />
            </el-descriptions-item>
            <el-descriptions-item label="价格分(下)">
              <el-progress :percentage="Math.round(result.priceScoreDown * 100)" :stroke-width="10" />
            </el-descriptions-item>
            <el-descriptions-item label="收敛分">
              <el-progress :percentage="Math.round(result.convergenceScore * 100)" :stroke-width="10" />
            </el-descriptions-item>
            <el-descriptions-item label="成交量分">
              <el-progress :percentage="Math.round(result.volumeScore * 100)" :stroke-width="10" />
            </el-descriptions-item>

            <el-descriptions-item label="形态规则度">
              <el-progress :percentage="Math.round(result.geometryScore * 100)" :stroke-width="10" />
            </el-descriptions-item>
            <el-descriptions-item label="价格活跃度">
              <el-progress :percentage="Math.round(result.activityScore * 100)" :stroke-width="10" />
            </el-descriptions-item>
            <el-descriptions-item label="倾斜度">
              <el-progress :percentage="Math.round(result.tiltScore * 100)" :stroke-width="10" />
            </el-descriptions-item>
            <el-descriptions-item label="候选枢轴点">
              {{ result.candidatePivotCount }}
            </el-descriptions-item>

            <el-descriptions-item label="上沿斜率">
              {{ result.upperSlope.toFixed(6) }}
            </el-descriptions-item>
            <el-descriptions-item label="下沿斜率">
              {{ result.lowerSlope.toFixed(6) }}
            </el-descriptions-item>
            <el-descriptions-item label="上沿截距">
              {{ result.upperIntercept.toFixed(4) }}
            </el-descriptions-item>
            <el-descriptions-item label="下沿截距">
              {{ result.lowerIntercept.toFixed(4) }}
            </el-descriptions-item>
          </el-descriptions>

          <el-empty v-else description="未检测到有效收敛三角形形态" />
        </el-card>

        <!-- K线图表卡片 -->
        <el-card class="chart-card" style="margin-top: 20px;">
          <template #header>
            <div class="card-header">
              <span>K线图表</span>
              <div>
                <el-switch v-model="showPivots" active-text="显示枢轴点" inactive-text="隐藏枢轴点" style="margin-right: 10px;" />
                <el-switch v-model="showTrendLines" active-text="显示趋势线" inactive-text="隐藏趋势线" />
              </div>
            </div>
          </template>

          <div ref="chartRef" class="chart-container"></div>
        </el-card>
      </el-col>
    </el-row>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted, onUnmounted, watch, nextTick, shallowRef } from 'vue'
import * as echarts from 'echarts'
import type { ECharts, EChartsOption } from 'echarts'
import {
  detectConvergingTriangle,
  calcStrength,
  type ConvergingTriangleParams,
  type ConvergingTriangleResult,
  type KLineData,
  DEFAULT_PARAMS,
  lineY,
} from '@/utils/pattern'
import klineDataJson from '@/assets/kline_data.json'

// 参数
const params = reactive<Partial<ConvergingTriangleParams>>({
  window: 240,
  pivotK: 15,
  shrinkRatio: 0.8,
  touchTol: 0.10,
  breakTol: 0.001,
  volWindow: 20,
  volK: 1.3,
})

// 状态
const loading = ref(false)
const result = ref<ConvergingTriangleResult | null>(null)
const chartRef = ref<HTMLElement | null>(null)
const chartInstance = shallowRef<ECharts | null>(null)
const showPivots = ref(true)
const showTrendLines = ref(true)

// K线数据
const klineData = ref<KLineData>({
  dates: [],
  open: [],
  high: [],
  low: [],
  close: [],
  volume: [],
})

// 计算综合强度
const strength = computed(() => {
  if (!result.value?.isValid) return 0
  return calcStrength(result.value, 'equal')
})

// 加载数据
function loadKLineData() {
  const data = klineDataJson as any
  if (data.code === 0 && data.data) {
    klineData.value = {
      dates: data.data.labels || [],
      open: data.data.open || [],
      high: data.data.high || [],
      low: data.data.low || [],
      close: data.data.close || [],
      volume: data.data.volume || [],
    }
    console.log('[Pattern] K线数据加载成功', {
      length: klineData.value.close.length,
      sample: klineData.value.close.slice(0, 5),
    })
  }
}

// 执行检测
function runDetection() {
  loading.value = true

  try {
    result.value = detectConvergingTriangle(klineData.value, params)
    console.log('[Pattern] 检测结果', result.value)

    nextTick(() => {
      renderChart()
    })
  } catch (error) {
    console.error('[Pattern] 检测失败', error)
    result.value = null
  } finally {
    loading.value = false
  }
}

// 重置参数
function resetParams() {
  Object.assign(params, {
    window: DEFAULT_PARAMS.window,
    pivotK: DEFAULT_PARAMS.pivotK,
    shrinkRatio: DEFAULT_PARAMS.shrinkRatio,
    touchTol: DEFAULT_PARAMS.touchTol,
    breakTol: DEFAULT_PARAMS.breakTol,
    volWindow: DEFAULT_PARAMS.volWindow,
    volK: DEFAULT_PARAMS.volK,
  })
}

// 获取强度颜色
function getStrengthColor(value: number): string {
  if (value >= 0.7) return '#67c23a'
  if (value >= 0.5) return '#e6a23c'
  return '#f56c6c'
}

// 获取方向类型
function getDirectionType(dir: 'up' | 'down' | 'none'): '' | 'success' | 'danger' | 'warning' {
  if (dir === 'up') return 'success'
  if (dir === 'down') return 'danger'
  return 'warning'
}

// 获取方向文本
function getDirectionText(dir: 'up' | 'down' | 'none'): string {
  if (dir === 'up') return '向上突破'
  if (dir === 'down') return '向下突破'
  return '未突破'
}

// K线图配色主题（参考 TechPattern.vue）
const CHART_THEME = {
  bg: '#ffffff',
  gridBg: '#ffffff',
  text: '#333333',
  axisLine: '#cccccc',
  splitLine: '#eeeeee',
  up: '#ef5350',           // 阳线（红涨）
  down: '#26a69a',         // 阴线（绿跌）
  upBorder: '#ef5350',
  downBorder: '#26a69a',
  volumeUp: '#ef5350',
  volumeDown: '#26a69a',
  maColors: ['#ff9800', '#2196f3', '#9c27b0', '#00bcd4'],
  macdPos: '#ef5350',
  macdNeg: '#26a69a',
  macdDif: '#2196f3',
  macdDea: '#ff9800',
  tooltipBg: 'rgba(255,255,255,0.97)',
  tooltipBorder: '#dddddd',
  trackLine: '#ef4444',    // 上轨线颜色
  trackLineLower: '#10b981', // 下轨线颜色
}

// 计算 MA 均线
function calculateMA(data: number[], period: number) {
  const result = []
  for (let i = 0; i < data.length; i++) {
    if (i < period - 1) {
      result.push('-')
      continue
    }
    let sum = 0
    for (let j = 0; j < period; j++) {
      sum += Number(data[i - j] || 0)
    }
    result.push(+(sum / period).toFixed(4))
  }
  return result
}

// 计算 MACD
function calculateMACD(closes: number[], shortPeriod = 12, longPeriod = 26, signalPeriod = 9) {
  const getEMA = (data: number[], period: number) => {
    const k = 2 / (period + 1)
    const ema: number[] = []
    ema.push(data[0] || 0)
    for (let i = 1; i < data.length; i++) {
      if (data[i] === null || data[i] === undefined) {
        ema.push(ema[i - 1])
        continue
      }
      ema.push(data[i] * k + ema[i - 1] * (1 - k))
    }
    return ema
  }

  const emaShort = getEMA(closes, shortPeriod)
  const emaLong = getEMA(closes, longPeriod)

  const dif = []
  for (let i = 0; i < closes.length; i++) {
    dif.push(+(emaShort[i] - emaLong[i]).toFixed(4))
  }

  const dea = getEMA(dif, signalPeriod)

  const macd = []
  for (let i = 0; i < closes.length; i++) {
    macd.push(+((dif[i] - dea[i]) * 2).toFixed(4))
  }

  return { dif, dea, macd }
}

// 渲染图表
function renderChart() {
  if (!chartRef.value || !klineData.value.close.length) return

  const data = klineData.value
  const n = data.close.length

  // 过滤有效数据
  const validIndices: number[] = []
  const validClose: number[] = []
  const validOpen: number[] = []
  const validHigh: number[] = []
  const validLow: number[] = []
  const validVolume: (number | null)[] = []
  const validDates: string[] = []

  for (let i = 0; i < n; i++) {
    if (data.close[i] !== null && !isNaN(data.close[i]!)) {
      validIndices.push(i)
      validClose.push(data.close[i]!)
      validOpen.push(data.open[i] ?? data.close[i]!)
      validHigh.push(data.high[i] ?? data.close[i]!)
      validLow.push(data.low[i] ?? data.close[i]!)
      validVolume.push(data.volume[i] ?? null)
      // 格式化日期
      const dateStr = String(data.dates[i] || i)
      if (dateStr.length === 8) {
        validDates.push(`${dateStr.substring(0, 4)}-${dateStr.substring(4, 6)}-${dateStr.substring(6, 8)}`)
      } else {
        validDates.push(dateStr)
      }
    }
  }

  if (validDates.length === 0) return

  // K线数据 [开, 收, 最低, 最高]
  const candlestickData = validIndices.map((_, i) => [
    validOpen[i],
    validClose[i],
    validLow[i],
    validHigh[i],
  ])

  // 计算均线
  const ma5 = calculateMA(validClose, 5)
  const ma10 = calculateMA(validClose, 10)
  const ma20 = calculateMA(validClose, 20)
  const ma60 = calculateMA(validClose, 60)

  // 成交量均线
  const volMa5 = calculateMA(validVolume.filter((v): v is number => v != null), 5)
  const volMa10 = calculateMA(validVolume.filter((v): v is number => v != null), 10)

  // MACD
  const { dif, dea, macd: macdBar } = calculateMACD(validClose)

  // 成交量数据（带颜色）
  const volumeData = validVolume.map((vol, index) => ({
    value: vol,
    itemStyle: {
      color: validClose[index] >= validOpen[index] ? CHART_THEME.volumeUp : CHART_THEME.volumeDown
    }
  }))

  // MACD 数据（带颜色）
  const macdBarData = macdBar.map((val) => ({
    value: val,
    itemStyle: {
      color: val >= 0 ? CHART_THEME.macdPos : CHART_THEME.macdNeg
    }
  }))

  // 计算 dataZoom 初始位置
  const totalKLines = validDates.length
  const defaultDisplayCount = 200
  let dataZoomStart = 0
  let visibleStartIndex = 0
  if (totalKLines > defaultDisplayCount) {
    dataZoomStart = ((totalKLines - defaultDisplayCount) / totalKLines) * 100
    visibleStartIndex = totalKLines - defaultDisplayCount
  }

  // 收集可见区域内的价格点以计算 Y 轴范围
  const allPrices: number[] = []
  for (let i = visibleStartIndex; i < totalKLines; i++) {
    const lowVal = validLow[i]
    const highVal = validHigh[i]
    if (typeof lowVal === 'number' && !isNaN(lowVal)) allPrices.push(lowVal)
    if (typeof highVal === 'number' && !isNaN(highVal)) allPrices.push(highVal)
  }

  // 趋势线数据（markLine）
  const markLineData: any[] = []
  if (result.value?.isValid && showTrendLines.value) {
    const r = result.value
    const windowStart = r.windowStart
    const windowEnd = r.windowEnd

    // 计算趋势线在可见范围内的价格点
    const upperPrices: number[] = []
    const lowerPrices: number[] = []

    // 上沿线
    const upperLinePoints: any[] = []
    const lowerLinePoints: any[] = []

    for (let i = 0; i < validIndices.length; i++) {
      const absIdx = validIndices[i]
      const relIdx = absIdx - windowStart
      if (relIdx >= 0 && relIdx <= windowEnd - windowStart) {
        const upperPrice = lineY(r.upperSlope, r.upperIntercept, relIdx)
        const lowerPrice = lineY(r.lowerSlope, r.lowerIntercept, relIdx)

        upperLinePoints.push({ coord: [validDates[i], upperPrice] })
        lowerLinePoints.push({ coord: [validDates[i], lowerPrice] })

        if (i >= visibleStartIndex) {
          upperPrices.push(upperPrice)
          lowerPrices.push(lowerPrice)
        }
      }
    }

    if (upperLinePoints.length >= 2) {
      markLineData.push([
        { coord: upperLinePoints[0].coord, lineStyle: { color: CHART_THEME.trackLine, type: 'solid', width: 2 } },
        { coord: upperLinePoints[upperLinePoints.length - 1].coord }
      ])
      allPrices.push(...upperPrices)
    }
    if (lowerLinePoints.length >= 2) {
      markLineData.push([
        { coord: lowerLinePoints[0].coord, lineStyle: { color: CHART_THEME.trackLineLower, type: 'solid', width: 2 } },
        { coord: lowerLinePoints[lowerLinePoints.length - 1].coord }
      ])
      allPrices.push(...lowerPrices)
    }
  }

  // 如果可见范围内没有价格数据，使用全部数据作为兜底
  if (allPrices.length === 0) {
    allPrices.push(...validLow, ...validHigh)
  }

  const minPrice = Math.min(...allPrices)
  const maxPrice = Math.max(...allPrices)
  const priceRange = maxPrice - minPrice
  const yAxisMin = (minPrice - priceRange * 0.05).toFixed(2)
  const yAxisMax = (maxPrice + priceRange * 0.05).toFixed(2)

  // 取最后一个有效数据
  const lastMa5 = ma5[ma5.length - 1] === '-' ? '-' : Number(ma5[ma5.length - 1]).toFixed(2)
  const lastMa20 = ma20[ma20.length - 1] === '-' ? '-' : Number(ma20[ma20.length - 1]).toFixed(2)
  const lastMa60 = ma60[ma60.length - 1] === '-' ? '-' : Number(ma60[ma60.length - 1]).toFixed(2)

  // 构建图表配置
  const option: EChartsOption = {
    backgroundColor: CHART_THEME.bg,
    animation: false,
    title: [
      {
        text: `收敛三角形检测   MA5:${lastMa5}  MA20:${lastMa20}  MA60:${lastMa60}`,
        left: '9%',
        top: '2%',
        textStyle: { color: CHART_THEME.text, fontSize: 14, fontWeight: 'bold' }
      },
      {
        text: '成交量',
        left: '9%',
        top: '55%',
        textStyle: { color: CHART_THEME.text, fontSize: 11, fontWeight: 'bold' }
      },
      {
        text: 'MACD(12,26,9)',
        left: '9%',
        top: '73%',
        textStyle: { color: CHART_THEME.text, fontSize: 11, fontWeight: 'bold' }
      }
    ],
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'cross', crossStyle: { color: CHART_THEME.text } },
      backgroundColor: CHART_THEME.tooltipBg,
      borderColor: CHART_THEME.tooltipBorder,
      textStyle: { color: CHART_THEME.text },
      formatter: function (params: any) {
        if (!Array.isArray(params)) return ''
        let date = params[0]?.axisValue || ''
        let tooltipContent = ''
        params.forEach((item: any) => {
          if (item.seriesName === 'K线' && item.value && item.value.length >= 4) {
            tooltipContent += `<div style="margin-bottom: 8px;">`
            tooltipContent += `<div>开盘: <i style="color: ${CHART_THEME.maColors[0]};">${Number(item.value[1]).toFixed(2)}</i></div>`
            tooltipContent += `<div>收盘: <i style="color: ${CHART_THEME.maColors[0]};">${Number(item.value[2]).toFixed(2)}</i></div>`
            tooltipContent += `<div>最低: <i style="color: ${CHART_THEME.maColors[0]};">${Number(item.value[3]).toFixed(2)}</i></div>`
            tooltipContent += `<div>最高: <i style="color: ${CHART_THEME.maColors[0]};">${Number(item.value[4]).toFixed(2)}</i></div>`
            tooltipContent += `</div>`
          } else if (item.seriesName === '成交量') {
            let v = item.value
            let vStr = v >= 1e8 ? (v / 1e8).toFixed(2) + '亿' : (v >= 1e4 ? (v / 1e4).toFixed(2) + '万' : v)
            tooltipContent += `<div style="margin-top: 4px;"><b>成交量:</b> <i style="color: ${CHART_THEME.maColors[0]};">${vStr}</i></div>`
          } else if (item.seriesName.startsWith('MA') || item.seriesName.startsWith('VolMA')) {
            let v = item.value
            if (item.seriesName.startsWith('VolMA') && v !== '-') {
              v = v >= 1e8 ? (v / 1e8).toFixed(2) + '亿' : (v >= 1e4 ? (v / 1e4).toFixed(2) + '万' : v)
            }
            tooltipContent += `<div><span style="display:inline-block;width:10px;height:10px;background:${item.color};border-radius:50%;margin-right:5px;"></span>${item.seriesName}: <i style="color: ${CHART_THEME.maColors[0]};">${v}</i></div>`
          } else if (['MACD', 'DIF', 'DEA'].includes(item.seriesName)) {
            let v = Number(item.value).toFixed(4)
            tooltipContent += `<div><span style="display:inline-block;width:10px;height:10px;background:${item.color};border-radius:50%;margin-right:5px;"></span>${item.seriesName}: <i style="color: ${CHART_THEME.maColors[0]};">${v}</i></div>`
          }
        })
        return `<div style="font-size: 12px; font-family: sans-serif;">${date}<br/>${tooltipContent}</div>`
      }
    },
    axisPointer: { link: [{ xAxisIndex: 'all' }] },
    legend: {
      data: ['K线', 'MA5', 'MA10', 'MA20', 'MA60', '上沿', '下沿', '高点枢轴', '低点枢轴'],
      top: 30,
      textStyle: { color: CHART_THEME.text }
    },
    grid: [
      { left: '8%', right: '3%', top: '10%', height: '43%' },   // 主图
      { left: '8%', right: '3%', top: '56%', height: '14%' },  // 成交量
      { left: '8%', right: '3%', top: '74%', height: '16%' }   // MACD
    ],
    xAxis: [
      {
        type: 'category', data: validDates, gridIndex: 0, boundaryGap: true,
        axisLine: { lineStyle: { color: CHART_THEME.axisLine } },
        axisLabel: { show: false }, axisTick: { show: false }, splitLine: { show: false },
        axisPointer: { label: { show: false } }
      },
      {
        type: 'category', data: validDates, gridIndex: 1, boundaryGap: true,
        axisLine: { lineStyle: { color: CHART_THEME.axisLine } },
        axisLabel: { show: false }, axisTick: { show: false }, splitLine: { show: false },
        axisPointer: { label: { show: false } }
      },
      {
        type: 'category', data: validDates, gridIndex: 2, boundaryGap: true,
        axisLine: { lineStyle: { color: CHART_THEME.axisLine } },
        axisLabel: { color: CHART_THEME.text, fontSize: 11 }, splitLine: { show: false }
      }
    ],
    yAxis: [
      {
        type: 'value', scale: true, gridIndex: 0, splitNumber: 5,
        axisLine: { lineStyle: { color: CHART_THEME.axisLine } },
        axisLabel: { color: CHART_THEME.text, fontSize: 11 },
        splitLine: { lineStyle: { color: CHART_THEME.splitLine } },
        min: yAxisMin, max: yAxisMax
      },
      {
        type: 'value', scale: true, gridIndex: 1, splitNumber: 2,
        axisLine: { lineStyle: { color: CHART_THEME.axisLine } },
        axisLabel: {
          color: CHART_THEME.text, fontSize: 11,
          formatter: (value: number) => {
            if (value >= 1e8) return (value / 1e8).toFixed(1) + '亿'
            if (value >= 1e4) return (value / 1e4).toFixed(0) + '万'
            return String(value)
          }
        },
        splitLine: { lineStyle: { color: CHART_THEME.splitLine } }
      },
      {
        type: 'value', scale: true, gridIndex: 2, splitNumber: 3,
        axisLine: { lineStyle: { color: CHART_THEME.axisLine } },
        axisLabel: { color: CHART_THEME.text, fontSize: 11 },
        splitLine: { lineStyle: { color: CHART_THEME.splitLine } }
      }
    ],
    dataZoom: [
      { type: 'inside', xAxisIndex: [0, 1, 2], start: dataZoomStart, end: 100 },
      {
        type: 'slider', xAxisIndex: [0, 1, 2],
        backgroundColor: '#F2F5F9', fillerColor: '#BFCCE3', height: 13,
        start: dataZoomStart, end: 100, right: '3%', left: '8%', bottom: 4, borderColor: 'none',
        handleIcon: 'path://M30.9,53.2C16.8,53.2,5.3,41.7,5.3,27.6S16.8,2,30.9,2C45,2,56.4,13.5,56.4,27.6S45,53.2,30.9,53.2z M30.9,3.5M36.9,35.8h-1.3z M27.8,35.8 h-1.3H27L27.8,35.8L27.8,35.8z',
        handleSize: '200%',
        handleStyle: { color: '#BFCCE3', shadowBlur: 6, shadowColor: 'rgba(123, 154, 204, 0.5)', shadowOffsetX: 0, shadowOffsetY: 0 },
        textStyle: { fontStyle: 'italic' }, showDataShadow: false
      }
    ],
    series: [
      {
        name: 'K线', type: 'candlestick', xAxisIndex: 0, yAxisIndex: 0, data: candlestickData,
        itemStyle: { color: CHART_THEME.up, color0: CHART_THEME.down, borderColor: CHART_THEME.upBorder, borderColor0: CHART_THEME.downBorder },
        markLine: { symbol: ['none', 'none'], data: markLineData, lineStyle: { type: 'solid', width: 2 }, animation: false }
      },
      { name: 'MA5', type: 'line', data: ma5, smooth: false, symbol: 'none', lineStyle: { color: CHART_THEME.maColors[0], width: 1 }, xAxisIndex: 0, yAxisIndex: 0, z: 2 },
      { name: 'MA10', type: 'line', data: ma10, smooth: false, symbol: 'none', lineStyle: { color: CHART_THEME.maColors[1], width: 1 }, xAxisIndex: 0, yAxisIndex: 0, z: 2 },
      { name: 'MA20', type: 'line', data: ma20, smooth: false, symbol: 'none', lineStyle: { color: CHART_THEME.maColors[2], width: 1 }, xAxisIndex: 0, yAxisIndex: 0, z: 2 },
      { name: 'MA60', type: 'line', data: ma60, smooth: false, symbol: 'none', lineStyle: { color: CHART_THEME.maColors[3], width: 1 }, xAxisIndex: 0, yAxisIndex: 0, z: 2 },
      { name: '成交量', type: 'bar', xAxisIndex: 1, yAxisIndex: 1, data: volumeData, barMaxWidth: 40 },
      { name: 'VolMA5', type: 'line', data: volMa5, smooth: false, symbol: 'none', lineStyle: { color: '#b39ddb', width: 1 }, xAxisIndex: 1, yAxisIndex: 1, z: 2 },
      { name: 'VolMA10', type: 'line', data: volMa10, smooth: false, symbol: 'none', lineStyle: { color: '#ffcc02', width: 1 }, xAxisIndex: 1, yAxisIndex: 1, z: 2 },
      { name: 'MACD', type: 'bar', xAxisIndex: 2, yAxisIndex: 2, data: macdBarData, barMaxWidth: 6 },
      { name: 'DIF', type: 'line', data: dif, smooth: false, symbol: 'none', lineStyle: { color: CHART_THEME.macdDif, width: 1 }, xAxisIndex: 2, yAxisIndex: 2, z: 2 },
      { name: 'DEA', type: 'line', data: dea, smooth: false, symbol: 'none', lineStyle: { color: CHART_THEME.macdDea, width: 1 }, xAxisIndex: 2, yAxisIndex: 2, z: 2 }
    ]
  }

  // 添加枢轴点标记
  if (result.value?.isValid && showPivots.value) {
    const r = result.value
    const windowStart = r.windowStart

    // 高点枢轴点
    const upperPivotData = r.upperPivots.map(([relIdx, price]) => {
      const absIdx = relIdx + windowStart
      const dateIdx = validIndices.indexOf(absIdx)
      if (dateIdx >= 0) {
        return {
          value: [validDates[dateIdx], price],
          itemStyle: { color: CHART_THEME.trackLine }
        }
      }
      return null
    }).filter(Boolean)

    // 低点枢轴点
    const lowerPivotData = r.lowerPivots.map(([relIdx, price]) => {
      const absIdx = relIdx + windowStart
      const dateIdx = validIndices.indexOf(absIdx)
      if (dateIdx >= 0) {
        return {
          value: [validDates[dateIdx], price],
          itemStyle: { color: CHART_THEME.trackLineLower }
        }
      }
      return null
    }).filter(Boolean)

    if (upperPivotData.length > 0) {
      (option.series as any[]).push({
        name: '高点枢轴',
        type: 'scatter',
        data: upperPivotData,
        symbolSize: 10,
        symbol: 'triangle',
        xAxisIndex: 0,
        yAxisIndex: 0,
        z: 3
      })
    }
    if (lowerPivotData.length > 0) {
      (option.series as any[]).push({
        name: '低点枢轴',
        type: 'scatter',
        data: lowerPivotData,
        symbolSize: 10,
        symbol: 'triangle',
        symbolRotate: 180,
        xAxisIndex: 0,
        yAxisIndex: 0,
        z: 3
      })
    }
  }

  // 初始化或更新图表
  if (!chartInstance.value) {
    chartInstance.value = echarts.init(chartRef.value)
  }
  console.log('🍨🍨🍨[Pattern] 渲染图表', { option })
  chartInstance.value.setOption(option, { replaceMerge: ['series'] })
}

// 监听显示选项变化
watch([showPivots, showTrendLines], () => {
  if (result.value) {
    renderChart()
  }
})

// 窗口 resize 处理
const handleResize = () => {
  chartInstance.value?.resize({ animation: { duration: 300 } })
}

// 初始化
onMounted(() => {
  loadKLineData()
  // 自动执行一次检测
  runDetection()
  window.addEventListener('resize', handleResize)
})

onUnmounted(() => {
  chartInstance.value?.dispose()
  window.removeEventListener('resize', handleResize)
})
</script>

<style scoped lang="scss">
.pattern-container {
  padding: 20px;
}

.params-card,
.result-card,
.chart-card {
  .card-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
}

.chart-container {
  width: 100%;
  height: 600px;
  background: #fff;
}

:deep(.el-descriptions__label) {
  width: 100px;
}

:deep(.el-progress) {
  width: 100%;
}
</style>