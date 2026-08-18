/**
 * 播报事件全局状态
 * wsHub 收到 /speak 后写入 → 驱动 SpeakBubble 气泡 + AlertsPage 播报历史
 */
import { create } from 'zustand'

export interface SpeakEvent {
  robotId: string
  text: string
  volume: number
  timestamp: number
}

interface SpeakStore {
  lastSpeak: SpeakEvent | null
  history: SpeakEvent[]
  setSpeak: (e: SpeakEvent) => void
  clear: () => void
}

export const useSpeakStore = create<SpeakStore>((set) => ({
  lastSpeak: null,
  history: [],
  setSpeak: (e) =>
    set((s) => ({
      lastSpeak: e,
      history: [...s.history.slice(-49), e], // 保留最近 50 条
    })),
  clear: () => set({ lastSpeak: null }),
}))
