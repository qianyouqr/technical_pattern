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
            <el-form-item label="股票搜索">
              <div class="asset-search-block">
                <el-autocomplete
                  v-model="assetSearchKeyword"
                  class="asset-search-input"
                  clearable
                  :fetch-suggestions="fetchAssetSuggestions"
                  :trigger-on-focus="false"
                  placeholder="请输入股票代码或名称"
                  @input="handleAssetSearchInput"
                  @select="handleAssetSelect"
                >
                  <template #default="{ item }">
                    <div class="asset-search-item">
                      <span class="asset-search-item__name">{{ item.name }}</span>
                      <span class="asset-search-item__meta">{{ item.ticker }} / {{ item.code }}</span>
                    </div>
                  </template>
                </el-autocomplete>

                <div class="asset-search-status">
                  <span v-if="selectedAsset" class="asset-search-status__selected">
                    当前标的：{{ selectedAsset.name }}（{{ selectedAsset.ticker }}）
                  </span>
                  <span v-else class="text-muted">当前使用本地示例数据</span>
                  <span v-if="searchLoading" class="asset-search-status__hint">搜索中...</span>
                  <span v-if="assetLoading" class="asset-search-status__hint">正在加载 K 线数据...</span>
                </div>
              </div>
            </el-form-item>

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

            <el-divider content-position="left">形态识别参数</el-divider>

            <el-form-item label="最小天数">
              <el-input-number v-model="params.minPatternDays" :min="10" :max="40" :step="5" />
            </el-form-item>

            <el-form-item label="最大天数">
              <el-input-number v-model="params.maxPatternDays" :min="40" :max="120" :step="10" />
            </el-form-item>

            <el-form-item label="冷却期">
              <el-input-number v-model="params.cooldownDays" :min="5" :max="30" :step="5" />
            </el-form-item>

            <el-form-item label="确认窗口">
              <el-input-number v-model="params.confirmWindow" :min="1" :max="10" :step="1" />
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
        <!-- 多形态检测结果卡片 -->
        <el-card class="multi-pattern-card" v-if="multiPatternResult">
          <template #header>
            <div class="card-header">
              <span>历史形态检测 (共 {{ multiPatternResult.totalCount }} 个形态，{{ multiPatternResult.validBreakouts }} 个有效突破)</span>
            </div>
          </template>

          <div v-if="multiPatternResult.patterns.length > 0" class="pattern-list">
            <el-table :data="multiPatternResult.patterns" stripe size="small" max-height="300" highlight-current-row @current-change="handlePatternSelect">
              <el-table-column type="index" label="#" width="50" />
              <el-table-column label="形态区间" min-width="180">
                <template #default="{ row }">
                  <span>{{ formatDate(row.patternStartDate) }} ~ {{ formatDate(row.patternEndDate) }}</span>
                </template>
              </el-table-column>
              <el-table-column label="突破日" width="120">
                <template #default="{ row }">
                  <span v-if="row.breakoutDate">{{ formatDate(row.breakoutDate) }}</span>
                  <span v-else class="text-muted">-</span>
                </template>
              </el-table-column>
              <el-table-column label="突破方向" width="100">
                <template #default="{ row }">
                  <el-tag :type="getDirectionType(row.breakoutDir)" size="small">
                    {{ getDirectionText(row.breakoutDir) }}
                  </el-tag>
                </template>
              </el-table-column>
              <el-table-column label="是否确认" width="90">
                <template #default="{ row }">
                  <el-tag :type="row.breakoutConfirmed ? 'success' : 'warning'" size="small">
                    {{ row.breakoutConfirmed ? '已确认' : '待确认' }}
                  </el-tag>
                </template>
              </el-table-column>
              <el-table-column label="确认天数" width="80">
                <template #default="{ row }">
                  <span>{{ row.breakoutConfirmDays || 0 }} 天</span>
                </template>
              </el-table-column>
              <el-table-column label="突破价格" width="100">
                <template #default="{ row }">
                  <span v-if="row.breakoutPrice">{{ row.breakoutPrice.toFixed(2) }}</span>
                  <span v-else class="text-muted">-</span>
                </template>
              </el-table-column>
              <el-table-column label="综合强度" width="120">
                <template #default="{ row }">
                  <el-progress
                    :percentage="Math.round(calcPatternStrength(row) * 100)"
                    :color="getStrengthColor(calcPatternStrength(row))"
                    :stroke-width="10"
                  />
                </template>
              </el-table-column>
            </el-table>
          </div>
          <el-empty v-else description="未检测到有效的收敛三角形形态" />
        </el-card>

        <!-- 检测结果卡片 -->
        <el-card class="result-card" v-if="result" style="margin-top: 20px;">
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
                <el-switch v-model="showLatestTrendLines" active-text="最近趋势线" inactive-text="隐藏最近" style="margin-right: 10px;" />
                <el-switch v-model="showHistoryTrendLines" active-text="历史趋势线" inactive-text="隐藏历史" />
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
import { ElMessage } from 'element-plus'
import type { AutocompleteFetchSuggestionsCallback } from 'element-plus'
import {
  searchSmartStockAssets,
  getKLineDataByTicker,
  mapKLineResponseToPatternData,
  type SmartStockAssetSearchItem,
} from '@/api'
import {
  detectConvergingTriangle,
  detectMultiPatterns,
  calcStrength,
  type ConvergingTriangleParams,
  type ConvergingTriangleResult,
  type KLineData,
  type MultiPatternResult,
  DEFAULT_PARAMS,
  lineY,
} from '@/utils/pattern'
import klineDataJson from '@/assets/kline_data.json'

type ChartZoomRange = {
  start: number
  end: number
}

type ChartYAxisContext = {
  totalKLines: number
  validLow: number[]
  validHigh: number[]
  maSeries: Array<Array<number | string>>
  extraValuesByIndex: number[][]
}

type AssetSearchSuggestion = SmartStockAssetSearchItem & {
  value: string
}

// 参数
const params = reactive<Partial<ConvergingTriangleParams>>({
  window: 240,
  pivotK: 15,
  shrinkRatio: 0.8,
  touchTol: 0.10,
  breakTol: 0.001,
  volWindow: 20,
  volK: 1.3,
  // 新增参数
  minPatternDays: 20,
  maxPatternDays: 60,
  cooldownDays: 15,
  confirmWindow: 3,
  confirmRatio: 0.6,
})

// 状态
const loading = ref(false)
const result = ref<ConvergingTriangleResult | null>(null)
const multiPatternResult = ref<MultiPatternResult | null>(null)
const chartRef = ref<HTMLElement | null>(null)
const chartInstance = shallowRef<ECharts | null>(null)
const showPivots = ref(true)
const showLatestTrendLines = ref(true)  // 最近一个形态的趋势线
const showHistoryTrendLines = ref(true)  // 历史形态的趋势线
const activePatternIndex = ref<number>(0) // 当前选中的形态索引
const chartZoomRange = ref<ChartZoomRange | null>(null)
const chartYAxisContext = shallowRef<ChartYAxisContext | null>(null)
const assetSearchKeyword = ref('')
const searchLoading = ref(false)
const assetLoading = ref(false)
const selectedAsset = ref<SmartStockAssetSearchItem | null>(null)
let assetSearchRequestId = 0
let assetDataRequestId = 0

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

function normalizeTradingKlineData(data: KLineData): KLineData {
  const normalized: KLineData = {
    dates: [],
    open: [],
    high: [],
    low: [],
    close: [],
    volume: [],
  }

  for (let i = 0; i < data.close.length; i++) {
    const close = data.close[i]
    if (close === null || close === undefined || Number.isNaN(close)) {
      continue
    }

    normalized.dates.push(data.dates[i])
    normalized.open.push(data.open[i])
    normalized.high.push(data.high[i])
    normalized.low.push(data.low[i])
    normalized.close.push(close)
    normalized.volume.push(data.volume[i] ?? null)
  }

  return normalized
}

function fetchAssetSuggestions(
  queryString: string,
  cb: AutocompleteFetchSuggestionsCallback,
): void {
  const keyword = queryString.trim()
  if (!keyword) {
    searchLoading.value = false
    cb([])
    return
  }

  const requestId = ++assetSearchRequestId
  searchLoading.value = true

  searchSmartStockAssets({ q: keyword, limit: 10 })
    .then((response) => {
      if (requestId !== assetSearchRequestId) return

      const suggestions: AssetSearchSuggestion[] = (response.items || []).map(item => ({
        ...item,
        value: `${item.name}（${item.ticker}）`,
      }))

      cb(suggestions)
    })
    .catch((error) => {
      if (requestId !== assetSearchRequestId) return
      console.error('[Pattern] 股票搜索失败', error)
      cb([])
    })
    .finally(() => {
      if (requestId === assetSearchRequestId) {
        searchLoading.value = false
      }
    })
}

function handleAssetSearchInput(value: string | number) {
  if (!String(value ?? '').trim()) {
    assetSearchRequestId += 1
    searchLoading.value = false
  }
}

async function handleAssetSelect(item: Record<string, any>) {
  const selected = item as AssetSearchSuggestion
  const requestId = ++assetDataRequestId
  assetSearchRequestId += 1
  searchLoading.value = false
  assetLoading.value = true

  try {
    const response = await getKLineDataByTicker({ ticker: selected.ticker })
    if (requestId !== assetDataRequestId) return

    const remoteData = normalizeTradingKlineData(mapKLineResponseToPatternData(response))

    if (!remoteData.close.length) {
      ElMessage.warning('未获取到可用的 K 线数据')
      return
    }

    selectedAsset.value = selected
    assetSearchKeyword.value = selected.value
    klineData.value = remoteData
    runDetection()
  } catch (error) {
    if (requestId !== assetDataRequestId) return
    console.error('[Pattern] K线数据加载失败', error)
  } finally {
    if (requestId === assetDataRequestId) {
      assetLoading.value = false
    }
  }
}

// 加载数据
function loadKLineData() {
  const data = klineDataJson as any
  if (data.code === 0 && data.data) {
    const rawKLineData: KLineData = {
      dates: data.data.labels || [],
      open: data.data.open || [],
      high: data.data.high || [],
      low: data.data.low || [],
      close: data.data.close || [],
      volume: data.data.volume || [],
    }

    klineData.value = normalizeTradingKlineData(rawKLineData)
    console.log('[Pattern] K线数据加载成功', {
      rawLength: rawKLineData.close.length,
      tradingLength: klineData.value.close.length,
      removedLength: rawKLineData.close.length - klineData.value.close.length,
      sample: klineData.value.close.slice(0, 5),
    })
  }
}

// 执行检测
function runDetection() {
  loading.value = true

  try {
    // 检测最近一个形态（用于图表显示）
    result.value = detectConvergingTriangle(klineData.value, params)
    console.log('[Pattern] 检测结果', result.value)

    // 检测所有历史形态
    multiPatternResult.value = detectMultiPatterns(klineData.value, params)
    console.log('[Pattern] 多形态检测结果', multiPatternResult.value)

    // 如果有多个形态，默认选中最近一个
    if (multiPatternResult.value.patterns.length > 0) {
      activePatternIndex.value = multiPatternResult.value.patterns.length - 1
    }

    nextTick(() => {
      renderChart()
    })
  } catch (error) {
    console.error('[Pattern] 检测失败', error)
    result.value = null
    multiPatternResult.value = null
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
    // 新增参数
    minPatternDays: DEFAULT_PARAMS.minPatternDays,
    maxPatternDays: DEFAULT_PARAMS.maxPatternDays,
    cooldownDays: DEFAULT_PARAMS.cooldownDays,
    confirmWindow: DEFAULT_PARAMS.confirmWindow,
    confirmRatio: DEFAULT_PARAMS.confirmRatio,
  })
}

// 获取强度颜色
function getStrengthColor(value: number): string {
  if (value >= 0.7) return '#67c23a'
  if (value >= 0.5) return '#e6a23c'
  return '#f56c6c'
}

// 获取方向类型
function getDirectionType(dir: 'up' | 'down' | 'none'): 'success' | 'danger' | 'warning' {
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

// 格式化日期
function formatDate(date: number | null): string {
  if (!date) return '-'
  const dateStr = String(date)
  if (dateStr.length === 8) {
    return `${dateStr.substring(0, 4)}-${dateStr.substring(4, 6)}-${dateStr.substring(6, 8)}`
  }
  return dateStr
}

// 计算形态强度
function calcPatternStrength(pattern: ConvergingTriangleResult): number {
  if (!pattern.isValid) return 0
  return calcStrength(pattern, 'equal')
}

// 选择形态（表格行点击）
function handlePatternSelect(row: ConvergingTriangleResult | null) {
  if (row) {
    const index = multiPatternResult.value?.patterns.indexOf(row) ?? -1
    activePatternIndex.value = index
    // 可以在这里添加跳转到对应K线区域的逻辑
    console.log('[Pattern] 选中形态', index, row)
  }
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

function pushFiniteNumbers(target: number[], ...values: unknown[]) {
  values.forEach((value) => {
    if (value === '-' || value === null || value === undefined) return
    const num = Number(value)
    if (Number.isFinite(num)) {
      target.push(num)
    }
  })
}

function getVisibleIndexRange(total: number, start: number, end: number) {
  if (total <= 0) {
    return { startIndex: 0, endIndex: 0 }
  }

  const safeStart = Math.min(Math.max(start, 0), 100)
  const safeEnd = Math.min(Math.max(end, safeStart), 100)
  const startIndex = Math.floor((safeStart / 100) * Math.max(total - 1, 0))
  const endIndex = Math.max(startIndex, Math.ceil((safeEnd / 100) * total) - 1)

  return {
    startIndex,
    endIndex: Math.min(endIndex, total - 1),
  }
}

function getYAxisRange(prices: number[]) {
  if (!prices.length) {
    return { min: 0, max: 1 }
  }

  const minPrice = Math.min(...prices)
  const maxPrice = Math.max(...prices)
  const padding = maxPrice === minPrice
    ? Math.max(Math.abs(maxPrice) * 0.02, 0.5)
    : (maxPrice - minPrice) * 0.05

  return {
    min: +(minPrice - padding).toFixed(2),
    max: +(maxPrice + padding).toFixed(2),
  }
}

function collectYAxisPrices(context: ChartYAxisContext, range: ChartZoomRange) {
  const prices: number[] = []

  const collectByIndexRange = (startIndex: number, endIndex: number) => {
    for (let i = startIndex; i <= endIndex; i++) {
      pushFiniteNumbers(prices, context.validLow[i], context.validHigh[i], ...context.extraValuesByIndex[i])
      context.maSeries.forEach((series) => {
        pushFiniteNumbers(prices, series[i])
      })
    }
  }

  const { startIndex, endIndex } = getVisibleIndexRange(context.totalKLines, range.start, range.end)
  collectByIndexRange(startIndex, endIndex)

  if (!prices.length) {
    collectByIndexRange(0, Math.max(context.totalKLines - 1, 0))
  }

  return prices
}

function getCurrentZoomRange(payload?: any): ChartZoomRange | null {
  const zoomPayload = Array.isArray(payload?.batch) ? payload.batch[0] : payload
  const optionZoom = chartInstance.value?.getOption()?.dataZoom as Array<{ start?: number; end?: number }> | undefined
  const firstZoom = optionZoom?.[0]

  const start = Number(zoomPayload?.start ?? firstZoom?.start ?? chartZoomRange.value?.start ?? 0)
  const rawEnd = Number(zoomPayload?.end ?? firstZoom?.end ?? chartZoomRange.value?.end ?? 100)

  if (!Number.isFinite(start) || !Number.isFinite(rawEnd)) {
    return null
  }

  const safeStart = Math.min(Math.max(start, 0), 100)
  const safeEnd = Math.min(Math.max(rawEnd, safeStart), 100)

  return {
    start: safeStart,
    end: safeEnd,
  }
}

function updateVisibleYAxis(range: ChartZoomRange | null = chartZoomRange.value) {
  if (!chartInstance.value || !chartYAxisContext.value) return

  const nextRange = range ?? { start: 0, end: 100 }
  const prices = collectYAxisPrices(chartYAxisContext.value, nextRange)
  const { min, max } = getYAxisRange(prices)

  chartInstance.value.setOption({
    yAxis: [{ min, max }]
  })
}

function handleChartDataZoom(event?: any) {
  const nextRange = getCurrentZoomRange(event)
  if (!nextRange) return

  chartZoomRange.value = nextRange
  updateVisibleYAxis(nextRange)
}

// 渲染图表
function renderChart() {
  if (!chartRef.value || !klineData.value.close.length) return

  const data = klineData.value
  const n = data.close.length

  const validIndices = Array.from({ length: n }, (_, index) => index)
  const validClose = data.close.map(value => value ?? 0)
  const validOpen = data.open.map((value, index) => value ?? validClose[index])
  const validHigh = data.high.map((value, index) => value ?? validClose[index])
  const validLow = data.low.map((value, index) => value ?? validClose[index])
  const validVolume = data.volume.map(value => value ?? null)
  const validDates = data.dates.map((date, index) => {
    const dateStr = String(date || index)
    if (dateStr.length === 8) {
      return `${dateStr.substring(0, 4)}-${dateStr.substring(4, 6)}-${dateStr.substring(6, 8)}`
    }
    return dateStr
  })

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
  const defaultZoomRange: ChartZoomRange = { start: 0, end: 100 }
  if (totalKLines > defaultDisplayCount) {
    defaultZoomRange.start = ((totalKLines - defaultDisplayCount) / totalKLines) * 100
  }
  const currentZoomStart = Math.min(Math.max(chartZoomRange.value?.start ?? defaultZoomRange.start, 0), 100)
  const currentZoomRange: ChartZoomRange = {
    start: currentZoomStart,
    end: Math.min(Math.max(chartZoomRange.value?.end ?? defaultZoomRange.end, currentZoomStart), 100),
  }
  const extraValuesByIndex = Array.from({ length: totalKLines }, () => [] as number[])

  // 趋势线数据（markLine）- 最近一个形态
  const markLineData: any[] = []
  if (result.value?.isValid && showLatestTrendLines.value) {
    const r = result.value
    const windowStart = r.windowStart
    const windowEnd = r.windowEnd

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
        pushFiniteNumbers(extraValuesByIndex[i], upperPrice, lowerPrice)
      }
    }

    if (upperLinePoints.length >= 2) {
      markLineData.push([
        { coord: upperLinePoints[0].coord, lineStyle: { color: CHART_THEME.trackLine, type: 'solid', width: 2 } },
        { coord: upperLinePoints[upperLinePoints.length - 1].coord }
      ])
    }
    if (lowerLinePoints.length >= 2) {
      markLineData.push([
        { coord: lowerLinePoints[0].coord, lineStyle: { color: CHART_THEME.trackLineLower, type: 'solid', width: 2 } },
        { coord: lowerLinePoints[lowerLinePoints.length - 1].coord }
      ])
    }
  }

  // 生成所有历史形态的趋势线数据
  const allPatternSeries: any[] = []
  const patternMarkAreas: any[] = []
  const breakoutMarkers: any[] = []

  if (multiPatternResult.value?.patterns?.length && showHistoryTrendLines.value) {
    multiPatternResult.value.patterns.forEach((pattern, pIndex) => {
      if (!pattern.isValid) return

      const startIdx = validIndices.indexOf(pattern.windowStart)
      const endIdx = validIndices.indexOf(pattern.windowEnd)

      if (startIdx < 0 || endIdx < 0) return

      // 生成趋势线数据点
      const upperLineData: any[] = []
      const lowerLineData: any[] = []

      for (let i = startIdx; i <= endIdx; i++) {
        const relIdx = validIndices[i] - pattern.windowStart
        const upperPrice = lineY(pattern.upperSlope, pattern.upperIntercept, relIdx)
        const lowerPrice = lineY(pattern.lowerSlope, pattern.lowerIntercept, relIdx)
        upperLineData.push([validDates[i], upperPrice])
        lowerLineData.push([validDates[i], lowerPrice])
        pushFiniteNumbers(extraValuesByIndex[i], upperPrice, lowerPrice)
      }

      // 上沿趋势线
      if (upperLineData.length >= 2) {
        allPatternSeries.push({
          name: `形态${pIndex + 1}上沿`,
          type: 'line',
          data: upperLineData,
          showSymbol: false,
          lineStyle: {
            color: pattern.breakoutDir === 'up' ? '#22c55e' : '#ef4444',
            width: 1.5,
            type: 'dashed'
          },
          xAxisIndex: 0,
          yAxisIndex: 0,
          z: 2
        })
      }

      // 下沿趋势线
      if (lowerLineData.length >= 2) {
        allPatternSeries.push({
          name: `形态${pIndex + 1}下沿`,
          type: 'line',
          data: lowerLineData,
          showSymbol: false,
          lineStyle: {
            color: pattern.breakoutDir === 'down' ? '#22c55e' : '#3b82f6',
            width: 1.5,
            type: 'dashed'
          },
          xAxisIndex: 0,
          yAxisIndex: 0,
          z: 2
        })
      }

      // 形态区间背景
      patternMarkAreas.push([
        { xAxis: validDates[startIdx] },
        { xAxis: validDates[endIdx] }
      ])

      // 突破日标记
      if (pattern.breakoutDay !== null) {
        const breakoutIdx = validIndices.indexOf(pattern.breakoutDay)
        if (breakoutIdx >= 0 && pattern.breakoutPrice !== null) {
          breakoutMarkers.push({
            value: [validDates[breakoutIdx], pattern.breakoutPrice],
            symbol: pattern.breakoutDir === 'up' ? 'triangle' : 'diamond',
            symbolSize: 14,
            itemStyle: {
              color: pattern.breakoutConfirmed ? '#22c55e' : '#f59e0b',
              borderColor: '#fff',
              borderWidth: 1
            }
          })
          pushFiniteNumbers(extraValuesByIndex[breakoutIdx], pattern.breakoutPrice)
        }
      }
    })
  }

  const upperPivotData: any[] = []
  const lowerPivotData: any[] = []
  if (result.value?.isValid && showPivots.value) {
    const r = result.value
    const windowStart = r.windowStart

    r.upperPivots.forEach(([relIdx, price]) => {
      const absIdx = relIdx + windowStart
      const dateIdx = validIndices.indexOf(absIdx)
      if (dateIdx >= 0) {
        upperPivotData.push({
          value: [validDates[dateIdx], price],
          itemStyle: { color: CHART_THEME.trackLine }
        })
        pushFiniteNumbers(extraValuesByIndex[dateIdx], price)
      }
    })

    r.lowerPivots.forEach(([relIdx, price]) => {
      const absIdx = relIdx + windowStart
      const dateIdx = validIndices.indexOf(absIdx)
      if (dateIdx >= 0) {
        lowerPivotData.push({
          value: [validDates[dateIdx], price],
          itemStyle: { color: CHART_THEME.trackLineLower }
        })
        pushFiniteNumbers(extraValuesByIndex[dateIdx], price)
      }
    })
  }

  const yAxisContext: ChartYAxisContext = {
    totalKLines,
    validLow,
    validHigh,
    maSeries: [ma5, ma10, ma20, ma60],
    extraValuesByIndex,
  }
  const { min: yAxisMin, max: yAxisMax } = getYAxisRange(collectYAxisPrices(yAxisContext, currentZoomRange))

  // 取最后一个有效数据
  const lastMa5 = ma5[ma5.length - 1] === '-' ? '-' : Number(ma5[ma5.length - 1]).toFixed(2)
  const lastMa20 = ma20[ma20.length - 1] === '-' ? '-' : Number(ma20[ma20.length - 1]).toFixed(2)
  const lastMa60 = ma60[ma60.length - 1] === '-' ? '-' : Number(ma60[ma60.length - 1]).toFixed(2)
  console.log('allPatternSeries=',allPatternSeries)
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
      { type: 'inside', xAxisIndex: [0, 1, 2], start: currentZoomRange.start, end: currentZoomRange.end },
      {
        type: 'slider', xAxisIndex: [0, 1, 2],
        backgroundColor: '#F2F5F9', fillerColor: '#BFCCE3', height: 13,
        start: currentZoomRange.start, end: currentZoomRange.end, right: '3%', left: '8%', bottom: 4, borderColor: 'none',
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
        markLine: { symbol: ['none', 'none'], data: markLineData, lineStyle: { type: 'solid', width: 2 }, animation: false },
        // 形态区间背景
        markArea: patternMarkAreas.length > 0 ? {
          data: patternMarkAreas,
          itemStyle: {
            color: 'rgba(100, 149, 237, 0.06)',
            borderColor: 'rgba(100, 149, 237, 0.3)',
            borderWidth: 1,
            borderType: 'dashed'
          }
        } : undefined
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
      { name: 'DEA', type: 'line', data: dea, smooth: false, symbol: 'none', lineStyle: { color: CHART_THEME.macdDea, width: 1 }, xAxisIndex: 2, yAxisIndex: 2, z: 2 },
      // 所有历史形态的趋势线
      ...allPatternSeries,
      // 突破日标记
      ...(breakoutMarkers.length > 0 ? [{
        name: '突破点',
        type: 'scatter',
        data: breakoutMarkers,
        xAxisIndex: 0,
        yAxisIndex: 0,
        z: 5
      }] : [])
    ]
  }

  // 添加枢轴点标记
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

  chartZoomRange.value = currentZoomRange
  chartYAxisContext.value = yAxisContext

  // 初始化或更新图表
  if (!chartInstance.value) {
    chartInstance.value = echarts.init(chartRef.value)
    chartInstance.value.on('datazoom', handleChartDataZoom)
  } else {
    chartInstance.value.off('datazoom', handleChartDataZoom)
    chartInstance.value.on('datazoom', handleChartDataZoom)
  }
  console.log('🍨🍨🍨[Pattern] 渲染图表', {
    patternCount: multiPatternResult.value?.patterns?.length || 0,
    trendLineCount: allPatternSeries.length
  })
  chartInstance.value.setOption(option, { replaceMerge: ['series'] })
  updateVisibleYAxis(currentZoomRange)
}

// 监听显示选项变化
watch([showPivots, showLatestTrendLines, showHistoryTrendLines], () => {
  if (result.value || multiPatternResult.value?.patterns?.length) {
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
  chartInstance.value?.off('datazoom', handleChartDataZoom)
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
.chart-card,
.multi-pattern-card {
  .card-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
}

.text-muted {
  color: #999;
}

.asset-search-block {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.asset-search-input {
  width: 100%;
}

.asset-search-item {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  width: 100%;
}

.asset-search-item__name {
  color: #303133;
}

.asset-search-item__meta {
  color: #909399;
  font-size: 12px;
}

.asset-search-status {
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: 12px;
  line-height: 1.4;
}

.asset-search-status__selected {
  color: #303133;
}

.asset-search-status__hint {
  color: #909399;
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

:deep(.el-table) {
  .el-table__row {
    cursor: pointer;
  }
}
</style>