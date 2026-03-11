import request from '@/utils/http'

/**
 * 获取系统配置
 */
export function getSystemConfig() {
  return request.get('/system/config')
}

/**
 * 获取字典数据
 */
export function getDictData(dictType: string) {
  return request.get(`/system/dict/${dictType}`)
}

/**
 * 上传文件
 */
export function uploadFile(file: File) {
  const formData = new FormData()
  formData.append('file', file)
  return request.post('/upload', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  })
}