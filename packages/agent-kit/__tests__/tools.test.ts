import { describe, it, expect, beforeEach } from 'vitest'
import {
  findTool,
  queryDockState,
  queryVertiportState,
  setTelemetryQuery,
  queryRobotState,
  queryAlarms,
  matchSOP,
  queryHealthScore,
  generateReport,
  pushNotification,
  setRobotStateSource,
  setAlertSource,
  setSopMatcher,
  setNotificationSender,
  runAgent,
} from '../src/index'
import type { UnifiedRobotState, UnifiedAlert } from 'robot-adapter-kit'

const baseState: Omit<UnifiedRobotState, 'deviceClass' | 'dock' | 'uav' | 'vertiport' | 'industrial'> = {
  robotId: 'R1',
  brand: 'FANUC',
  model: 'M20iD',
  batteryPct: 50,
  voltage: 24,
  online: true,
  position: { x: 0, y: 0, theta: 0 },
  status: 'idle',
  lastSeen: Date.now(),
}

function makeIndustrialState(): UnifiedRobotState {
  return {
    ...baseState,
    deviceClass: 'ground_robot',
    industrial: {
      protocol: 'FOCAS',
      joints: [
        { j: 1, load_pct: 30, health_score: 92, rul_days: 120, temp_c: 35 },
        { j: 2, load_pct: 95, health_score: 45, rul_days: 15, temp_c: 65 },
        { j: 3, load_pct: 20, health_score: 98, rul_days: 300, temp_c: 30 },
      ],
      alarms: [
        {
          raw_code: 'SRVO-023',
          udm_code: 'OVER_TEMP_J2',
          severity: 'error',
          zh_desc: 'J2 关节过温',
          occurred_at: new Date().toISOString(),
          cleared: false,
        },
      ],
      runtime: { power_on_hours: 1234, cycle_count: 5678 },
    },
  } as UnifiedRobotState
}

describe('agent-kit tools', () => {
  beforeEach(() => {
    setRobotStateSource(() => null)
    setAlertSource(() => [])
    setSopMatcher(() => null)
    setNotificationSender(async (user, message) => ({ pushed: true, channel: 'test', user, message }))
  })

  it('findTool returns all registered tools', () => {
    expect(findTool('queryDockState')?.name).toBe('queryDockState')
    expect(findTool('queryVertiportState')?.name).toBe('queryVertiportState')
    expect(findTool('queryRobotState')?.name).toBe('queryRobotState')
    expect(findTool('queryAlarms')?.name).toBe('queryAlarms')
    expect(findTool('matchSOP')?.name).toBe('matchSOP')
    expect(findTool('queryHealthScore')?.name).toBe('queryHealthScore')
    expect(findTool('generateReport')?.name).toBe('generateReport')
    expect(findTool('pushNotification')?.name).toBe('pushNotification')
    expect(findTool('unknown')).toBeUndefined()
  })

  describe('queryRobotState', () => {
    it('returns robot summary', async () => {
      setRobotStateSource(() => makeIndustrialState())
      const res = await queryRobotState.invoke({ robot_id: 'FANUC_M20iD_001' })
      expect(res.robot_id).toBe('R1')
      expect(res.health_score).toBe(78)
      expect(res.joint_count).toBe(3)
      expect(res.alarm_count).toBe(1)
      expect(res.runtime_hours).toBe(1234)
    })

    it('returns error for missing robot', async () => {
      const res = await queryRobotState.invoke({ robot_id: 'MISSING' })
      expect(res.error).toContain('未找到机器人')
    })
  })

  describe('queryAlarms', () => {
    it('clusters active alarms', async () => {
      setRobotStateSource(() => makeIndustrialState())
      const res = await queryAlarms.invoke({ robot_id: 'FANUC_M20iD_001' })
      expect(res.total).toBe(1)
      expect(res.clustered[0].code).toBe('OVER_TEMP_J2')
      expect(res.clustered[0].count).toBe(1)
    })

    it('includes stream alerts', async () => {
      setRobotStateSource(() => makeIndustrialState())
      const streamAlert: UnifiedAlert = {
        robotId: 'R1',
        level: 'warn',
        code: 'W_BATTERY_LOW',
        message: '电池低',
        timestamp: Date.now(),
      }
      setAlertSource(() => [streamAlert])
      const res = await queryAlarms.invoke({ robot_id: 'R1' })
      expect(res.total).toBe(2)
    })
  })

  describe('matchSOP', () => {
    it('matches SOP by alarm code', async () => {
      setSopMatcher((code) =>
        code === 'OVER_TEMP_J2'
          ? {
              alarm_code: 'OVER_TEMP_J2',
              title: 'J2 过温处置',
              estimated_minutes: 20,
              steps: [{ id: 1, title: '降温', detail: '停机冷却' }],
            }
          : null
      )
      const res = await matchSOP.invoke({ alarm_code: 'OVER_TEMP_J2' })
      expect(res.found).toBe(true)
      expect(res.title).toBe('J2 过温处置')
    })

    it('returns not found message', async () => {
      const res = await matchSOP.invoke({ alarm_code: 'UNKNOWN_CODE' })
      expect(res.found).toBe(false)
    })
  })

  describe('queryHealthScore', () => {
    it('returns worst joints', async () => {
      setRobotStateSource(() => makeIndustrialState())
      const res = await queryHealthScore.invoke({ robot_id: 'R1', top_n: 2 })
      expect(res.overall_health).toBe(78)
      expect(res.worst_joints[0].joint).toBe(2)
      expect(res.worst_joints[0].health_score).toBe(45)
    })
  })

  describe('generateReport', () => {
    it('generates health markdown', async () => {
      setRobotStateSource(() => makeIndustrialState())
      const res = await generateReport.invoke({ type: 'health', robot_id: 'R1' })
      expect(res.markdown).toContain('健康报告')
      expect(res.markdown).toContain('R1')
      expect(res.status).toBe('draft')
    })
  })

  describe('pushNotification', () => {
    it('sends notification via configured sender', async () => {
      let captured = { user: '', message: '' }
      setNotificationSender(async (user, message) => {
        captured = { user, message }
        return { pushed: true, channel: 'wecom' }
      })
      const res = await pushNotification.invoke({ user: 'engineer', message: '请处理 J2 过温' })
      expect(res.pushed).toBe(true)
      expect(captured.user).toBe('engineer')
    })
  })

  describe('dock/vertiport tools', () => {
    it('queryDockState returns error when device is not a dock', async () => {
      setTelemetryQuery(async () => ({ ...baseState, deviceClass: 'ground_robot' } as UnifiedRobotState))
      const res = await queryDockState.invoke({ robot_id: 'R1' })
      expect(res).toHaveProperty('error', 'not a dock device or not found')
    })

    it('queryVertiportState returns error when device is not a vertiport', async () => {
      setTelemetryQuery(async () => ({ ...baseState, deviceClass: 'uav_dock' } as UnifiedRobotState))
      const res = await queryVertiportState.invoke({ robot_id: 'V1' })
      expect(res).toHaveProperty('error', 'not a vertiport device or not found')
    })
  })

  describe('runAgent mock', () => {
    it('answers status question', async () => {
      setRobotStateSource(() => makeIndustrialState())
      const reply = await runAgent('FANUC_M20iD_001 状态怎么样', { forceMock: true })
      expect(reply).toContain('AI 辅助生成')
      expect(reply).toContain('整体健康分')
    })

    it('answers alarms question', async () => {
      setRobotStateSource(() => makeIndustrialState())
      const reply = await runAgent('R1 有什么告警', { forceMock: true })
      expect(reply).toContain('OVER_TEMP_J2')
    })

    it('answers health question', async () => {
      setRobotStateSource(() => makeIndustrialState())
      const reply = await runAgent('R1 哪个关节最该保养', { forceMock: true })
      expect(reply).toContain('J2')
    })

    it('answers SOP question', async () => {
      setSopMatcher((code) =>
        code === 'OVER_TEMP_J2'
          ? {
              alarm_code: 'OVER_TEMP_J2',
              title: 'J2 过温处置',
              estimated_minutes: 20,
              steps: [{ id: 1, title: '降温', detail: '停机冷却' }],
            }
          : null
      )
      const reply = await runAgent('OVER_TEMP_J2 的 SOP 是什么', { forceMock: true })
      expect(reply).toContain('J2 过温处置')
    })
  })
})
