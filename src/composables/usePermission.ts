import { computed } from 'vue'
import { useUserStore } from '@/stores/modules/user'

/**
 * 权限控制 Hook
 */
export function usePermission() {
  const userStore = useUserStore()

  const hasPermission = (permission: string): boolean => {
    const permissions = userStore.permissions
    if (permissions.includes('*')) return true
    return permissions.includes(permission)
  }

  const hasRole = (role: string): boolean => {
    const roles = userStore.roles
    if (roles.includes('admin')) return true
    return roles.includes(role)
  }

  const hasSomePermission = (permissions: string[]): boolean => {
    return permissions.some((permission) => hasPermission(permission))
  }

  const hasEveryPermission = (permissions: string[]): boolean => {
    return permissions.every((permission) => hasPermission(permission))
  }

  const hasSomeRole = (roles: string[]): boolean => {
    return roles.some((role) => hasRole(role))
  }

  const isAdmin = computed(() => userStore.roles.includes('admin'))

  return {
    hasPermission,
    hasRole,
    hasSomePermission,
    hasEveryPermission,
    hasSomeRole,
    isAdmin,
  }
}