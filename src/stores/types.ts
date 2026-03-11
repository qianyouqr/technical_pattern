export interface UserInfo {
  id: number | string
  username: string
  nickname?: string
  avatar?: string
  email?: string
  phone?: string
  roles?: string[]
  permissions?: string[]
}

export interface AppState {
  sidebar: {
    collapsed: boolean
  }
  device: 'desktop' | 'mobile'
  theme: 'light' | 'dark'
}

export interface PermissionState {
  routes: any[]
  dynamicRoutes: any[]
}