// 全局播报状态，wsHub 收到 /speak 就往这里写
// SpeakBubble 负责弹气泡，AlertsPage 负责记历史，都订阅这里
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
