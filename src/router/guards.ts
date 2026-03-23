import type { Router } from 'vue-router'
import { getToken } from '@/utils/auth'
import NProgress from 'nprogress'
import 'nprogress/nprogress.css'

// 白名单路由（无需登录）
const whiteList = ['/login', '/404']

/**
 * 路由守卫
 */
export function setupRouterGuards(router: Router) {
  // 前置守卫
  router.beforeEach(async (to, _from, next) => {
    NProgress.start()

    // 设置页面标题
    document.title = to.meta.title ? `${to.meta.title} - ${import.meta.env.VITE_APP_TITLE}` : import.meta.env.VITE_APP_TITLE

    const token = getToken()

    if (token) {
      // 已登录
      if (to.path === '/login') {
        // 已登录访问登录页，重定向到首页
        next({ path: '/' })
        NProgress.done()
      } else {
        // 检查是否有用户信息
        // const userStore = useUserStore()
        // if (userStore.userId) {
        //   next()
        // } else {
        //   try {
        //     await userStore.getUserInfo()
        //     next({ ...to, replace: true })
        //   } catch (error) {
        //     userStore.logout()
        //     next(`/login?redirect=${to.path}`)
        //     NProgress.done()
        //   }
        // }
        next()
      }
    } else {
      // 未登录
      if (whiteList.includes(to.path)) {
        // 在白名单中，直接进入
        next()
      } else {
        // 不在白名单中，重定向到登录页
        next(`/login?redirect=${to.path}`)
        NProgress.done()
      }
    }
  })

  // 后置守卫
  router.afterEach(() => {
    NProgress.done()
  })

  // 错误处理
  router.onError((error) => {
    console.error('路由错误:', error)
    NProgress.done()
  })
}