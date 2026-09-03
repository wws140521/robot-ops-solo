// 告警流全局状态，独立于 robotStore
// wsHub 收到 /alert 后写入，驱动 AlertsPage / Dashboard / Sidebar 未读角标
import { create } from 'zustand'
import type { UnifiedAlert } from 'robot-adapter-kit'

interface AlertStore {
  alerts: UnifiedAlert[]
  unreadCount: number

  addAlert: (alert: UnifiedAlert) => void
  markAllRead: () => void
  clearAlerts: (robotId?: string) => void
  removeAlert: (timestamp: number) => void
}

export const useAlertStore = create<AlertStore>((set) => ({
  alerts: [],
  unreadCount: 0,

  // 加一条告警，最多保留 100 条，未读数 +1
  addAlert: (alert) =>
    set((s) => ({
      alerts: [alert, ...s.alerts].slice(0, 100),
      unreadCount: s.unreadCount + 1,
    })),

  // 全部标为已读
  markAllRead: () => set({ unreadCount: 0 }),

  // 不传 robotId 清空全部；传 robotId 只清该机器人的告警
  clearAlerts: (robotId) =>
    set((s) => ({
      alerts: robotId ? s.alerts.filter((a) => a.robotId !== robotId) : [],
      unreadCount: robotId ? s.unreadCount : 0,
    })),

  // 按时间戳删除单条告警
  removeAlert: (timestamp) =>
    set((s) => ({
      alerts: s.alerts.filter((a) => a.timestamp !== timestamp),
    })),
}))
