// 一键演示模式状态（BP 路演用）
// mock 服务器跑剧本（负载爬升→超载告警→恢复），通过 demo_status 帧驱动这里的 UI
// 演示触发：sendCommand(DEMO_ROBOT_ID, '/demo', {}) 发到 8082
import { create } from 'zustand'

export type DemoPhase = 'idle' | 'ramp' | 'alarm' | 'recover' | 'done'

interface DemoState {
  active: boolean
  robotId: string | null
  phase: DemoPhase
  label: string
  elapsed: number
  total: number
  updateFromFrame: (frame: {
    robotId: string
    phase: DemoPhase
    label: string
    elapsed: number
    total: number
  }) => void
  reset: () => void
}

// done 之后前端停留 5 秒再清场，让人看清「演示完成」
let doneClearTimer: number | undefined

export const useDemoStore = create<DemoState>((set, get) => ({
  active: false,
  robotId: null,
  phase: 'idle',
  label: '',
  elapsed: 0,
  total: 0,

  updateFromFrame: (frame) => {
    window.clearTimeout(doneClearTimer)
    if (frame.phase === 'done') {
      set({ active: true, phase: 'done', label: frame.label, elapsed: frame.elapsed, total: frame.total })
      doneClearTimer = window.setTimeout(() => get().reset(), 5000)
      return
    }
    set({
      active: true,
      robotId: frame.robotId,
      phase: frame.phase,
      label: frame.label,
      elapsed: frame.elapsed,
      total: frame.total,
    })
  },

  reset: () => {
    window.clearTimeout(doneClearTimer)
    set({ active: false, robotId: null, phase: 'idle', label: '', elapsed: 0, total: 0 })
  },
}))
