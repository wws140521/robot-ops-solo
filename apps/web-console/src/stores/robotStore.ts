import { create } from 'zustand'
import type { UnifiedRobotState } from 'robot-adapter-kit'
import { listRobots } from '../lib/robotStorage'

interface RobotStore {
  robots: Record<string, UnifiedRobotState>
  onlineCount: number

  updateRobot: (id: string, state: UnifiedRobotState) => void
  batchUpdate: (states: UnifiedRobotState[]) => void
  setOffline: (id: string) => void
  addRobot: (state: UnifiedRobotState) => void
  removeRobot: (id: string) => void
  // 定时检查：超过 15 秒未收到消息的机器人标记为离线
  markOfflineIfStale: () => void
  // 从 Supabase robots 表加载初始机器人列表（登录后调用，离线模式自动跳过）
  initFromSupabase: () => Promise<void>
}

export const useRobotStore = create<RobotStore>((set) => ({
  robots: {},
  onlineCount: 0,

  updateRobot: (id, state) =>
    set((s) => {
      const robots = { ...s.robots, [id]: state }
      const onlineCount = Object.values(robots).filter((r) => r.online).length
      return { robots, onlineCount }
    }),

  batchUpdate: (states) =>
    set((s) => {
      const robots = { ...s.robots }
      states.forEach((st) => { robots[st.robotId] = st })
      const onlineCount = Object.values(robots).filter((r) => r.online).length
      return { robots, onlineCount }
    }),

  setOffline: (id) =>
    set((s) => {
      const r = s.robots[id]
      if (!r) return s
      const robots = { ...s.robots, [id]: { ...r, online: false, status: 'error' as const } }
      return { robots, onlineCount: Object.values(robots).filter((r) => r.online).length }
    }),

  addRobot: (state) =>
    set((s) => {
      const robots = { ...s.robots, [state.robotId]: state }
      return { robots, onlineCount: Object.values(robots).filter((r) => r.online).length }
    }),

  removeRobot: (id) =>
    set((s) => {
      const { [id]: _, ...rest } = s.robots
      return { robots: rest, onlineCount: Object.values(rest).filter((r) => r.online).length }
    }),

  markOfflineIfStale: () =>
    set((s) => {
      const now = Date.now()
      const STALE_MS = 15000 // 15 秒无消息判离线
      let changed = false
      const robots = Object.fromEntries(
        Object.entries(s.robots).map(([id, r]) => {
          if (r.online && now - r.lastSeen > STALE_MS) {
            changed = true
            return [id, { ...r, online: false, status: 'error' as const }]
          }
          return [id, r]
        })
      )
      if (!changed) return s
      return { robots, onlineCount: Object.values(robots).filter((r) => r.online).length }
    }),

  initFromSupabase: async () => {
    const rows = await listRobots()
    if (rows.length === 0) return
    const robots: Record<string, UnifiedRobotState> = {}
    for (const r of rows as Array<{
      robot_id: string
      brand: string
      model: string
      status: string
      battery_pct: number
      location?: { x: number; y: number; theta: number }
    }>) {
      robots[r.robot_id] = {
        robotId: r.robot_id,
        brand: r.brand,
        model: r.model,
        batteryPct: r.battery_pct ?? 0,
        voltage: 0,
        online: r.status === 'online',
        position: r.location ?? { x: 0, y: 0, theta: 0 },
        status: (['idle', 'moving', 'working', 'error', 'charging'].includes(r.status)
          ? (r.status as UnifiedRobotState['status'])
          : 'idle'),
        lastSeen: Date.now(),
      }
    }
    set((s) => {
      const merged = { ...robots, ...s.robots } // 保留实时 WS 已写入的状态
      return {
        robots: merged,
        onlineCount: Object.values(merged).filter((r) => r.online).length,
      }
    })
  },
}))
