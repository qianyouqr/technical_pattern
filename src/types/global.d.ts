/// <reference types="./vue-router.d.ts" />

// 全局类型定义

/**
 * 通用响应类型
 */
declare interface ApiResponse<T = any> {
  code: number
  data: T
  message: string
}

/**
 * 分页参数
 */
declare interface PaginationParams {
  page: number
  pageSize: number
}

/**
 * 分页数据
 */
declare interface PaginationData<T> {
  list: T[]
  total: number
  page: number
  pageSize: number
}