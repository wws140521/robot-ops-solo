/**
 * 告警流全局状态（独立于 robotStore）
 * wsHub 收到 /alert 或 /speak(转 info) 后写入 → 驱动 AlertsPage / Dashboard / Sidebar 未读角标
 */
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

  addAlert: (alert) =>
    set((s) => ({
      alerts: [alert, ...s.alerts].slice(0, 100), // 保留最近 100 条
      unreadCount: s.unreadCount + 1,
    })),

  markAllRead: () => set({ unreadCount: 0 }),

  // 不传 robotId 清空全部；传 robotId 只清该机器人的告警（供 AlertItem.onDismiss 复用）
  clearAlerts: (robotId) =>
    set((s) => ({
      alerts: robotId ? s.alerts.filter((a) => a.robotId !== robotId) : [],
      unreadCount: robotId ? s.unreadCount : 0,
    })),

  removeAlert: (timestamp) =>
    set((s) => ({
      alerts: s.alerts.filter((a) => a.timestamp !== timestamp),
    })),
}))
