import type { App } from 'vue'
import { permission, role } from './permission'
import { loading } from './loading'

export function setupDirectives(app: App) {
  // 注册权限指令
  app.directive('permission', permission)
  app.directive('role', role)
  // 注册加载指令
  app.directive('loading', loading)
}

export * from './permission'
export * from './loading'