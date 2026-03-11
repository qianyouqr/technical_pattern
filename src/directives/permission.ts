import type { Directive, DirectiveBinding } from 'vue'
import { usePermission } from '@/composables/usePermission'

/**
 * 权限指令
 * v-permission="['admin', 'editor']"
 * v-permission="'admin'"
 */
export const permission: Directive = {
  mounted(el: HTMLElement, binding: DirectiveBinding<string | string[]>) {
    const { hasPermission } = usePermission()
    const value = binding.value

    if (!value) return

    const permissions = Array.isArray(value) ? value : [value]
    const hasAuth = permissions.some((permission) => hasPermission(permission))

    if (!hasAuth) {
      el.parentNode?.removeChild(el)
    }
  },
}

/**
 * 角色指令
 * v-role="['admin']"
 */
export const role: Directive = {
  mounted(el: HTMLElement, binding: DirectiveBinding<string | string[]>) {
    const { hasRole } = usePermission()
    const value = binding.value

    if (!value) return

    const roles = Array.isArray(value) ? value : [value]
    const hasAuth = roles.some((role) => hasRole(role))

    if (!hasAuth) {
      el.parentNode?.removeChild(el)
    }
  },
}