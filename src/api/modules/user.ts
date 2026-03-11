import request from '@/utils/http'
import type { LoginParams, LoginResult, UserInfo } from '../types'

/**
 * 用户登录
 */
export function login(data: LoginParams) {
  return request.post<LoginResult>('/auth/login', data)
}

/**
 * 获取用户信息
 */
export function getUserInfo() {
  return request.get<UserInfo>('/user/info')
}

/**
 * 用户登出
 */
export function logout() {
  return request.post('/auth/logout')
}

/**
 * 刷新 Token
 */
export function refreshToken() {
  return request.post<{ token: string }>('/auth/refresh')
}