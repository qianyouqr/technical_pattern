import dayjs from 'dayjs'
import 'dayjs/locale/zh-cn'
import relativeTime from 'dayjs/plugin/relativeTime'

dayjs.locale('zh-cn')
dayjs.extend(relativeTime)

/**
 * 格式化日期
 */
export function formatDate(date: string | Date | number, format = 'YYYY-MM-DD HH:mm:ss'): string {
  return dayjs(date).format(format)
}

/**
 * 获取相对时间
 */
export function fromNow(date: string | Date | number): string {
  return dayjs(date).fromNow()
}

/**
 * 获取当前时间
 */
export function getCurrentDate(format = 'YYYY-MM-DD HH:mm:ss'): string {
  return dayjs().format(format)
}

/**
 * 判断是否为今天
 */
export function isToday(date: string | Date | number): boolean {
  return dayjs(date).isSame(dayjs(), 'day')
}

/**
 * 获取日期范围
 */
export function getDateRange(type: 'today' | 'week' | 'month' | 'year'): [string, string] {
  const now = dayjs()
  let start: dayjs.Dayjs
  let end: dayjs.Dayjs = now

  switch (type) {
    case 'today':
      start = now.startOf('day')
      break
    case 'week':
      start = now.startOf('week')
      break
    case 'month':
      start = now.startOf('month')
      break
    case 'year':
      start = now.startOf('year')
      break
    default:
      start = now.startOf('day')
  }

  return [start.format('YYYY-MM-DD'), end.format('YYYY-MM-DD')]
}

/**
 * 获取天数差
 */
export function diffDays(date1: string | Date, date2: string | Date): number {
  return dayjs(date1).diff(dayjs(date2), 'day')
}

export { dayjs }