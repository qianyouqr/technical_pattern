import { defineStore } from 'pinia'
import type { AppState } from '../types'

export const useAppStore = defineStore('app', {
  state: (): AppState => ({
    sidebar: {
      collapsed: false,
    },
    device: 'desktop',
    theme: 'light',
  }),

  getters: {
    isCollapse: (state) => state.sidebar.collapsed,
    isMobile: (state) => state.device === 'mobile',
  },

  actions: {
    /**
     * 切换侧边栏
     */
    toggleSidebar() {
      this.sidebar.collapsed = !this.sidebar.collapsed
    },

    /**
     * 关闭侧边栏
     */
    closeSidebar() {
      this.sidebar.collapsed = true
    },

    /**
     * 打开侧边栏
     */
    openSidebar() {
      this.sidebar.collapsed = false
    },

    /**
     * 设置设备类型
     */
    setDevice(device: 'desktop' | 'mobile') {
      this.device = device
      if (device === 'mobile') {
        this.sidebar.collapsed = true
      }
    },

    /**
     * 切换主题
     */
    toggleTheme() {
      this.theme = this.theme === 'light' ? 'dark' : 'light'
    },

    /**
     * 设置主题
     */
    setTheme(theme: 'light' | 'dark') {
      this.theme = theme
    },
  },

  persist: {
    key: 'app-store',
    paths: ['sidebar.collapsed', 'theme'],
  },
})