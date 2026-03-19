import type { AxiosError, AxiosInstance, AxiosRequestConfig, AxiosResponse, InternalAxiosRequestConfig } from 'axios'
import axios from 'axios'
import { ElMessage, ElMessageBox } from 'element-plus'
import NProgress from 'nprogress'
import 'nprogress/nprogress.css'
import type { ApiResponse, RequestConfig } from './types'

// HTTP 状态码枚举
enum HttpStatusCode {
  OK = 200,
  BAD_REQUEST = 400,
  UNAUTHORIZED = 401,
  FORBIDDEN = 403,
  NOT_FOUND = 404,
  INTERNAL_SERVER_ERROR = 500,
}

// 业务状态码枚举
enum BusinessCode {
  SUCCESS = 0,
  TOKEN_EXPIRED = 401,
  NO_PERMISSION = 403,
  SERVER_ERROR = 500,
}

// 默认配置
const defaultConfig: RequestConfig = {
  showLoading: true,
  showError: true,
  showErrorMsg: true,
}

// 请求队列，用于取消重复请求
const pendingRequests = new Map<string, AbortController>()

// 生成请求唯一标识
function generateRequestKey(config: AxiosRequestConfig): string {
  const { method, url, params, data } = config
  return [method, url, JSON.stringify(params), JSON.stringify(data)].join('&')
}

// 添加请求到队列
function addPendingRequest(config: AxiosRequestConfig): void {
  const key = generateRequestKey(config)
  if (pendingRequests.has(key)) {
    const controller = pendingRequests.get(key)
    controller?.abort()
  }
  const controller = new AbortController()
  config.signal = controller.signal
  pendingRequests.set(key, controller)
}

// 从队列中移除请求
function removePendingRequest(config: AxiosRequestConfig): void {
  const key = generateRequestKey(config)
  pendingRequests.delete(key)
}

// 创建 Axios 实例
const service: AxiosInstance = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL,
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
  },
})

// 请求拦截器
service.interceptors.request.use(
  (config: InternalAxiosRequestConfig & RequestConfig) => {
    // 开启进度条
    if (config.showLoading !== false) {
      NProgress.start()
    }

    // 添加重复请求检测
    addPendingRequest(config)

    // 注入 Token（若请求已显式指定 Authorization，则保留请求头）
    const token = localStorage.getItem('token')
    const currentAuthorization = config.headers?.Authorization
    if (token && !currentAuthorization) {
      config.headers.Authorization = `Bearer ${token}`
    }

    return config
  },
  (error: AxiosError) => {
    NProgress.done()
    return Promise.reject(error)
  }
)

// 响应拦截器
service.interceptors.response.use(
  (response: AxiosResponse<ApiResponse>) => {
    NProgress.done()
    removePendingRequest(response.config)

    const { data, config } = response
    const customConfig = config as AxiosRequestConfig & RequestConfig

    // 业务状态码判断
    if (data.code === BusinessCode.SUCCESS) {
      return data.data
    }

    // Token 过期
    if (data.code === BusinessCode.TOKEN_EXPIRED) {
      localStorage.removeItem('token')
      ElMessageBox.confirm('登录已过期，请重新登录', '提示', {
        confirmButtonText: '重新登录',
        cancelButtonText: '取消',
        type: 'warning',
      }).then(() => {
        window.location.href = '/login'
      })
      return Promise.reject(new Error(data.message || '登录已过期'))
    }

    // 其他业务错误
    if (customConfig.showErrorMsg !== false) {
      ElMessage.error(data.message || '请求失败')
    }

    return Promise.reject(new Error(data.message || '请求失败'))
  },
  (error: AxiosError<ApiResponse>) => {
    NProgress.done()

    if (error.config) {
      removePendingRequest(error.config)
    }

    // HTTP 错误处理
    const { response } = error
    let errorMessage = '网络错误，请稍后重试'

    if (response) {
      switch (response.status) {
        case HttpStatusCode.UNAUTHORIZED:
          errorMessage = '未授权，请重新登录'
          localStorage.removeItem('token')
          window.location.href = '/login'
          break
        case HttpStatusCode.FORBIDDEN:
          errorMessage = '拒绝访问'
          break
        case HttpStatusCode.NOT_FOUND:
          errorMessage = '请求的资源不存在'
          break
        case HttpStatusCode.INTERNAL_SERVER_ERROR:
          errorMessage = '服务器内部错误'
          break
        default:
          errorMessage = response.data?.message || `请求错误: ${response.status}`
      }
    } else if (error.code === 'ECONNABORTED') {
      errorMessage = '请求超时'
    }

    ElMessage.error(errorMessage)
    return Promise.reject(error)
  }
)

// 封装请求方法
const request = {
  get<T = any>(url: string, params?: object, config?: RequestConfig): Promise<T> {
    return service.get(url, { params, ...defaultConfig, ...config })
  },

  post<T = any>(url: string, data?: object, config?: RequestConfig): Promise<T> {
    return service.post(url, data, { ...defaultConfig, ...config })
  },

  put<T = any>(url: string, data?: object, config?: RequestConfig): Promise<T> {
    return service.put(url, data, { ...defaultConfig, ...config })
  },

  delete<T = any>(url: string, params?: object, config?: RequestConfig): Promise<T> {
    return service.delete(url, { params, ...defaultConfig, ...config })
  },

  patch<T = any>(url: string, data?: object, config?: RequestConfig): Promise<T> {
    return service.patch(url, data, { ...defaultConfig, ...config })
  },
}

export default request
export { service as axiosInstance }