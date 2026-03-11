import { ref, reactive, computed } from 'vue'
import type { PaginationParams, PaginationData } from '@/utils/http/types'

interface TableOptions<T> {
  fetchData: (params: PaginationParams) => Promise<PaginationData<T>>
  defaultPageSize?: number
}

/**
 * 表格操作 Hook
 */
export function useTable<T>(options: TableOptions<T>) {
  const { fetchData, defaultPageSize = 10 } = options

  const loading = ref(false)
  const tableData = ref<T[]>([])
  const pagination = reactive({
    page: 1,
    pageSize: defaultPageSize,
    total: 0,
  })

  const isEmpty = computed(() => tableData.value.length === 0)

  // 获取数据
  const loadData = async () => {
    loading.value = true
    try {
      const result = await fetchData({
        page: pagination.page,
        pageSize: pagination.pageSize,
      })
      tableData.value = result.list
      pagination.total = result.total
    } catch (error) {
      console.error('加载数据失败:', error)
    } finally {
      loading.value = false
    }
  }

  // 刷新数据
  const refresh = () => {
    pagination.page = 1
    loadData()
  }

  // 页码改变
  const handlePageChange = (page: number) => {
    pagination.page = page
    loadData()
  }

  // 每页条数改变
  const handleSizeChange = (size: number) => {
    pagination.pageSize = size
    pagination.page = 1
    loadData()
  }

  return {
    loading,
    tableData,
    pagination,
    isEmpty,
    loadData,
    refresh,
    handlePageChange,
    handleSizeChange,
  }
}