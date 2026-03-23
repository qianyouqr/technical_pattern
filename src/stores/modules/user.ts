import { defineStore } from 'pinia'
import { getToken, setToken, clearAuth } from '@/utils/auth'
import type { UserInfo } from '../types'

interface UserState {
  token: string
  userInfo: UserInfo | null
}

export const useUserStore = defineStore('user', {
  state: (): UserState => ({
    token: getToken() || '',
    userInfo: null,
  }),

  getters: {
    isLoggedIn: (state) => !!state.token,
    userId: (state) => state.userInfo?.id,
    username: (state) => state.userInfo?.username,
    roles: (state) => state.userInfo?.roles || [],
    permissions: (state) => state.userInfo?.permissions || [],
  },

  actions: {
    /**
     * 设置 Token
     */
    setTokenAction(token: string) {
      this.token = token
      setToken(token)
    },

    /**
     * 设置用户信息
     */
    setUserInfo(userInfo: UserInfo) {
      this.userInfo = userInfo
    },

    /**
     * 登录
     */
    async login(_loginForm: { username: string; password: string }) {
      // 这里应该调用登录接口
      // const res = await request.post('/auth/login', loginForm)
      // this.setTokenAction(res.token)
      // return res
      
      // 模拟登录
      const mockToken = 'mock-token-' + Date.now()
      this.setTokenAction(mockToken)
      return { token: mockToken }
    },

    /**
     * 获取用户信息
     */
    async getUserInfo() {
      // 这里应该调用获取用户信息接口
      // const res = await request.get('/user/info')
      // this.setUserInfo(res)
      // return res
      
      // 模拟用户信息
      const mockUserInfo: UserInfo = {
        id: 1,
        username: 'admin',
        nickname: '管理员',
        avatar: '',
        roles: ['admin'],
        permissions: ['*'],
      }
      this.setUserInfo(mockUserInfo)
      return mockUserInfo
    },

    /**
     * 登出
     */
    logout() {
      this.token = ''
      this.userInfo = null
      clearAuth()
    },

    /**
     * 重置状态
     */
    resetState() {
      this.logout()
    },
  },

  persist: {
    key: 'user-store',
    paths: ['token'],
  },
})