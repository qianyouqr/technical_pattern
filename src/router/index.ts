import { createRouter, createWebHistory } from 'vue-router'
import { defaultRoutes } from './routes'
import { setupRouterGuards } from './guards'

/**
 * 创建路由实例
 */
const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: defaultRoutes,
  scrollBehavior(_to, _from, savedPosition) {
    if (savedPosition) {
      return savedPosition
    } else {
      return { top: 0 }
    }
  },
})

/**
 * 重置路由
 */
export function resetRouter() {
  const newRouter = createRouter({
    history: createWebHistory(import.meta.env.BASE_URL),
    routes: defaultRoutes,
  })
  // 替换 router.matcher
  ;(router as any).matcher = (newRouter as any).matcher
}

// 设置路由守卫
setupRouterGuards(router)

export default router