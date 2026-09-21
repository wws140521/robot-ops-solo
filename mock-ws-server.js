/**
 * mock-ws-server.js
 * 模拟宇树 G1 (8080) + 擎朗 Peanut (8081) 双品牌 WebSocket 数据流
 * 用法：node mock-ws-server.js
 *
 * G1     → ws://localhost:8080  沿路径巡航 + 遇障碍物自动拐弯 + 电量递减 + B点播报
 * Peanut → ws://localhost:8081  直线往返 + 电量递减
 *
 * 栅格地图（与 digital-twin LAYOUT 一致）：12列 x 10行，每格 0.5m
 * 世界坐标原点位于地图中心，X: [-3, 3]，Z: [-2.5, 2.5]
 */
import { WebSocketServer, WebSocket } from 'ws'

// ───────────────────────── 栅格地图（与 collision.ts 一致）─────────────────────────
const GRID = { cols: 12, rows: 10, cellSize: 0.5 }
const GRID_OX = -(GRID.cols * GRID.cellSize) / 2 // -3
const GRID_OZ = -(GRID.rows * GRID.cellSize) / 2 // -2.5

const LAYOUT = (() => {
  const { cols: W, rows: H } = GRID
  const g = Array.from({ length: H }, () => Array(W).fill(0))
  for (let x = 0; x < W; x++) { g[0][x] = 1; g[H - 1][x] = 1 }
  for (let y = 0; y < H; y++) { g[y][0] = 1; g[y][W - 1] = 1 }
  for (let y = 1; y < 4; y++) g[y][4] = 1
  ;[
    [2, 6], [3, 6], [2, 8], [3, 8],
    [6, 6], [6, 8], [9, 2], [9, 4],
  ].forEach(([x, y]) => { if (g[y]?.[x] !== undefined) g[y][x] = 1 })
  return g
})()

function worldToGrid(wx, wz) {
  return {
    gx: Math.floor((wx - GRID_OX) / GRID.cellSize),
    gy: Math.floor((wz - GRID_OZ) / GRID.cellSize),
  }
}

function isObstacle(wx, wz) {
  // 临时关闭障碍检测 → 让 G1 直线走验证 anchor 速度
  return false
}

// ══════════════════════════════════════════════════════════════════
// 🆕 Mock Control Integration（操作页面双向控制支持 · doc/mock-control-panel-dev-guide.md）
// 指令入口两条：WS 直连（{ topic: '/control', data: command }）或 MQTT 订阅
// （industrial/robot/+/command）。有 mosquitto 时走 MQTT，没有时 Control Service
// 自动降级 WS 直连——两条路最终都汇聚到 applyExternalCommand()。
// ══════════════════════════════════════════════════════════════════

let g1Paused = false       // 操作面板 stop/pause → G1 位置/电量冻结
let peanutPaused = false  // Peanut 同上
let g1TurnRate = 0        // G1 当前转向角速度 rad/s（角加速度限幅状态，类人起转/滑出）
const suppressUntil = new Map()  // robotId → 时间戳，simulate_offline 期间跳过该设备广播

// 操作面板可注入的告警码描述（对齐 Control Service 的 ALARM_DESC 池）
const CONTROL_ALARM_DESC = {
  'SRVO-001': '伺服放大器过流',
  'SRVO-023': '伺服过载（J2 轴电机过热）',
  'SRVO-062': '伺服放大器过热',
  'OH-002': '变频器散热器过热',
  'KSS-004': 'KSS 轴工作范围超限',
  'KSS-150': '伺服过载',
  'EST-007': 'Estun 通信超时',
  'EST-3008': '编码器异常',
  'ALM-201': 'Yaskawa 绝对位置丢失',
}

// 统一指令入口：按 robotId 前缀路由到 G1 / Peanut / 工业仿真器
function applyExternalCommand(command) {
  if (!command?.robotId || !command.type) return
  const { robotId, type, params = {} } = command
  console.log(`[MockControl] ← ${robotId}: ${type}`, params && Object.keys(params).length ? JSON.stringify(params) : '')

  if (robotId.startsWith('UNITREE')) {
    applyG1Command(type, params)
    return
  }
  if (robotId.startsWith('KEENON') || robotId.startsWith('PEANUT')) {
    applyPeanutCommand(type, params)
    return
  }
  // 工业机械臂：按 cfg.id 匹配（FANUC_M20iD_001 等）
  const sim = industrialSims.find((s) => s.cfg.id === robotId)
  if (sim) {
    applyIndustrialCommand(sim, type, params)
  } else {
    console.warn(`[MockControl] 未知设备 ${robotId}，忽略`)
  }
}

// G1 指令：启停/电量/复位/离线
function applyG1Command(type, params) {
  switch (type) {
    case 'start': case 'resume': g1Paused = false; break
    case 'stop': case 'pause':  g1Paused = true; break
    case 'reset':               g1Paused = false; g1Battery = 85; g1LastAlertLevel = 100; break
    case 'set_battery':
      g1Battery = Math.max(0, Math.min(100, Number(params.level) || 0))
      g1LastAlertLevel = g1Battery <= 10 ? 10 : g1Battery <= 20 ? 20 : 100 // 避免旧阈值告警重复触发
      break
    case 'simulate_offline': {
      const dur = Number(params.duration_ms) || 30000
      suppressUntil.set('UNITREE-G1-01', Date.now() + dur)
      break
    }
    default: break // move_to/set_velocity 等对室内巡航仿真暂无对应实现，忽略
  }
}

// Peanut 指令：同 G1
function applyPeanutCommand(type, params) {
  switch (type) {
    case 'start': case 'resume': peanutPaused = false; break
    case 'stop': case 'pause':  peanutPaused = true; break
    case 'reset':               peanutPaused = false; peanutBattery = 92; break
    case 'set_battery':         peanutBattery = Math.max(0, Math.min(100, Number(params.level) || 0)); break
    case 'simulate_offline': {
      const dur = Number(params.duration_ms) || 30000
      suppressUntil.set('KEENON-T9-01', Date.now() + dur)
      break
    }
    default: break
  }
}

// 工业机械臂指令：状态/关节温度/角度/负载/告警/离线
// 复用一键演示的注入机制（demoTemp/demoLoad/demoAlarm），告警一次性发帧、
// 温度负载持续覆盖，与现有 telemetry 广播无缝合并
function applyIndustrialCommand(sim, type, params) {
  const now = Date.now()
  switch (type) {
    case 'start': case 'resume':
      sim.mode = 'working'
      sim.stepIdx = 0
      sim.seg = null
      sim.idleAt = now + rand(40e3, 90e3) // 压一下等料窗口，别刚启动就 idle
      break
    case 'stop': case 'pause':
      sim.mode = 'idle'
      sim.seg = null
      sim.workAt = now + 3600e3 // 停 1 小时，start 随时可唤醒
      break
    case 'reset':
      sim.demoLoad = null
      sim.demoTemp = null
      sim.demoAlarm = null
      sim.alarm = null
      sim.mode = 'idle'
      sim.seg = null
      sim.workAt = now + 600e3
      sim.nextAlarmAt = now + rand(30e3, 90e3)
      break
    case 'set_joint_temperature':
      // 持续覆盖指定关节温度 → 下个 telemetry tick 生效，健康分联动由前端算
      sim.demoTemp = { joint: Number(params.axis) || 1, value: Number(params.temperature) || 35 }
      break
    case 'set_joint_angle': {
      const i = (Number(params.axis) || 1) - 1
      if (i >= 0 && i < sim.q.length) {
        sim.q[i] = ((Number(params.angle) || 0) * Math.PI) / 180 // 入参是度，仿真内部用弧度
        sim.seg = null
      }
      break
    }
    case 'set_load': {
      const i = (Number(params.axis) || 1) - 1
      const base = sim.demoLoad ?? sim.cfg.load
      if (i >= 0 && i < base.length) {
        sim.demoLoad = base.map((v, k) => (k === i ? Number(params.load) || 0 : v))
      }
      break
    }
    case 'trigger_alarm':
      sim.demoAlarm = {
        raw_code: params.code || 'SRVO-001',
        udm_code: `CTRL_${params.code || 'ALARM'}`,
        severity: params.severity === 'warn' ? 'warning' : (params.severity || 'warning'),
        zh_desc: CONTROL_ALARM_DESC[params.code] || `操作面板注入告警: ${params.code || ''}`,
        occurred_at: new Date(now).toISOString(),
        cleared: false,
        emitted: false,
      }
      break
    case 'clear_alarm':
      sim.demoAlarm = null
      if (sim.alarm) {
        sim.alarm = null
        sim.nextAlarmAt = now + rand(50e3, 100e3)
        sim.seg = null
      }
      break
    case 'simulate_offline': {
      const dur = Number(params.duration_ms) || 30000
      suppressUntil.set(sim.cfg.id, now + dur)
      setTimeout(() => suppressUntil.delete(sim.cfg.id), dur + 1000).unref?.()
      break
    }
    default:
      // set_battery/set_health_score/custom_telemetry 等只影响 Control Service 本地展示，对仿真无意义
      break
  }
}

// WS 消息统一入口（三个端口共用）：解析 /control 帧
function handleControlMessage(buf) {
  try {
    const msg = JSON.parse(buf.toString())
    if (msg?.topic === '/control' && msg.data) {
      applyExternalCommand(msg.data)
    }
  } catch {
    // 心跳等非 JSON 帧，忽略
  }
}

// 可选 MQTT 订阅：装了 mqtt 包且本地有 broker 时生效，否则静默走 WS 直连
async function initMockControlMqtt() {
  try {
    const { default: mqtt } = await import('mqtt')
    const broker = process.env.MQTT_BROKER || 'mqtt://localhost:1883'
    const client = mqtt.connect(broker, {
      clientId: 'mock-ws-control',
      clean: true,
      connectTimeout: 3000,
      reconnectPeriod: 5000,
    })
    client.on('connect', () => {
      client.subscribe('industrial/robot/+/command', { qos: 1 })
      console.log('[MockControl] ✓ MQTT 已订阅: industrial/robot/+/command')
    })
    client.on('message', (topic, payload) => {
      try {
        applyExternalCommand(JSON.parse(payload.toString()))
      } catch (e) {
        console.error('[MockControl] MQTT 指令解析失败:', e.message)
      }
    })
    client.on('error', () => { /* broker 不在很正常，WS 直连兜底 */ })
  } catch {
    console.warn('[MockControl] mqtt 模块不可用，仅支持 WS /control 直连模式')
  }
}
initMockControlMqtt()

// ───────────────────────── 宇树 G1（8080）─────────────────────────
const wssUnitree = new WebSocketServer({ port: 8080 })
let g1Battery = 85
let g1HasSpoken = false
let g1LastAlertLevel = 100

// 机器人状态：位置 + 当前目标点
let g1Pos = { x: 0, y: 0 } // 世界坐标
let g1Heading = 0 // 弧度，当前朝向
const G1_SPEED = 0.05 // 每 tick 前进距离（0.5 m/s）

// ─── 室外模式 GPS 路线（真实经纬度，朝阳大悦城周边 GCJ-02）──────────
// 可以通过环境变量切换: OUTDOOR_MODE=true node mock-ws-server.js
const OUTDOOR_MODE = process.env.OUTDOOR_MODE === 'true'
const GpsRoute = [
  { lng: 116.519942, lat: 39.924677 },  // 起点：商场门口
  { lng: 116.520200, lat: 39.924900 },
  { lng: 116.520500, lat: 39.925100 },
  { lng: 116.520800, lat: 39.925300 },  // 取餐点 A
  { lng: 116.521100, lat: 39.925100 },
  { lng: 116.521400, lat: 39.924800 },  // 充电柜
]
let gpsSegIdx = 0
let gpsSegProgress = 0
let gpsLastLngLat = { lng: GpsRoute[0].lng, lat: GpsRoute[0].lat }
console.log(`[mock] OUTDOOR_MODE=${OUTDOOR_MODE} ${OUTDOOR_MODE ? '→ GPS 真实路线' : '→ 室内避障巡航'}`)

// 航点路径 —— 地图内安全巡逻（距障碍 > 0.5m）
const WAYPOINTS = [
  { x:  0.0, y:  0.0 },
  { x:  1.8, y:  0.0 },  // 东
  { x:  1.8, y:  1.6 },  // 北
  { x: -1.8, y:  1.6 },  // 西
  { x: -1.8, y: -1.6 },  // 南
  { x:  1.8, y: -1.6 },  // 东
  { x:  1.8, y:  0.0 },  // 北回到起点
]
let wpIdx = 0

// 方向候选（8方向），优先直行，其次左右，最后倒车
const DIRS = [
  { offset: 0,                  label: '正前方' },
  { offset: Math.PI / 4,        label: '右前' },
  { offset: -Math.PI / 4,       label: '左前' },
  { offset: Math.PI / 2,        label: '右方' },
  { offset: -Math.PI / 2,       label: '左方' },
  { offset: Math.PI * 3 / 4,    label: '右后' },
  { offset: -Math.PI * 3 / 4,   label: '左后' },
  { offset: Math.PI,            label: '正后' },
]

const DIR_NAMES = ['东', '东南', '南', '西南', '西', '西北', '北', '东北']

function headingToName(rad) {
  const deg = ((rad * 180 / Math.PI) % 360 + 360) % 360
  const idx = Math.round(deg / 45) % 8
  return `${DIR_NAMES[idx]}(${deg.toFixed(0)}°)`
}

// 前向激光扫描：检测某个方向前方 step 距离是否有障碍
function scanDirection(cx, cy, heading, lookAhead = 0.12) {
  const nx = cx + Math.cos(heading) * lookAhead
  const ny = cy + Math.sin(heading) * lookAhead
  const blocked = isObstacle(nx, ny)
  if (blocked) {
    const { gx, gy } = worldToGrid(nx, ny)
    console.log(`  [scan] ⛔ 方向=${headingToName(heading)} 探测点=(${nx.toFixed(2)},${ny.toFixed(2)}) 栅格=(${gx},${gy}) 命中障碍`)
  }
  return !blocked
}

// 2026-08-28 广播替代单连接发送：多客户端连接时逐帧 send 只发连接方，
// 且全局电量若放在 connection 内 interval 会被 N 个连接 N 倍速推进（实测 5 连接电量 5 倍速狂掉）
function broadcastG1(msg) {
  // simulate_offline 抑制：操作面板模拟离线期间不出帧（Dashboard 侧判定超时离线）
  if ((suppressUntil.get('UNITREE-G1-01') ?? 0) > Date.now()) return
  const data = JSON.stringify(msg)
  wssUnitree.clients.forEach((c) => { if (c.readyState === WebSocket.OPEN) c.send(data) })
}

// 2026-08-28 状态推进全局单 ticker：G1 状态机（位置/避障/电量/播报）与连接数解耦，
// 无论多少客户端订阅，状态推进速度恒定（0.05/tick）
let g1TickerStarted = false

wssUnitree.on('connection', (ws) => {
  console.log('[mock] G1 client connected')
  // 🆕 操作面板控制指令（每个连接都可下发，topic: '/control'）
  ws.on('message', handleControlMessage)
  if (g1TickerStarted) return
  g1TickerStarted = true
  const interval = setInterval(() => {
    if (wssUnitree.clients.size === 0) return

    // 1. 计算目标方向（朝向当前航点）
    const target = WAYPOINTS[wpIdx]
    const dx = target.x - g1Pos.x
    const dy = target.y - g1Pos.y
    const distToTarget = Math.hypot(dx, dy)
    let preferredHeading = Math.atan2(dy, dx)

    // 2. 到达航点 → 切下一个（B点：出餐口处触发播报）
    if (distToTarget < 0.15) {
      // 到达 B 点（WAYPOINTS 第 6 号，y=-1.8 附近）触发播报
      if (wpIdx === 6 && !g1HasSpoken) {
        broadcastG1({
          topic: '/speak',
          data: { text: '小心烫手～', volume: 0.8, timestamp: Date.now() },
        })
        g1HasSpoken = true
        console.log('[mock] 到达 B 点（出餐口），触发播报')
      }
      // 回到起点重置播报锁
      if (wpIdx === 0) g1HasSpoken = false
      wpIdx = (wpIdx + 1) % WAYPOINTS.length
    }

    // 3. 8 方向避障：按优先级找第一个可行方向
    //    首选 = 与目标方向夹角最小
    let bestHeading = null
    let minAngleDiff = Infinity
    const scanResults = [] // 记录每个方向扫描结果，用于日志
    for (const dir of DIRS) {
      const candidate = preferredHeading + dir.offset
      // 角度差取最小绝对值（0 ~ π）
      let diff = ((candidate - preferredHeading) % (Math.PI * 2) + Math.PI * 3) % (Math.PI * 2) - Math.PI
      if (Math.abs(diff) < 0.001) diff = 0
      const absDiff = Math.abs(diff)
      if (absDiff > minAngleDiff) continue

      // 第一次扫描
      const pass1 = scanDirection(g1Pos.x, g1Pos.y, candidate, 0.12)
      if (!pass1) {
        scanResults.push({ dir: dir.label, heading: headingToName(candidate), pass1: false, pass2: false, reason: '一次扫描命中障碍' })
        continue
      }
      // 二次确认：再往前走一点也安全（避免卡角）
      const pass2 = scanDirection(
        g1Pos.x + Math.cos(candidate) * 0.06,
        g1Pos.y + Math.sin(candidate) * 0.06,
        candidate, 0.08,
      )
      if (!pass2) {
        scanResults.push({ dir: dir.label, heading: headingToName(candidate), pass1: true, pass2: false, reason: '二次扫描命中障碍（卡角）' })
        continue
      }

      scanResults.push({ dir: dir.label, heading: headingToName(candidate), pass1: true, pass2: true, reason: '可行' })
      bestHeading = candidate
      minAngleDiff = absDiff
      if (absDiff < 0.01) break // 正前方可行就不犹豫
    }

    // 避障决策日志
    const prevHeadingName = headingToName(g1Heading)
    const targetHeadingName = headingToName(preferredHeading)
    if (bestHeading !== null) {
      const chosen = scanResults.find((r) => r.pass1 && r.pass2)
      const turned = Math.abs(bestHeading - g1Heading) > 0.1
      if (turned) {
        console.log(
          `[avoid] 🔄 拐弯 位置=(${g1Pos.x.toFixed(2)},${g1Pos.y.toFixed(2)}) ` +
          `当前朝向=${prevHeadingName} → 目标=${targetHeadingName} ` +
          `选定=${headingToName(bestHeading)}(偏角${(minAngleDiff * 180 / Math.PI).toFixed(0)}°) ` +
          `航点#${wpIdx}=${JSON.stringify(target)}`
        )
        console.log(`  扫描详情: ${scanResults.map(r => `${r.dir}=${r.pass1 && r.pass2 ? '✅' : '⛔'}`).join(' ')}`)
      }
    }

    // 4. 所有方向都不行 → 原地打方向盘（随机微调直到有方向可行）
    if (bestHeading === null) {
      bestHeading = preferredHeading + (Math.random() - 0.5) * Math.PI
      console.log(
        `[avoid] ❌ 全方向受阻! 位置=(${g1Pos.x.toFixed(2)},${g1Pos.y.toFixed(2)}) ` +
        `当前朝向=${prevHeadingName} 目标=${targetHeadingName} ` +
        `随机转向=${headingToName(bestHeading)}`
      )
      console.log(`  扫描详情: ${scanResults.map(r => `${r.dir}=${r.pass1 && r.pass2 ? '✅' : '⛔'}(${r.reason})`).join(' | ')}`)
    }

    // 5~7. 朝向平滑 + 前进 + 边界/碰撞保护 —— 操作面板 stop/pause 时全部冻结
    if (!g1Paused) {
      let hd = bestHeading - g1Heading
      hd = ((hd + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI
      // 2026-09-08 比例转向 + 角加速度限幅（替代 bang-bang）：
      // 旧实现恒定 0.15rad/tick 顶格转，起转/停转都是阶跃，拐弯像台车。
      // 三层处理让转弯呈「起转-保持-滑出」的类人弧线：
      //   a) 比例律 ω=K·误差：误差大顶格快转，误差收敛按比例减速（ease-out）
      //   b) 角加速度限幅 3 rad/s²：航点切换瞬间误差是阶跃，纯比例律会立即顶格
      //      （进弯仍跳变）；限幅后 0.5s 渐进到满速（ease-in）
      const TURN_GAIN = 6.0       // rad/s per rad 误差（τ≈0.17s 收敛尾）
      const MAX_TURN_RATE = 1.5   // rad/s 角速度上限
      const MAX_TURN_ACCEL = 3.0  // rad/s² 角加速度上限
      if (Math.abs(hd) < 0.02) {
        g1Heading = bestHeading // 尾部收口，防比例律无限渐近蠕动
        g1TurnRate = 0
      } else {
        const desired = Math.max(-MAX_TURN_RATE, Math.min(MAX_TURN_RATE, hd * TURN_GAIN))
        const maxStep = MAX_TURN_ACCEL / 10 // tick 10Hz
        g1TurnRate += Math.max(-maxStep, Math.min(maxStep, desired - g1TurnRate))
        g1Heading += g1TurnRate / 10
      }

      // 6. 按当前朝向前进（急转按剩余误差降速，像真人拐弯收步；最低 60%）
      const turnSlow = 1 - 0.4 * Math.min(Math.abs(hd) / 0.5, 1)
      g1Pos.x += Math.cos(g1Heading) * G1_SPEED * turnSlow
      g1Pos.y += Math.sin(g1Heading) * G1_SPEED * turnSlow

      // 7. 边界保护（极端情况下强制回中心）
      let boundaryHit = false
      if (g1Pos.x < -2.8) { g1Pos.x = -2.8; boundaryHit = true }
      if (g1Pos.x >  2.8) { g1Pos.x = 2.8; boundaryHit = true }
      if (g1Pos.y < -2.3) { g1Pos.y = -2.3; boundaryHit = true }
      if (g1Pos.y >  2.3) { g1Pos.y = 2.3; boundaryHit = true }
      if (boundaryHit) {
        console.log(`[boundary] ⚠️ 触碰边界! 位置=(${g1Pos.x.toFixed(2)},${g1Pos.y.toFixed(2)}) 朝向=${headingToName(g1Heading)}`)
      }
      if (isObstacle(g1Pos.x, g1Pos.y)) {
        // 万一钻进了障碍，退一步 + 转向
        const stuckPos = `(${g1Pos.x.toFixed(2)},${g1Pos.y.toFixed(2)})`
        const { gx, gy } = worldToGrid(g1Pos.x, g1Pos.y)
        g1Pos.x -= Math.cos(g1Heading) * G1_SPEED * 2
        g1Pos.y -= Math.sin(g1Heading) * G1_SPEED * 2
        g1Heading += Math.PI / 2
        console.log(
          `[collision] 💥 穿入障碍! 位置=${stuckPos} 栅格=(${gx},${gy}) ` +
          `后退后=(${g1Pos.x.toFixed(2)},${g1Pos.y.toFixed(2)}) 新朝向=${headingToName(g1Heading)}`
        )
      }
    }

    // 8. 电量递减，到 0 重置（暂停时不掉电）
    if (!g1Paused) {
      g1Battery = Math.max(0, g1Battery - 0.05)
      if (g1Battery <= 0) { g1Battery = 85; g1LastAlertLevel = 100 }
    }

    // 9. 室外模式: 沿真实经纬度路线移动 + 广播 /gps 帧
    if (OUTDOOR_MODE) {
      gpsSegProgress += 0.015  // 每 tick 推进 1.5%，约 67 ticks (6.7s) 走完一段
      if (gpsSegProgress >= 1) {
        gpsSegProgress = 0
        gpsSegIdx = (gpsSegIdx + 1) % (GpsRoute.length - 1)
      }
      const from = GpsRoute[gpsSegIdx]
      const to = GpsRoute[gpsSegIdx + 1]
      const lng = from.lng + (to.lng - from.lng) * gpsSegProgress
      const lat = from.lat + (to.lat - from.lat) * gpsSegProgress
      const headingDeg = Math.atan2(to.lat - from.lat, to.lng - from.lng) * 180 / Math.PI
      const heading180 = ((headingDeg % 360) + 360) % 360

      // 低通滤波平滑
      gpsLastLngLat = { lng, lat }

      broadcastG1({
        topic: '/gps',
        data: {
          deviceId: 'g1-001',
          lng,
          lat,
          alt: 45,                  // 朝阳大悦城海拔约 45m
          heading: heading180,       // 0-360, 正北=0
          speed: 0.6,                // m/s
          accuracy: 2.0,
          coordsys: 'gcj02',          // mock 直接用 GCJ-02（真实场景若 WGS-84 需纠偏）
          ts: Date.now(),
        },
      })
    }

    // 不舍入直接广播全精度坐标：0.01m 舍入会让前端逐 tick 差分航向振荡 ±8°
    // （前端虽有速度向量 EMA 兜底，但没必要从源头引入噪声）
    const x = g1Pos.x
    const y = g1Pos.y

    // ─── 统一步态相位 ──────────────────────────────────
    // 所有关节共享同一个 gaitPhase，通过固定相位偏移实现协调
    //
    // 相位约定（对侧协同 contralateral gait）：
    //   左腿  phase = φ        (0 → π 前摆, π → 2π 后蹬)
    //   右腿  phase = φ + π    (与左腿交替)
    //   右臂  phase = φ        (与左腿同相 → 左腿前迈时右臂前摆 ✅)
    //   左臂  phase = φ + π    (与右腿同相 → 右腿前迈时左臂前摆 ✅)
    //
    // 真实人形走路 = 左腿+右臂 同步 / 右腿+左臂 同步
    //
    // 步态频率: gaitFreq Hz → 周期 1/gaitFreq 秒
    // Unitree G1 约 0.6~0.8 Hz 舒适步速
    const gaitFreq = 0.7
    const φ = (Date.now() / 1000) * gaitFreq * Math.PI * 2

    // 辅助：只在摆动腿（sin > 0）时弯曲，支撑腿保持伸直
    const flex = (p, amp) => Math.max(0, Math.sin(p)) * amp

    // 2026-08-29 修复：/gps 和 /state 同时广播
    //   /gps  → FleetMapPage 室外地图用（经纬度）
    //   /state → RobotViewer 室内 3D 用（本地坐标 + 关节步态）
    // 之前 OUTDOOR_MODE=true 时只广播 /gps，导致 RobotViewer 拿不到 position/joints
    broadcastG1({
      topic: '/state',
      data: {
        percentage: Math.round(g1Battery),
        voltage: 54.2 - (85 - g1Battery) * 0.1,
        position: { x, y, yaw: g1Heading },
        joints: {
          // ─── 腰部 3：轻微 counter-rotation + 微前倾 ───
          waist_yaw_joint:  Math.sin(φ + Math.PI) * 0.08,   // 骨盆反向旋转，抵消下肢转动
          waist_roll_joint: Math.sin(φ * 2) * 0.05,         // 轻度左右摆
          waist_pitch_joint: 0.03,                           // 固定微前倾
          // ─── 左腿 6 ───
          left_hip_pitch_joint: Math.sin(φ) * 0.35,          // 髋屈伸
          left_hip_roll_joint:  Math.sin(φ * 2) * 0.08,      // 轻度侧摆
          left_hip_yaw_joint:   Math.sin(φ) * 0.06,          // 小幅度内旋外旋
          left_knee_joint:      flex(φ - 0.2, 0.55),         // 摆动期弯，提前 0.2 rad 开始弯
          left_ankle_pitch_joint: Math.sin(φ + 0.3) * 0.18,  // 踝关节屈伸，跟随髋稍超前
          left_ankle_roll_joint:  Math.sin(φ * 2) * 0.04,
          // ─── 右腿 6（与左腿反相 π） ───
          right_hip_pitch_joint: Math.sin(φ + Math.PI) * 0.35,
          right_hip_roll_joint:  Math.sin(φ * 2 + Math.PI) * 0.08,
          right_hip_yaw_joint:   Math.sin(φ + Math.PI) * 0.06,
          right_knee_joint:      flex(φ + Math.PI - 0.2, 0.55),
          right_ankle_pitch_joint: Math.sin(φ + Math.PI + 0.3) * 0.18,
          right_ankle_roll_joint:  Math.sin(φ * 2 + Math.PI) * 0.04,
          // ─── 左臂 7（与右腿同相 = φ + π，对侧协同） ───
          left_shoulder_pitch_joint: Math.sin(φ + Math.PI) * 0.28,  // 臂摆幅比腿小
          left_shoulder_roll_joint:  0.06,                            // 固定外展角，离开身体
          left_shoulder_yaw_joint:   Math.sin(φ) * 0.06,
          left_elbow_joint:          flex(φ + Math.PI - 0.1, 0.5),   // 摆动时肘微弯
          left_wrist_roll_joint:     Math.sin(φ + Math.PI) * 0.04,
          left_wrist_pitch_joint:    Math.sin(φ + Math.PI) * 0.04,
          left_wrist_yaw_joint:      0,
          // ─── 右臂 7（与左腿同相 = φ，对侧协同） ───
          right_shoulder_pitch_joint: Math.sin(φ) * 0.28,
          right_shoulder_roll_joint:  -0.06,                         // 右臂外展方向相反
          right_shoulder_yaw_joint:    Math.sin(φ + Math.PI) * 0.06,
          right_elbow_joint:           flex(φ - 0.1, 0.5),
          right_wrist_roll_joint:      Math.sin(φ) * 0.04,
          right_wrist_pitch_joint:     Math.sin(φ) * 0.04,
          right_wrist_yaw_joint:       0,
          // 兼容旧版 key（G1Dog 使用）
          hip_l: Math.sin(φ) * 0.3,
          hip_r: Math.sin(φ + Math.PI) * 0.3,
          knee_l: flex(φ - 0.2, 0.5),
          knee_r: flex(φ + Math.PI - 0.2, 0.5),
        },
      },
    })

    // 阈值告警
    if (g1Battery <= 20 && g1LastAlertLevel > 20) {
      broadcastG1({ topic: '/alert', data: { code: 'W_BATTERY_LOW', msg: '电量低于20%，建议回充' } })
      g1LastAlertLevel = 20
    }
    if (g1Battery <= 10 && g1LastAlertLevel > 10) {
      broadcastG1({ topic: '/alert', data: { code: 'E_BATTERY_CRITICAL', msg: '电量极低，已停止运动' } })
      g1LastAlertLevel = 10
    }
  }, 100)

  // 2026-08-28 ticker 全局常驻：任何客户端断开都不清 interval（最后一个断开时靠 clients.size===0 空转跳过）
  ws.on('close', () => { console.log('[mock] G1 client disconnected') })
})

// ───────────────────────── 擎朗 Peanut（8081）─────────────────────────
const wssKeenon = new WebSocketServer({ port: 8081 })
let peanutBattery = 92
let peanutPos = { x: -2.0, y: 0.5 }
let peanutDir = 1
const PEANUT_SPEED = 0.025

// 2026-08-28 Peanut 与 G1 同策略：状态推进全局单 ticker + 广播，与连接数解耦
function broadcastKeenon(msg) {
  // simulate_offline 抑制（同 G1）
  if ((suppressUntil.get('KEENON-T9-01') ?? 0) > Date.now()) return
  const data = JSON.stringify(msg)
  wssKeenon.clients.forEach((c) => { if (c.readyState === WebSocket.OPEN) c.send(data) })
}

let peanutTickerStarted = false

wssKeenon.on('connection', (ws) => {
  console.log('[mock] Peanut client connected')
  // 🆕 操作面板控制指令
  ws.on('message', handleControlMessage)
  if (peanutTickerStarted) return
  peanutTickerStarted = true
  const interval = setInterval(() => {
    if (wssKeenon.clients.size === 0) return

    // 🆕 操作面板 stop/pause 冻结：位置/电量都不动，状态帧照常广播
    if (peanutPaused) {
      broadcastKeenon({
        cmd: 'state',
        payload: {
          level: Math.round(peanutBattery),
          v: 36.2 - (92 - peanutBattery) * 0.05,
          x: Math.round(peanutPos.x * 100) / 100,
          y: peanutPos.y,
          angle: peanutDir > 0 ? 0 : 180,
          status: 2,
        },
      })
      return
    }

    // 安全的 X 方向往返，避开隔墙（x=4 栅格→世界 -1.0 附近是隔墙，所以上限只开到 -1.3）
    peanutPos.x += PEANUT_SPEED * peanutDir
    if (peanutPos.x >= 2.2) peanutDir = -1
    if (peanutPos.x <= -2.0) peanutDir = 1

    peanutBattery = Math.max(0, peanutBattery - 0.03)
    if (peanutBattery <= 0) peanutBattery = 92

    broadcastKeenon({
      cmd: 'state',
      payload: {
        level: Math.round(peanutBattery),
        v: 36.2 - (92 - peanutBattery) * 0.05,
        x: Math.round(peanutPos.x * 100) / 100,
        y: peanutPos.y,
        angle: peanutDir > 0 ? 0 : 180,
        status: 2,
      },
    })
  }, 150)

  ws.on('close', () => { console.log('[mock] Peanut client disconnected') })
})

// ───────────────────────── 工业机器人（8082）─────────────────────────
// 工业机器人 Mock 数据：FANUC / KUKA / 埃斯顿 轮流广播
// 消息格式：{ type: 'industrial_state', brand: 'fanuc'|'kuka'|'estun', payload: { ... } }

// 工业机器人告警池（按品牌分组，模拟真实报警码）
const INDUSTRIAL_ALARM_POOLS = {
  fanuc: [
    { raw_code: 'SRVO-062', udm_code: 'SERVO_AMP_OVERHEAT', severity: 'warning', zh_desc: '伺服放大器过热' },
    { raw_code: 'SRVO-075', udm_code: 'J2_OVERSPEED', severity: 'error', zh_desc: '关节 2 超速' },
    { raw_code: 'SRVO-214', udm_code: 'BRAKE_TEMP_HIGH', severity: 'warning', zh_desc: '制动器温度高' },
    { raw_code: 'INTP-311', udm_code: 'PROGRAM_PAUSE', severity: 'info', zh_desc: '程序暂停' },
  ],
  kuka: [
    { raw_code: 'KSS-150', udm_code: 'SERVO_OVERLOAD', severity: 'error', zh_desc: '伺服过载' },
    { raw_code: 'KSS-220', udm_code: 'SAFETY_DOOR_OPEN', severity: 'warning', zh_desc: '安全门已打开' },
    { raw_code: 'KSS-340', udm_code: 'TOOL collisions', severity: 'warning', zh_desc: '工具碰撞检测' },
  ],
  estun: [
    { raw_code: 'EST-3003', udm_code: 'DRIVE_OVERHEAT', severity: 'warning', zh_desc: '驱动器过热' },
    { raw_code: 'EST-3008', udm_code: 'ENCODER_ERROR', severity: 'error', zh_desc: '编码器异常' },
    { raw_code: 'EST-4001', udm_code: 'COMM_LOSS', severity: 'warning', zh_desc: '通信中断' },
  ],
  yaskawa: [
    { raw_code: 'ALARM 1911034', udm_code: 'SRV_0034_SERVO_OVERLOAD', severity: 'error', zh_desc: '伺服过载（S1 电机过热）' },
    { raw_code: 'ALARM 3170', udm_code: 'PLAYBACK_ERROR', severity: 'warning', zh_desc: '再现执行异常' },
    { raw_code: 'ALARM 4317', udm_code: 'SV_0341_ADC_ERROR', severity: 'warning', zh_desc: '编码器通信异常' },
  ],
}

// ───────────── 工业机械臂运动仿真器 ─────────────
// 以前每个关节独立 sin 摆动，看着像面条舞——真机器人不这么动。
// 这里模拟真实控制器的关节空间插补：
//   1. 示教路点程序（抓取/搬运/放置 + 到位停留）
//   2. 梯形速度曲线（加速-匀速-减速），所有关节同起同止
//   3. 状态联动：WORKING 循环执行 / IDLE 回原点等料 / 报警冻结在原地
//   4. speed_rpm 从真实角速度换算，负载/电流随运动起伏

// [min, max) 区间随机数
function rand(a, b) { return a + Math.random() * (b - a) }

// 单关节梯形速度曲线的最短时间（vmax rad/s，amax rad/s²）
// 行程短走三角形轮廓，行程长走完整梯形
function trapMinTime(dq, vmax, amax) {
  const adq = Math.abs(dq)
  if (adq < 1e-6) return 0
  if (adq <= (vmax * vmax) / amax) {
    // 三角形：加减速各一半，t = 2*sqrt(dq/a)
    return 2 * Math.sqrt(adq / amax)
  }
  // 梯形：巡航 + 两侧斜坡
  return adq / vmax + vmax / amax
}

// 一段同步插补：所有关节同时起步同时到位（真实控制器的关节插补）
// 段时长 T 由最慢的关节决定，快的关节自动放慢速度陪着走
class SegProfile {
  constructor(q0, q1, T) {
    this.q0 = q0
    this.dq = q1.map((v, i) => v - q0[i])
    this.T = T
    // 加速时间取 T 的 25%，但最多 T/2（不然没匀速段了）
    this.ta = Math.min(T * 0.25, T / 2)
    // 每个关节自己的峰值速度：走 dq_i 用满 T
    this.vp = this.dq.map((d) => (T - this.ta > 0 ? d / (T - this.ta) : 0))
  }

  // t 秒时刻的位置和角速度
  sample(t) {
    const q = []
    const w = []
    for (let i = 0; i < this.dq.length; i++) {
      const d = this.dq[i]
      const vp = this.vp[i]
      let s = 0
      let v = 0
      if (t <= 0) {
        s = 0; v = 0
      } else if (t >= this.T) {
        s = d; v = 0
      } else if (t < this.ta) {
        // 加速段
        s = 0.5 * (vp / this.ta) * t * t
        v = (vp / this.ta) * t
      } else if (t <= this.T - this.ta) {
        // 匀速段
        s = vp * (t - this.ta / 2)
        v = vp
      } else {
        // 减速段：倒着算更稳
        const t2 = this.T - t
        s = d - 0.5 * (vp / this.ta) * t2 * t2
        v = (vp / this.ta) * t2
      }
      q.push(this.q0[i] + s)
      w.push(v)
    }
    return { q, w }
  }
}

// 一台机器人的仿真器：路点程序 + 状态机，内部全按壁钟时间推进
class IndustrialRobotSim {
  constructor(cfg) {
    this.cfg = cfg
    this.q = [...cfg.home]          // 当前关节角
    this.w = [0, 0, 0, 0, 0, 0]     // 当前角速度 rad/s
    this.seg = null                  // 当前运动段
    this.segStart = 0
    this.dwellUntil = 0              // 到位停留的截止时刻
    this.stepIdx = 0                 // 程序执行到第几个路点
    this.mode = 'working'            // working | idle
    this.cycles = 0                  // 本次会话跑完的整循环数
    this.alarm = null                // 活动告警（null = 无）
    this.alarmUntil = 0
    this.nextAlarmAt = Date.now() + rand(30e3, 90e3)
    this.idleAt = Date.now() + rand(35e3, 80e3)  // 下次进入等料窗口
    this.workAt = 0                  // 等料结束恢复生产的时刻
    this.temp = [...cfg.temp]        // 关节温度（会慢慢漂）
    this.lastT = Date.now()
    // 一键演示剧本注入区（null = 不注入，走自然仿真）
    this.demoLoad = null            // 数组：整组负载覆盖
    this.demoTemp = null            // { joint, value }：单关节温度覆盖
    this.demoAlarm = null           // 剧本告警对象
  }

  // 推进一个时刻，返回 { q, w, status, alarms }
  sample(now) {
    const c = this.cfg

    // ── 一键演示剧本注入：demoAlarm 由剧本设置/撤除，优先级最高 ──
    if (this.demoAlarm) {
      if (!this.alarm) {
        this.alarm = { ...this.demoAlarm, occurred_at: new Date(now).toISOString(), cleared: false, emitted: false }
        this.alarmUntil = Infinity // 剧本告警不走自然恢复，由剧本控制解除
      }
    } else if (this.alarm && this.alarmUntil === Infinity) {
      // 剧本撤了告警：立即解除，从当前位置恢复运动
      this.alarm = null
      this.nextAlarmAt = now + rand(50e3, 100e3)
      this.seg = null
    }

    // ── 报警事件：到点触发，持续一阵自己恢复 ──
    if (this.alarm) {
      if (now >= this.alarmUntil) {
        this.alarm = null
        this.nextAlarmAt = now + rand(50e3, 100e3)
        this.seg = null // 解除后从当前位置重建运动段（真实控制器恢复执行）
      }
    } else if (now >= this.nextAlarmAt) {
      const pool = INDUSTRIAL_ALARM_POOLS[c.brand] || []
      if (pool.length > 0) {
        const a = pool[Math.floor(Math.random() * pool.length)]
        this.alarm = { ...a, occurred_at: new Date(now).toISOString(), cleared: false, emitted: false }
        this.alarmUntil = now + rand(12e3, 25e3)
      } else {
        this.nextAlarmAt = now + 60e3
      }
    }

    // ── 等料窗口：工作一段时间歇一会儿，模拟上游没料/换型 ──
    if (!this.alarm) {
      if (this.mode === 'working' && now >= this.idleAt) {
        this.mode = 'idle'
        this.workAt = now + rand(8e3, 20e3)
        this.seg = null
      } else if (this.mode === 'idle' && now >= this.workAt) {
        this.mode = 'working'
        this.idleAt = now + rand(40e3, 90e3)
        this.stepIdx = 0
        this.seg = null
      }
    }

    // ── 运动推进 ──
    if (this.alarm) {
      // 报警冻结：位置保持，速度清零（急停锁轴）
      this.w = [0, 0, 0, 0, 0, 0]
    } else if (this.mode === 'working') {
      this.advance(now, c.program[this.stepIdx], () => {
        this.stepIdx = (this.stepIdx + 1) % c.program.length
        if (this.stepIdx === 0) this.cycles++
      })
    } else {
      // 空闲：慢速回 home 停着
      this.advance(now, { q: c.home, dwell: 0, v: 0.4 })
    }

    // ── 温度：向「基线 + 运动热量」一阶惯性漂移 ──
    const dt = Math.max(0, (now - this.lastT) / 1000)
    this.lastT = now
    for (let i = 0; i < this.temp.length; i++) {
      const motion = Math.min(1, Math.abs(this.w[i]) / c.vmax[i])
      const target = c.temp[i] + 6 * motion
      this.temp[i] += (target - this.temp[i]) * Math.min(1, dt / 90)
    }

    // ── 组装状态和告警 ──
    let status
    if (this.alarm) {
      status = this.alarm.severity === 'error' ? 'error' : 'idle'
    } else {
      status = this.mode
    }

    // 告警只在触发那一帧发出去，前端 alertStore 会累积存着；
    // 持续发同一条会把 store 刷爆（那边没去重）
    const alarms = []
    if (this.alarm && !this.alarm.emitted) {
      this.alarm.emitted = true
      const { emitted, ...a } = this.alarm
      alarms.push(a)
    }

    return { q: this.q, w: this.w, status, alarms }
  }

  // 朝目标路点推进一段（梯形插补 + 到位停留）
  advance(now, step, onDone) {
    const c = this.cfg
    if (!this.seg) {
      const diff = Math.max(...step.q.map((qi, i) => Math.abs(qi - this.q[i])))
      if (diff < 1e-4) {
        // 已在目标位上，看停留到没到
        this.w = [0, 0, 0, 0, 0, 0]
        if (now >= this.dwellUntil && onDone) onDone()
        return
      }
      const vScale = step.v ?? 1
      const times = step.q.map((qi, i) => trapMinTime(qi - this.q[i], c.vmax[i] * vScale, c.amax[i]))
      this.seg = new SegProfile(this.q, step.q, Math.max(...times))
      this.segStart = now
    }
    const t = (now - this.segStart) / 1000
    if (t >= this.seg.T) {
      // 到位：吸附终点，进入停留（模拟抓取/放料动作）
      this.q = [...step.q]
      this.w = [0, 0, 0, 0, 0, 0]
      this.seg = null
      this.dwellUntil = now + (step.dwell ?? 0) * 1000
      if ((step.dwell ?? 0) === 0 && onDone) onDone()
    } else {
      const r = this.seg.sample(t)
      this.q = r.q
      this.w = r.w
    }
  }
}

// 简化正运动学：底座旋转 + 平面二连杆，估个 TCP 大致位置
// 够 mock 遥测用了，别拿去算碰撞
function approxFK(q, d) {
  const [j1, j2, j3, j4, j5, j6] = q
  const r = d.shoulderX + d.upperArm * Math.sin(j2) + d.forearm * Math.sin(j2 + j3)
  const z = d.baseH + d.upperArm * Math.cos(j2) + d.forearm * Math.cos(j2 + j3)
  return {
    x: +(Math.cos(j1) * r * 1000).toFixed(1),
    y: +(Math.sin(j1) * r * 1000).toFixed(1),
    z: +(Math.max(0, z) * 1000).toFixed(1),
    rx: +((j4 * 180) / Math.PI).toFixed(1),
    ry: +((j5 * 180) / Math.PI).toFixed(1),
    rz: +((j6 * 180) / Math.PI).toFixed(1),
  }
}

// 四台机器人的仿真配置：
// vmax/amax 参考 3D 模型用的官方 URDF 参数（不同机型速度档位不一样）
// 路点角度都对着各自 URDF 的零位约定调过，浏览器里肉眼验过型
const ROBOT_SIM_CFG = [
  {
    brand: 'fanuc',
    id: 'FANUC_M20iD_001',
    model: 'M-20iD/25',
    // 机床上下料：左侧取件 → 右侧放件，典型的双工位节拍
    home: [0, 0.3, -0.5, 0, 0.2, 0],
    program: [
      { q: [0.7, 0.85, -1.15, 0, 0.45, 0.7], dwell: 0.7, v: 1.0 },   // 取料点上方（快进）
      { q: [0.7, 1.15, -1.55, 0, 0.4, 0.7], dwell: 0.9, v: 0.45 },    // 下降取料（慢，护工件）
      { q: [0.7, 0.75, -1.0, 0, 0.5, 0.7], dwell: 0.3, v: 0.6 },     // 抬升
      { q: [-0.6, 0.75, -1.0, 0, 0.5, -0.7], dwell: 0, v: 0.85 },    // 旋转到放料侧
      { q: [-0.6, 1.15, -1.55, 0, 0.4, -0.7], dwell: 0.9, v: 0.45 }, // 下降放料
      { q: [-0.6, 0.85, -1.15, 0, 0.45, -0.7], dwell: 0.3, v: 0.6 }, // 抬升
      { q: [0, 0.3, -0.5, 0, 0.2, 0], dwell: 0, v: 0.9 },            // 回 home
    ],
    vmax: [2.25, 2.1, 2.9, 3.75, 3.1, 4.6],
    amax: [5.6, 5.2, 7.2, 9.4, 7.8, 11.5],
    load: [72, 62, 38, 30, 25, 18],      // 正常基线；超载演示由一键演示剧本动态注入
    temp: [41, 67, 38, 35, 33, 31],
    current: [3.1, 5.4, 2.1, 1.8, 1.2, 0.9],
    health: [88, 54, 92, 95, 97, 99],
    rul: { 2: 9 },                          // J2 剩余寿命 9 天（演示）
    fk: { baseH: 0.525, shoulderX: 0.15, upperArm: 0.79, forearm: 0.935 },
    runtime: {
      power_on_hours: 18432,
      operating_hours: 15200,
      cycle_count: 120321,
      last_maintenance_at: '2026-06-15T10:00:00+08:00',
      payload_kg: 12,
    },
    extensions: () => ({
      r_register_200: Math.floor(Math.random() * 100),
      d_parameter_101: +(5 + Math.random() * 2).toFixed(2),
      tool_life_remaining: Math.floor(800 + Math.random() * 200),
      macro_status: 'M98 P1001',
      servo_alarm_history: '无',
    }),
  },
  {
    brand: 'kuka',
    id: 'KUKA_KR6_001',
    model: 'KR 6 R900 sixx',
    // 小件装配插装：取件 → 转位 → 慢速下插 → 拔出，节拍快行程小
    home: [0, 0.45, -0.35, 0, -0.1, 0],
    program: [
      { q: [0.6, 0.55, -0.55, 0, -0.1, 0.6], dwell: 0.5, v: 1.0 },   // 取件
      { q: [-0.6, 0.55, -0.55, 0, -0.1, -0.6], dwell: 0.3, v: 0.9 }, // 转到装配位
      { q: [-0.6, 0.75, -0.35, 0, -0.2, -0.6], dwell: 0.7, v: 0.35 },// 慢速下插
      { q: [-0.6, 0.55, -0.55, 0, -0.1, -0.6], dwell: 0.2, v: 0.35 },// 拔出
      { q: [0, 0.45, -0.35, 0, -0.1, 0], dwell: 0, v: 0.8 },         // 回 home
    ],
    vmax: [2.63, 2.51, 3.4, 4.71, 4.3, 5.24], // AGILUS 是快枪手
    amax: [6.6, 6.3, 8.5, 11.8, 10.8, 13.1],
    load: [35, 55, 40, 22, 18, 12],
    temp: [36, 42, 37, 32, 30, 28],
    current: [2.0, 3.0, 2.2, 1.1, 0.8, 0.5],
    health: [90, 82, 88, 95, 97, 99],
    rul: {},
    fk: { baseH: 0.4, shoulderX: 0.025, upperArm: 0.455, forearm: 0.5 },
    runtime: {
      power_on_hours: 12300,
      cycle_count: 85000,
      last_maintenance_at: '2026-07-01T10:00:00+08:00',
    },
    extensions: () => ({
      safety_gate_open: Math.random() > 0.8,
      robroot_offset_x: +(Math.random() * 0.5).toFixed(3),
      robroot_offset_y: +(Math.random() * 0.5).toFixed(3),
      safety_controller_state: 'ACTIVE',
      axis_soft_limit: '正常',
    }),
  },
  {
    brand: 'estun',
    id: 'ESTUN_ER3A_001',
    model: 'ER3A-C60',
    // 码垛：进料位取 → 两个放料角轮流放，层数多了就这样跑
    home: [0, 0.25, -0.4, 0, 0.15, 0],
    program: [
      { q: [0.9, 0.6, 0.4, 0, 0.3, 0.9], dwell: 0.5, v: 1.0 },
      { q: [0.9, 0.35, 0.15, 0, 0.4, 0.9], dwell: 0.2, v: 0.7 },
      { q: [0.45, 0.35, 0.15, 0, 0.4, 0.45], dwell: 0, v: 0.8 },
      { q: [0.45, 0.7, 0.55, 0, 0.25, 0.45], dwell: 0.8, v: 0.4 },
      { q: [0.45, 0.35, 0.15, 0, 0.4, 0.45], dwell: 0.2, v: 0.5 },
      { q: [-0.45, 0.35, 0.15, 0, 0.4, -0.45], dwell: 0, v: 0.8 },
      { q: [-0.45, 0.7, 0.55, 0, 0.25, -0.45], dwell: 0.8, v: 0.4 },
      { q: [-0.45, 0.35, 0.15, 0, 0.4, -0.45], dwell: 0.2, v: 0.5 },
      { q: [0, 0.25, -0.4, 0, 0.15, 0], dwell: 0, v: 0.9 },
    ],
    vmax: [2.1, 2.0, 2.6, 3.3, 3.0, 4.1],
    amax: [5.2, 5.0, 6.5, 8.2, 7.5, 10.2],
    load: [28, 42, 35, 20, 15, 10],
    temp: [34, 39, 36, 31, 29, 27],
    current: [1.5, 2.3, 1.9, 0.9, 0.6, 0.4],
    health: [93, 85, 90, 96, 98, 99],
    rul: {},
    fk: { baseH: 0.391, shoulderX: 0.04, upperArm: 0.43, forearm: 0.525 },
    runtime: {
      power_on_hours: 5600,
      cycle_count: 42000,
    },
    extensions: () => ({
      energy_consumption: +(1.2 + Math.random() * 0.8).toFixed(2),
      plc_extension: 'M1 Y0',
      custom_alarm_word: 0,
    }),
  },
  {
    brand: 'yaskawa',
    id: 'YASKAWA_GP7_001',
    model: 'GP7-6L',
    // 搬运 + 腕部翻转：转移过程中 J6 翻腕换向，放置姿态和抓取姿态不同
    home: [0, 0.35, -0.6, 0, 0.25, 0],
    program: [
      { q: [0.8, 0.8, -1.1, 0, 0.4, 0.8], dwell: 0.6, v: 1.0 },
      { q: [0.8, 0.55, -0.75, 0, 0.5, 0.8], dwell: 0.3, v: 0.65 },
      { q: [-0.8, 0.55, -0.75, 0, 0.5, -2.3], dwell: 0, v: 0.8 },
      { q: [-0.8, 0.8, -1.1, 0, 0.4, -2.3], dwell: 0.6, v: 0.5 },
      { q: [-0.8, 0.55, -0.75, 0, 0.5, -0.8], dwell: 0.2, v: 0.65 },
      { q: [0, 0.35, -0.6, 0, 0.25, 0], dwell: 0, v: 0.9 },
    ],
    vmax: [2.25, 2.1, 2.9, 3.75, 3.1, 4.6],
    amax: [5.6, 5.2, 7.2, 9.4, 7.8, 11.5],
    load: [33, 48, 38, 24, 16, 11],
    temp: [35, 40, 37, 32, 30, 28],
    current: [1.8, 2.6, 2.0, 1.0, 0.7, 0.5],
    health: [92, 86, 90, 95, 97, 99],
    rul: {},
    fk: { baseH: 0.33, shoulderX: 0.04, upperArm: 0.445, forearm: 0.44 },
    runtime: {
      power_on_hours: 9800,
      cycle_count: 76500,
    },
    extensions: () => ({
      pulse_converter_status: '正常',
      torch_alarm_word: 0,
    }),
  },
]

const industrialSims = ROBOT_SIM_CFG.map((cfg) => new IndustrialRobotSim(cfg))

// ───────────── 一键演示剧本 ─────────────
// BP 路演用：90 秒演完「监测 → 预警 → 告警 → 恢复」闭环
// 前端发 { topic: '/demo' } 到 8082 触发；剧本直接注入遥测（负载爬升/告警锁定），
// 告警走正常 industrial_state 通道，前端的 alertStore / AI 洞察 / webhook 全链路都会被自然带动
const DEMO_ROBOT_ID = 'FANUC_M20iD_001'
const DEMO_JOINT = 2                 // J2 主轴：负载爬升的主角
const DEMO_PHASES = [
  { name: 'ramp',    dur: 22000, label: 'J2 负载持续爬升（黄色预警 → 红色超载）' },
  { name: 'alarm',   dur: 22000, label: '触发伺服过载告警，关节锁定' },
  { name: 'recover', dur: 12000, label: '告警解除，负载回落恢复生产' },
]
const DEMO_ALARM = { raw_code: 'SRVO-023', udm_code: 'SERVO_OVERLOAD', severity: 'error', zh_desc: '伺服过载（J2 轴电机过热）' }
const DEMO_BASE_LOAD = [72, 62, 38, 30, 25, 18]   // 正常态（J2 62）
const DEMO_PEAK_LOAD = [78, 128, 44, 32, 26, 19]  // 告警态（J2 128 红色超载）
const DEMO_BASE_TEMP = 42                          // J2 正常温度
const DEMO_PEAK_TEMP = 84                         // J2 过热温度

let demoRun = null  // { sim, t0 }

function demoTotalMs() {
  return DEMO_PHASES.reduce((s, p) => s + p.dur, 0)
}

// 推进剧本：每帧调用，往 sim 上注入负载/温度/告警覆盖
function updateDemo(now) {
  if (!demoRun) return null
  const el = now - demoRun.t0
  const sim = demoRun.sim
  if (el >= demoTotalMs()) {
    // 剧本结束：清掉所有注入，回到自然仿真
    sim.demoLoad = null
    sim.demoTemp = null
    sim.demoAlarm = null
    demoRun = null
    return { phase: 'done', label: '演示完成', elapsed: el, total: demoTotalMs() }
  }

  // 找当前所处阶段
  let acc = 0
  let phase = DEMO_PHASES[0]
  let phaseStart = 0
  for (const p of DEMO_PHASES) {
    if (el < acc + p.dur) { phase = p; phaseStart = acc; break }
    acc += p.dur
  }
  const p = (el - phaseStart) / phase.dur  // 阶段内进度 0~1

  if (phase.name === 'ramp') {
    // 负载/温度从基线爬到峰值：80% 前慢（酝酿），后面加速冲红线
    const ease = p * p
    sim.demoLoad = DEMO_BASE_LOAD.map((v, i) =>
      i === DEMO_JOINT - 1 ? Math.round(v + (DEMO_PEAK_LOAD[i] - v) * ease) : v + Math.round(p * 3))
    sim.demoTemp = { joint: DEMO_JOINT, value: +(DEMO_BASE_TEMP + (DEMO_PEAK_TEMP - DEMO_BASE_TEMP) * ease).toFixed(1) }
    sim.demoAlarm = null
  } else if (phase.name === 'alarm') {
    // 锁定在峰值 + 告警（sample() 里会冻结关节、置 error 状态、发出告警事件）
    sim.demoLoad = [...DEMO_PEAK_LOAD]
    sim.demoTemp = { joint: DEMO_JOINT, value: DEMO_PEAK_TEMP }
    if (!sim.demoAlarm) {
      sim.demoAlarm = { ...DEMO_ALARM, occurred_at: new Date(now).toISOString(), cleared: false, emitted: false }
      console.log(`[demo] ⚠️ 触发告警: ${DEMO_ROBOT_ID} ${DEMO_ALARM.raw_code} ${DEMO_ALARM.zh_desc}`)
    }
  } else {
    // 恢复：负载/温度回落，告警解除
    const back = 1 - p
    sim.demoLoad = DEMO_PEAK_LOAD.map((v, i) =>
      i === DEMO_JOINT - 1 ? Math.round(DEMO_BASE_LOAD[i] + (v - DEMO_BASE_LOAD[i]) * back) : DEMO_BASE_LOAD[i])
    sim.demoTemp = { joint: DEMO_JOINT, value: +(DEMO_PEAK_TEMP + (DEMO_BASE_TEMP - DEMO_PEAK_TEMP) * p).toFixed(1) }
    sim.demoAlarm = null
  }
  return { phase: phase.name, label: phase.label, elapsed: el, total: demoTotalMs() }
}

function startDemo(robotId) {
  const sim = industrialSims.find((s) => s.cfg.id === robotId)
  if (!sim) {
    console.log(`[demo] 找不到机器人 ${robotId}，忽略`)
    return false
  }
  // 剧本开始前先清场（上一个剧本的残留）
  sim.demoLoad = null
  sim.demoTemp = null
  sim.demoAlarm = null
  sim.alarm = null
  // 剧本期间压住随机告警，别让 KSS/SRVO 杂告警抢戏
  sim.nextAlarmAt = Date.now() + demoTotalMs() + 30e3
  demoRun = { sim, t0: Date.now() }
  console.log(`[demo] ▶ 一键演示启动: ${robotId}，总时长 ${demoTotalMs() / 1000}s`)
  return true
}

// 演示状态帧（跟遥测同通道广播，前端 demoStore 消费）
function buildDemoFrame(status) {
  if (!status) return null
  return {
    type: 'demo_status',
    robotId: DEMO_ROBOT_ID,
    phase: status.phase,
    label: status.label,
    elapsed: Math.round(status.elapsed),
    total: status.total,
  }
}

// 组装一帧工业遥测（UDP 报文格式跟以前保持一致，前端适配器不用改）
function buildIndustrialFrame(sim) {
  const now = Date.now()
  const s = sim.sample(now)
  const c = sim.cfg
  const joints = s.q.map((ang, i) => {
    // 运动强度 0~1：负载/电流跟着它起伏，静下来就掉回基线
    const motion = Math.min(1, Math.abs(s.w[i]) / c.vmax[i])
    const loadBase = sim.demoLoad ?? c.load
    return {
      j: i + 1,
      angle_rad: +ang.toFixed(4),
      load_pct: Math.round(loadBase[i] * (0.97 + 0.06 * motion)),
      temp_c: sim.demoTemp && sim.demoTemp.joint === i + 1 ? sim.demoTemp.value : +sim.temp[i].toFixed(1),
      current_a: +(c.current[i] * (0.55 + 0.75 * motion)).toFixed(1),
      speed_rpm: Math.round((Math.abs(s.w[i]) * 60) / (2 * Math.PI)),
      health_score: c.health[i],
      rul_days: c.rul[i + 1],
    }
  })
  return {
    type: 'industrial_state',
    brand: c.brand,
    payload: {
      robot_id: c.id,
      model: c.model,
      timestamp: new Date(now).toISOString(),
      status: s.status,
      pose: approxFK(s.q, c.fk),
      joints,
      alarms: s.alarms,
      runtime: { ...c.runtime, cycle_count: c.runtime.cycle_count + sim.cycles },
      extensions: c.extensions(),
    },
  }
}

const wssIndustrial = new WebSocketServer({ port: 8082 })
let industrialIdx = 0
let demoTick = 0

wssIndustrial.on('connection', (ws) => {
  console.log('[mock] Industrial client connected')
  // 连接后立即推一台
  ws.send(JSON.stringify(buildIndustrialFrame(industrialSims[0])))
  // 指令入口：/demo 一键演示（前端 demoStore）+ /control 操作面板控制指令
  ws.on('message', (buf) => {
    try {
      const msg = JSON.parse(buf.toString())
      if (msg?.topic === '/demo') {
        startDemo(msg.data?.robotId || DEMO_ROBOT_ID)
      } else if (msg?.topic === '/control' && msg.data) {
        applyExternalCommand(msg.data)
      }
    } catch {
      // 心跳等非 JSON 帧，忽略
    }
  })
})

// 125ms 轮流广播一台（每台 2Hz，总 8 帧/s）
// 以前 5s 才轮一台，运动仿真需要密一点的采样才能看出梯形速度曲线
setInterval(() => {
  if (wssIndustrial.clients.size === 0) return
  // 演示剧本推进（每 tick 一次，注入到目标 sim 上）
  const demoStatus = updateDemo(Date.now())
  // 🆕 simulate_offline 抑制：被操作面板置离线的机器人跳过广播
  let sim = null
  for (let i = 0; i < industrialSims.length; i++) {
    industrialIdx = (industrialIdx + 1) % industrialSims.length
    const candidate = industrialSims[industrialIdx]
    if ((suppressUntil.get(candidate.cfg.id) ?? 0) < Date.now()) { sim = candidate; break }
  }
  if (!sim) return
  const data = JSON.stringify(buildIndustrialFrame(sim))
  wssIndustrial.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(data)
      // 演示状态帧 4 倍降频（2Hz），done 帧只发一次不降频
      if (demoStatus && (demoTick % 4 === 0 || demoStatus.phase === 'done')) {
        client.send(JSON.stringify(buildDemoFrame(demoStatus)))
      }
    }
  })
  demoTick++
}, 125)

console.log('[mock] WS servers running:')
console.log('  G1         → ws://localhost:8080  (8方向避障巡航)')
console.log('  Peanut     → ws://localhost:8081')
console.log('  Industrial → ws://localhost:8082  (4品牌关节插补运动仿真, 2Hz/台)')
console.log(`[mock] 栅格地图: ${GRID.cols}x${GRID.rows}  世界范围 X: [${GRID_OX}, ${GRID_OX + GRID.cols * GRID.cellSize}]  Z: [${GRID_OZ}, ${GRID_OZ + GRID.rows * GRID.cellSize}]`)

// 2026-08-21 OTA mock 广播：模拟 ota-agent 上报状态到 MQTT broker
// 在真实环境中由 ota_agent.py 上报到 roboticsops/ota/{robot_id}/status
// mock 模式：通过 WebSocket 以 industrial 通道携带 OTA 状态帧
// 让 wsHub 的 OTA 分流能收到数据（模拟模式无独立 MQTT broker 时降级）
const OTA_ROBOTS = [
  { robotId: 'FANUC_M20iD_001', version: '1.1.3' },
  { robotId: 'KUKA_KR6_001',     version: '1.1.3' },
  { robotId: 'ESTUN_ER3A_001',  version: '1.1.3' },
]
const OTA_STATES = ['IDLE', 'DOWNLOADING', 'VERIFYING', 'INSTALLING', 'HEALTH_CHECK', 'SUCCESS']
let otaIdx = 0

setInterval(() => {
  const target = OTA_ROBOTS[otaIdx % OTA_ROBOTS.length]
  const stateIdx = otaIdx % OTA_STATES.length
  const state = OTA_STATES[stateIdx]
  const progress = stateIdx === 0 ? 0 : stateIdx === 1 ? 25 : stateIdx === 2 ? 50 : stateIdx === 3 ? 75 : stateIdx === 4 ? 90 : 100
  const version = state === 'SUCCESS' ? '1.2.0' : target.version

  // 构造 OTA 状态消息（通过 industrial WS 通道携带，前端 wsHub 会按 type 分流）
  const otaMsg = {
    type: 'ota_status',
    robotId: target.robotId,
    state,
    progress,
    version,
    message: state === 'IDLE' ? 'agent idle' : state === 'SUCCESS' ? 'upgrade success' : `mock ${state.toLowerCase()}`,
    campaign_id: `cmp-mock-${otaIdx}`,
  }
  // 广播到所有 8082 连接
  wssIndustrial.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify(otaMsg))
    }
  })
  otaIdx++
}, 8000) // 每 8 秒推一台设备的下一个状态

console.log('  OTA        → via ws://localhost:8082  (OTA 状态轮播 8s/帧)')

