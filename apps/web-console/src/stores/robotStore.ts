// 机器人状态 store，管所有机器人的在线/离线/批量更新
import { create } from 'zustand'
import type { UnifiedRobotState } from 'robot-adapter-kit'
import { listRobots } from '../lib/robotStorage'

// store 里放啥：所有机器人对象、在线数、几个常用操作
interface RobotStore {
  robots: Record<string, UnifiedRobotState>
  onlineCount: number

  updateRobot: (id: string, state: UnifiedRobotState) => void
  batchUpdate: (states: UnifiedRobotState[]) => void
  setOffline: (id: string) => void
  addRobot: (state: UnifiedRobotState) => void
  removeRobot: (id: string) => void
  // 15s 没收到消息就标离线，避免 WS 断了还显示在线
  markOfflineIfStale: () => void
  // 从 Supabase robots 表拉初始列表，离线模式自动跳过
  initFromSupabase: () => Promise<void>
}

// 2026-08-28 updateRobot 日志节流签名（id → 状态:电量整数位:在线）
const lastRobotLogSig: Record<string, string> = {}

// store 实例
export const useRobotStore = create<RobotStore>((set) => ({
  robots: {},
  onlineCount: 0,

  updateRobot: (id, state) =>
    set((s) => {
      const robots = { ...s.robots, [id]: state }
      const onlineCount = Object.values(robots).filter((r) => r.online).length
      // 2026-08-28 节流：仅在状态/电量整数位/在线变化时打印，避免高频帧刷满 console 缓冲区
      const sig = `${state.status}:${state.batteryPct | 0}:${state.online}`
      if (lastRobotLogSig[id] !== sig) {
        lastRobotLogSig[id] = sig
        console.log('[robotStore] updateRobot:', { id, status: state.status, battery: state.batteryPct, online: state.online, totalOnline: onlineCount })
      }
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

  // 超过 15s 没更新就判离线
  markOfflineIfStale: () =>
    set((s) => {
      const now = Date.now()
      // 15 秒没消息就判离线，这个阈值是经验值，调太小会误报
      const STALE_MS = 15000
      let changed = false
      const robots = Object.fromEntries(
        Object.entries(s.robots).map(([id, r]) => {
          if (r.online && now - r.lastSeen > STALE_MS) {
            changed = true
            console.warn('[robotStore] 离线检测命中:', { id, staleMs: now - r.lastSeen, threshold: STALE_MS })
            return [id, { ...r, online: false, status: 'error' as const }]
          }
          return [id, r]
        })
      )
      if (!changed) return s
      return { robots, onlineCount: Object.values(robots).filter((r) => r.online).length }
    }),

  // 从 Supabase 加载初始机器人列表，如果 WS 已经写入了就以 WS 为准
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
