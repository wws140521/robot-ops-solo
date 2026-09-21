// mock-control/test/integration/control-loop.test.js
// 端到端闭环测试：UI指令 → Control Service → WS /control → mock-ws-server → telemetry 广播
// 同时验证 Control Service 的遥测回传同步（/api/devices 状态刷新）
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { spawn } from 'node:child_process'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import WebSocket from 'ws'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '../../../')
const API = 'http://localhost:3999'

let mockWsProc
let controlProc

function spawnNode(args, env = {}) {
  return spawn(process.execPath, args, {
    cwd: ROOT,
    env: { ...process.env, ...env },
    stdio: ['ignore', 'pipe', 'pipe'],
  })
}

async function waitForHttp(url, timeoutMs = 15000) {
  const t0 = Date.now()
  while (Date.now() - t0 < timeoutMs) {
    try {
      const res = await fetch(url)
      if (res.ok) return await res.json()
    } catch { /* 还没起来 */ }
    await new Promise((r) => setTimeout(r, 300))
  }
  throw new Error(`服务未就绪: ${url}`)
}

// 连 WS 端口收帧，直到 predicate 命中（带超时）
function waitForFrame(port, predicate, timeoutMs = 5000) {
  return new Promise((resolvePromise, reject) => {
    const ws = new WebSocket(`ws://localhost:${port}`)
    const timer = setTimeout(() => {
      ws.close()
      reject(new Error(`等待帧超时 (${port})`))
    }, timeoutMs)

    ws.on('message', (buf) => {
      try {
        const msg = JSON.parse(buf.toString())
        if (predicate(msg)) {
          clearTimeout(timer)
          ws.close()
          resolvePromise(msg)
        }
      } catch { /* 非 JSON 帧 */ }
    })
    ws.on('error', (e) => {
      clearTimeout(timer)
      reject(e)
    })
  })
}

async function post(path, body) {
  const res = await fetch(`${API}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  return res.json()
}

beforeAll(async () => {
  // 1. mock-ws-server（:8080/:8081/:8082）
  mockWsProc = spawnNode(['mock-ws-server.js'])
  await new Promise((r) => setTimeout(r, 1500))

  // 2. Control Service（:3999）
  controlProc = spawnNode(['mock-control/server/index.js'], { PORT: 3999 })
  const health = await waitForHttp(`${API}/health`)
  expect(health.ok).toBe(true)
}, 30000)

afterAll(() => {
  controlProc?.kill('SIGTERM')
  mockWsProc?.kill('SIGTERM')
})

describe('Control Loop（UI → API → WS /control → mock → telemetry）', () => {
  it('GET /api/devices 应返回 6 台设备', async () => {
    const devices = await waitForHttp(`${API}/api/devices`)
    expect(devices).toHaveLength(6)
  })

  it('set_battery → G1 遥测帧应广播新电量', async () => {
    await post('/api/command', { robotId: 'UNITREE-G1-01', type: 'set_battery', params: { level: 42 } })

    // 直连 :8080 验证 mock 侧真的改了（G1 /state 帧的 percentage）
    const frame = await waitForFrame(8080, (m) => m?.topic === '/state' && m?.data?.percentage === 42)
    expect(frame.data.percentage).toBe(42)

    // Control Service 侧遥测回传同步（电池可能又掉了一点点，41~42 都算对）
    await new Promise((r) => setTimeout(r, 600))
    const devices = await (await fetch(`${API}/api/devices`)).json()
    const g1 = devices.find((d) => d.robotId === 'UNITREE-G1-01')
    expect(g1.battery).toBeGreaterThanOrEqual(41)
    expect(g1.battery).toBeLessThanOrEqual(42)
  })

  it('trigger_alarm(error) → 工业遥测帧应出现 error 状态 + 告警', async () => {
    await post('/api/command', {
      robotId: 'FANUC_M20iD_001',
      type: 'trigger_alarm',
      params: { code: 'SRVO-001', severity: 'error' },
    })

    // 直连 :8082 验证 mock 侧：FANUC 帧要么 status=error，要么告警帧带 SRVO-001
    const frame = await waitForFrame(8082, (m) => {
      if (m?.type !== 'industrial_state' || m?.payload?.robot_id !== 'FANUC_M20iD_001') return false
      const alarms = m.payload.alarms || []
      return m.payload.status === 'error' || alarms.some((a) => a.raw_code === 'SRVO-001')
    }, 6000)
    const alarms = frame.payload.alarms || []
    const hasAlarm = alarms.some((a) => a.raw_code === 'SRVO-001' && a.zh_desc === '伺服放大器过流')
    expect(hasAlarm || frame.payload.status === 'error').toBe(true)
  })

  it('set_joint_temperature → 工业遥测帧应广播新温度', async () => {
    await post('/api/command', {
      robotId: 'KUKA_KR6_001',
      type: 'set_joint_temperature',
      params: { axis: 3, temperature: 77 },
    })

    const frame = await waitForFrame(8082, (m) => {
      if (m?.type !== 'industrial_state' || m?.payload?.robot_id !== 'KUKA_KR6_001') return false
      return m.payload.joints?.some((j) => j.j === 3 && Math.abs(j.temp_c - 77) < 0.5)
    }, 6000)
    expect(frame.payload.joints.find((j) => j.j === 3).temp_c).toBeCloseTo(77, 0)
  })

  it('clear_alarm + resume → 设备恢复 working 状态', async () => {
    await post('/api/command', { robotId: 'FANUC_M20iD_001', type: 'clear_alarm' })
    await post('/api/command', { robotId: 'FANUC_M20iD_001', type: 'resume' })

    await waitForFrame(8082, (m) => {
      return m?.type === 'industrial_state'
        && m?.payload?.robot_id === 'FANUC_M20iD_001'
        && m.payload.status === 'working'
        && (m.payload.alarms || []).length === 0
    }, 6000)
  }, 10000)
})
