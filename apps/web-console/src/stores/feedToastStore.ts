// 订阅推送 toast store（路演演示用）
// wsHub 收到 WS/MQTT 订阅消息且发生「显著变化」（状态翻转/新告警）时入队，
// FeedToasts 组件右上角浮动展示，让评审直观看到「订阅消息到达 → 中台执行」。
// 高频遥测帧（2Hz/台）不入队，只弹变化，避免刷屏。
import { create } from 'zustand'

export interface FeedToast {
  id: number
  kind: 'status' | 'alert'
  robotId: string
  title: string
  detail: string
  level: 'info' | 'warn' | 'error'
  ts: number
}

interface FeedToastStore {
  toasts: FeedToast[]
  push: (t: Omit<FeedToast, 'id' | 'ts'>) => void
  dismiss: (id: number) => void
}

// toast 自增 id；过期清理用 setTimeout
let nextId = 1
const MAX_TOASTS = 4 // 最多同屏 4 条，多的从队头挤掉
const TOAST_MS = 4200 // 单条停留 4.2s，够评审看清

// 告警去重签名：同机同码 5s 内只弹一次（工业帧可能重复携带 alarmEvents）
const recentAlertSig = new Map<string, number>()
const ALERT_DEDUP_MS = 5000

export const useFeedToastStore = create<FeedToastStore>((set, get) => ({
  toasts: [],

  push: (t) => {
    // 告警类去重
    if (t.kind === 'alert') {
      const key = `${t.robotId}:${t.detail}`
      const now = Date.now()
      if (now - (recentAlertSig.get(key) || 0) < ALERT_DEDUP_MS) return
      recentAlertSig.set(key, now)
    }

    const toast: FeedToast = { ...t, id: nextId++, ts: Date.now() }
    set((s) => {
      const next = [...s.toasts, toast]
      return { toasts: next.length > MAX_TOASTS ? next.slice(-MAX_TOASTS) : next }
    })

    // 到时自动移除
    setTimeout(() => get().dismiss(toast.id), TOAST_MS)
  },

  dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}))
