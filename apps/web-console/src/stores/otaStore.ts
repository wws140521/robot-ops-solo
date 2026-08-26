// 2026-08-21 创建 OTA 状态 store，管理设备升级状态机 + 模拟降级引擎
// 参考《轻量OTA开发文档》状态机定义 + 《前端开发文档》5 态映射
import { create } from 'zustand'
import { useRobotStore } from './robotStore'
import type { UnifiedRobotState } from 'robot-adapter-kit'

// 2026-08-21 后端 9 态 → 前端 6 态映射（前端开发文档第 5 节）
export type OtaState =
  | 'idle'        // 待升级
  | 'pending'     // 等待设备响应
  | 'downloading' // 固件下载中 0-60%
  | 'upgrading'   // 升级烧录中 60-100%
  | 'success'     // 升级成功
  | 'fail'        // 升级失败

// 后端上报的原始状态枚举（开发文档第三章）
export type BackendState =
  | 'IDLE' | 'DOWNLOADING' | 'VERIFYING' | 'INSTALLING'
  | 'REBOOTING' | 'HEALTH_CHECK' | 'SUCCESS' | 'FAILED' | 'ROLLED_BACK'

const BACKEND_TO_FRONT: Record<BackendState, OtaState> = {
  IDLE: 'idle',
  DOWNLOADING: 'downloading',
  VERIFYING: 'downloading',  // 下载+验签合并为前端"下载中"
  INSTALLING: 'upgrading',
  REBOOTING: 'upgrading',    // 烧录+重启合并为前端"升级中"
  HEALTH_CHECK: 'upgrading',
  SUCCESS: 'success',
  FAILED: 'fail',
  ROLLED_BACK: 'fail',
}

export interface OtaStatus {
  robotId: string
  state: OtaState
  progress: number           // 0-100
  curVersion: string
  targetVersion: string
  errorMsg: string
  campaignId: string
  lastUpdated: number
}

export interface OtaLogEntry {
  timestamp: number
  robotId: string
  message: string
  level: 'info' | 'warn' | 'error'
}

// 2026-08-21 前置校验规则（前端开发文档第 4 节，P0 强制）
export interface PreCheckResult {
  ok: boolean
  reasons: string[]
}

const BATTERY_THRESHOLD = 30  // 最低电量 30%
const TASK_BLOCKING_STATES: UnifiedRobotState['status'][] = ['working', 'moving', 'error']

interface OtaStore {
  statuses: Record<string, OtaStatus>
  logs: OtaLogEntry[]
  availableVersion: string
  // 前置校验
  preCheck: (robotId: string) => PreCheckResult
  // 下发升级指令（mock 模式下自动驱动状态机）
  startUpgrade: (robotId: string, targetVersion?: string) => void
  // 从 MQTT 接收后端状态上报
  updateFromBackend: (robotId: string, backendState: BackendState, progress: number, message: string, campaignId: string) => void
  // 添加日志
  addLog: (robotId: string, message: string, level?: OtaLogEntry['level']) => void
  // 清空日志
  clearLogs: () => void
}

// 2026-08-21 模拟降级引擎：无真机时前端自驱状态机（前端开发文档第 8 节）
const mockTimers: Record<string, number[]> = {}

function clearMockTimers(robotId: string) {
  const timers = mockTimers[robotId]
  if (timers) {
    timers.forEach((t) => clearTimeout(t))
    delete mockTimers[robotId]
  }
}

function startMockUpgrade(
  robotId: string,
  targetVersion: string,
  setStatus: (s: Partial<OtaStatus>) => void,
  addLog: (r: string, m: string, l?: OtaLogEntry['level']) => void,
) {
  clearMockTimers(robotId)
  const timers: number[] = []
  mockTimers[robotId] = timers

  console.log('[otaStore] mock 升级启动:', { robotId, targetVersion })
  addLog(robotId, `开始升级到 ${targetVersion}（模拟模式）`, 'info')

  // idle → pending (1s)
  setStatus({ state: 'pending', progress: 0, errorMsg: '' })
  addLog(robotId, '等待设备响应...', 'info')
  timers.push(window.setTimeout(() => {
    // pending → downloading (0-60%)
    setStatus({ state: 'downloading', progress: 5 })
    addLog(robotId, '固件下载中...', 'info')

    // 模拟下载进度 5→60%
    const downloadSteps = [15, 25, 35, 45, 55, 60]
    downloadSteps.forEach((pct, i) => {
      timers.push(window.setTimeout(() => {
        setStatus({ state: 'downloading', progress: pct })
        console.log('[otaStore] mock 下载进度:', { robotId, pct })
        if (pct === 60) {
          addLog(robotId, '下载完成，验签通过', 'info')
        }
      }, 800 * (i + 1)))
    })

    // downloading → upgrading (60-100%)
    timers.push(window.setTimeout(() => {
      setStatus({ state: 'upgrading', progress: 65 })
      addLog(robotId, '烧录中...', 'info')

      const upgradeSteps = [75, 85, 95, 100]
      upgradeSteps.forEach((pct, i) => {
        timers.push(window.setTimeout(() => {
          setStatus({ state: 'upgrading', progress: pct })
          if (pct === 100) {
            // upgrading → success
            setStatus({ state: 'success', progress: 100, curVersion: targetVersion })
            addLog(robotId, `升级成功，当前版本 ${targetVersion}`, 'info')
            console.log('[otaStore] mock 升级成功:', { robotId, version: targetVersion })
            clearMockTimers(robotId)
          }
        }, 1000 * (i + 1)))
      })
    }, 800 * (downloadSteps.length + 1) + 500))
  }, 1000))
}

// 2026-08-21 模拟失败场景（可手动触发，演示容错交互）
export function triggerMockFail(robotId: string) {
  clearMockTimers(robotId)
  const store = useOtaStore.getState()
  store.setStatuses(robotId, { state: 'fail', progress: 100, errorMsg: '健康检查失败（模拟）' })
  store.addLog(robotId, '升级失败：健康检查未通过', 'error')
  console.warn('[otaStore] mock 模拟失败触发:', robotId)
}

export const useOtaStore = create<OtaStore & { setStatuses: (robotId: string, patch: Partial<OtaStatus>) => void }>((set, get) => ({
  statuses: {},
  logs: [],
  availableVersion: 'v1.3.2',

  // 2026-08-21 前置校验：在线+电量≥30%+非任务中+无正在升级（前端开发文档第 4 节）
  preCheck: (robotId: string) => {
    const robot = useRobotStore.getState().robots[robotId]
    const reasons: string[] = []

    if (!robot) {
      return { ok: false, reasons: ['设备不存在'] }
    }
    if (!robot.online) {
      reasons.push('设备不在线')
    }
    if (robot.batteryPct < BATTERY_THRESHOLD) {
      reasons.push(`电量不足（${robot.batteryPct}% < ${BATTERY_THRESHOLD}%）`)
    }
    if (TASK_BLOCKING_STATES.includes(robot.status)) {
      reasons.push(`设备状态为 ${robot.status}（任务中/导航中/阻塞）`)
    }

    const otaStatus = get().statuses[robotId]
    if (otaStatus && ['pending', 'downloading', 'upgrading'].includes(otaStatus.state)) {
      reasons.push('已有正在进行的升级任务')
    }

    // TODO: 加入运行时间窗口校验（夜间静默升级 02:00-05:00）
    console.log('[otaStore] preCheck:', { robotId, ok: reasons.length === 0, reasons })
    return { ok: reasons.length === 0, reasons }
  },

  // 2026-08-21 下发升级指令：mock 模式下自驱状态机
  startUpgrade: (robotId: string, targetVersion?: string) => {
    const version = targetVersion ?? get().availableVersion
    const check = get().preCheck(robotId)
    if (!check.ok) {
      get().addLog(robotId, `前置校验未通过：${check.reasons.join('、')}`, 'warn')
      console.warn('[otaStore] 前置校验失败:', { robotId, reasons: check.reasons })
      return
    }

    // 初始化状态
    set((s) => ({
      statuses: {
        ...s.statuses,
        [robotId]: {
          robotId,
          state: 'idle',
          progress: 0,
          curVersion: useRobotStore.getState().robots[robotId]?.model ?? 'unknown',
          targetVersion: version,
          errorMsg: '',
          campaignId: `cmp-${Date.now()}`,
          lastUpdated: Date.now(),
        },
      },
    }))

    // 2026-08-21 mock 模式：启动前端模拟进度（无真实 MQTT 时降级）
    // 真实环境：通过 sendCommand 下发 MQTT 指令，由 ota-agent 上报状态
    startMockUpgrade(robotId, version, (patch) => {
      set((s) => {
        const cur = s.statuses[robotId]
        if (!cur) return s
        return {
          statuses: {
            ...s.statuses,
            [robotId]: { ...cur, ...patch, lastUpdated: Date.now() },
          },
        }
      })
    }, (r, m, l) => get().addLog(r, m, l))
  },

  // 2026-08-21 从 MQTT 接收后端真实状态上报
  updateFromBackend: (robotId, backendState, progress, message, campaignId) => {
    const frontState = BACKEND_TO_FRONT[backendState]
    set((s) => {
      const cur = s.statuses[robotId] ?? {
        robotId,
        state: 'idle' as OtaState,
        progress: 0,
        curVersion: '',
        targetVersion: '',
        errorMsg: '',
        campaignId,
        lastUpdated: Date.now(),
      }
      // 真实上报覆盖 mock 定时器
      clearMockTimers(robotId)
      console.log('[otaStore] 后端状态上报:', { robotId, backendState, frontState, progress, message })
      return {
        statuses: {
          ...s.statuses,
          [robotId]: {
            ...cur,
            state: frontState,
            progress,
            errorMsg: backendState === 'FAILED' ? message : '',
            campaignId,
            lastUpdated: Date.now(),
          },
        },
      }
    })
    get().addLog(robotId, `[${backendState}] ${message}`, backendState === 'FAILED' ? 'error' : 'info')
  },

  addLog: (robotId, message, level = 'info') =>
    set((s) => ({
      logs: [
        ...s.logs,
        { timestamp: Date.now(), robotId, message, level },
      ].slice(-200), // 保留最近 200 条
    })),

  clearLogs: () => set({ logs: [] }),

  setStatuses: (robotId, patch) =>
    set((s) => {
      const cur = s.statuses[robotId]
      if (!cur) return s
      return {
        statuses: {
          ...s.statuses,
          [robotId]: { ...cur, ...patch, lastUpdated: Date.now() },
        },
      }
    }),
}))
