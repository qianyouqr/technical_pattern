type StorageType = 'localStorage' | 'sessionStorage'

interface StorageOptions {
  type?: StorageType
  expire?: number // 过期时间（毫秒）
}

interface StorageData<T> {
  value: T
  expire?: number
  createTime: number
}

class StorageUtil {
  private storage: Storage

  constructor(type: StorageType = 'localStorage') {
    this.storage = type === 'localStorage' ? localStorage : sessionStorage
  }

  /**
   * 设置存储
   */
  set<T>(key: string, value: T, options?: StorageOptions): void {
    const data: StorageData<T> = {
      value,
      expire: options?.expire,
      createTime: Date.now(),
    }
    this.storage.setItem(key, JSON.stringify(data))
  }

  /**
   * 获取存储
   */
  get<T>(key: string): T | null {
    const dataStr = this.storage.getItem(key)
    if (!dataStr) return null

    try {
      const data: StorageData<T> = JSON.parse(dataStr)
      
      // 检查是否过期
      if (data.expire && Date.now() - data.createTime > data.expire) {
        this.remove(key)
        return null
      }
      
      return data.value
    } catch {
      return null
    }
  }

  /**
   * 移除存储
   */
  remove(key: string): void {
    this.storage.removeItem(key)
  }

  /**
   * 清空存储
   */
  clear(): void {
    this.storage.clear()
  }

  /**
   * 判断 key 是否存在
   */
  has(key: string): boolean {
    return this.storage.getItem(key) !== null
  }
}

export const local = new StorageUtil('localStorage')
export const session = new StorageUtil('sessionStorage')

export default StorageUtil