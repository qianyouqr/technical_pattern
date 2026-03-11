import { defineStore } from 'pinia'
import type { RouteRecordRaw } from 'vue-router'
import { constantRoutes, asyncRoutes } from '@/router/routes'
import type { PermissionState } from '../types'

/**
 * 判断用户是否有权限访问该路由
 */
function hasPermission(roles: string[], route: RouteRecordRaw): boolean {
  if (route.meta?.roles) {
    return roles.some((role) => route.meta!.roles!.includes(role))
  }
  return true
}

/**
 * 过滤异步路由
 */
function filterAsyncRoutes(routes: RouteRecordRaw[], roles: string[]): RouteRecordRaw[] {
  const res: RouteRecordRaw[] = []
  routes.forEach((route) => {
    const tmp = { ...route }
    if (hasPermission(roles, tmp)) {
      if (tmp.children) {
        tmp.children = filterAsyncRoutes(tmp.children, roles)
      }
      res.push(tmp)
    }
  })
  return res
}

export const usePermissionStore = defineStore('permission', {
  state: (): PermissionState => ({
    routes: [],
    dynamicRoutes: [],
  }),

  getters: {
    permissionRoutes: (state) => state.routes,
    addedRoutes: (state) => state.dynamicRoutes,
  },

  actions: {
    /**
     * 生成路由
     */
    generateRoutes(roles: string[]): RouteRecordRaw[] {
      let accessedRoutes: RouteRecordRaw[]

      if (roles.includes('admin')) {
        // 管理员拥有所有路由权限
        accessedRoutes = asyncRoutes
      } else {
        // 根据角色过滤路由
        accessedRoutes = filterAsyncRoutes(asyncRoutes, roles)
      }

      this.dynamicRoutes = accessedRoutes
      this.routes = constantRoutes.concat(accessedRoutes)

      return accessedRoutes
    },

    /**
     * 重置路由
     */
    resetRoutes() {
      this.routes = []
      this.dynamicRoutes = []
    },
  },
})