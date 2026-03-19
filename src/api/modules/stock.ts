import request from '@/utils/http'
import type { RequestConfig } from '@/utils/http/types'
import type { KLineData } from '@/utils/pattern'

const workflowBaseUrl = import.meta.env.VITE_API_WORKFLOW_URL
const dataSupportBaseUrl = import.meta.env.VITE_API_DATA_SUPPORT_URL
const SMART_STOCK_AUTHORIZATION = 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjY4NDY0NDczZWU3ODE1MWY3MGQ1MjNiNiIsInVzZXJfbmFtZSI6IlFpdVJ1aSIsInR5cGUiOiJkZXNrdG9wIiwiaWF0IjoxNzczODAxMDM4LCJleHAiOjE3NzQ0MDU4Mzh9.rJkqksyXSfAVeWeaIJu-2H9VLHMV2HeYZOjfrJS-oZI'

const smartStockRequestConfig: RequestConfig = {
  headers: {
    Authorization: SMART_STOCK_AUTHORIZATION,
  },
  showLoading: false,
}

export type SmartStockAssetSearchItem = {
  code: string
  name: string
  ticker: string
  type: string
}

export type SmartStockAssetSearchResp = {
  items: SmartStockAssetSearchItem[]
}

export type KLineDataParams = {
  ticker: string
  begin_date?: string | number
}

export type KLineDataResp = {
  close: Array<number | null>
  open: Array<number | null>
  high: Array<number | null>
  low: Array<number | null>
  labels: number[]
  volume?: Array<number | null>
}

export function searchSmartStockAssets(params: { q: string; limit?: number }) {
  return request.get<SmartStockAssetSearchResp>(
    `${workflowBaseUrl}/smartstock/assets/search`,
    params,
    smartStockRequestConfig,
  )
}

export function getKLineDataByTicker(params: KLineDataParams) {
  return request.get<KLineDataResp>(
    `${dataSupportBaseUrl}/dataSupport/getKLineDataByTicker`,
    params,
    smartStockRequestConfig,
  )
}

export function mapKLineResponseToPatternData(data: KLineDataResp): KLineData {
  const volume = data.volume && data.volume.length === data.labels.length
    ? data.volume
    : Array.from({ length: data.labels.length }, () => null)

  return {
    dates: data.labels || [],
    open: data.open || [],
    high: data.high || [],
    low: data.low || [],
    close: data.close || [],
    volume,
  }
}
