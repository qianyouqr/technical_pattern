import type { AxiosRequestConfig } from 'axios'

export interface ApiResponse<T = any> {
  code: number
  data: T
  message: string
}

export interface PaginationParams {
  page: number
  pageSize: number
}

export interface PaginationData<T> {
  list: T[]
  total: number
  page: number
  pageSize: number
}

export interface RequestConfig extends Omit<AxiosRequestConfig, 'url' | 'method' | 'params' | 'data'> {
  showLoading?: boolean
  showError?: boolean
  showErrorMsg?: boolean
}

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH'