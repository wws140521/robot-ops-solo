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
  const { gx, gy } = worldToGrid(wx, wz)
  if (gx < 0 || gy < 0 || gx >= GRID.cols || gy >= GRID.rows) return true
  return LAYOUT[gy][gx] === 1
}

// ───────────────────────── 宇树 G1（8080）─────────────────────────
const wssUnitree = new WebSocketServer({ port: 8080 })
let g1Battery = 85
let g1HasSpoken = false
let g1LastAlertLevel = 100

// 机器人状态：位置 + 当前目标点
let g1Pos = { x: 0, y: 0 } // 世界坐标
let g1Heading = 0 // 弧度，当前朝向
const G1_SPEED = 0.03 // 每 tick 前进距离

// 航点路径（餐厅内安全巡逻点，均为空地）
const WAYPOINTS = [
  { x:  0.0, y:  0.0 }, // 起点（中心）
  { x:  2.0, y:  0.0 }, // 东部通道
  { x:  2.0, y:  1.5 }, // 东北角
  { x: -1.0, y:  1.5 }, // 北段通道（避开 x<-2 隔墙）
  { x: -1.0, y: -1.0 }, // 西侧通道
  { x:  0.5, y: -1.0 }, // 西南段
  { x:  0.5, y: -1.8 }, // 南部（出餐口附近，B点播报）
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
  const data = JSON.stringify(msg)
  wssUnitree.clients.forEach((c) => { if (c.readyState === WebSocket.OPEN) c.send(data) })
}

// 2026-08-28 状态推进全局单 ticker：G1 状态机（位置/避障/电量/播报）与连接数解耦，
// 无论多少客户端订阅，状态推进速度恒定（0.05/tick）
let g1TickerStarted = false

wssUnitree.on('connection', (ws) => {
  console.log('[mock] G1 client connected')
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

    // 5. 朝向平滑过渡（避免瞬间拐弯太硬）
    let hd = bestHeading - g1Heading
    hd = ((hd + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI
    const MAX_TURN = 0.15 // 每 tick 最大转向弧度
    if (Math.abs(hd) <= MAX_TURN) g1Heading = bestHeading
    else g1Heading += Math.sign(hd) * MAX_TURN

    // 6. 按当前朝向前进
    g1Pos.x += Math.cos(g1Heading) * G1_SPEED
    g1Pos.y += Math.sin(g1Heading) * G1_SPEED

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

    // 8. 电量递减，到 0 重置
    g1Battery = Math.max(0, g1Battery - 0.05)
    if (g1Battery <= 0) { g1Battery = 85; g1LastAlertLevel = 100 }

    const x = Math.round(g1Pos.x * 100) / 100
    const y = Math.round(g1Pos.y * 100) / 100
    const jointsAngle = Date.now() / 250

    broadcastG1({
      topic: '/state',
      data: {
        percentage: Math.round(g1Battery),
        voltage: 54.2 - (85 - g1Battery) * 0.1,
        position: { x, y, yaw: g1Heading },
        joints: {
          hip_l: Math.sin(jointsAngle * 4) * 0.3,
          hip_r: Math.sin(jointsAngle * 4 + Math.PI) * 0.3,
          knee_l: Math.abs(Math.sin(jointsAngle * 4)) * 0.5,
          knee_r: Math.abs(Math.sin(jointsAngle * 4 + Math.PI)) * 0.5,
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
  const data = JSON.stringify(msg)
  wssKeenon.clients.forEach((c) => { if (c.readyState === WebSocket.OPEN) c.send(data) })
}

let peanutTickerStarted = false

wssKeenon.on('connection', (ws) => {
  console.log('[mock] Peanut client connected')
  if (peanutTickerStarted) return
  peanutTickerStarted = true
  const interval = setInterval(() => {
    if (wssKeenon.clients.size === 0) return

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
}

// 随机生成工业告警（15% 概率每次发一条）
function generateIndustrialAlarms(brand) {
  if (Math.random() > 0.15) return []
  const pool = INDUSTRIAL_ALARM_POOLS[brand] || []
  if (pool.length === 0) return []
  const alarm = pool[Math.floor(Math.random() * pool.length)]
  return [{
    ...alarm,
    occurred_at: new Date().toISOString(),
    cleared: false,
  }]
}

// 生成工业机械臂 6 轴笛卡尔 pose（模拟 TCP 位置）
function generateIndustrialPose(seed) {
  const r = (min, max) => +(min + Math.random() * (max - min)).toFixed(1)
  return {
    x: r(-500, 500),
    y: r(-500, 500),
    z: r(0, 1500),
    rx: r(-180, 180),
    ry: r(-180, 180),
    rz: r(-180, 180),
  }
}

function mockFanucTelemetry() {
  const now = new Date().toISOString()
  return {
    type: 'industrial_state',
    brand: 'fanuc',
    payload: {
      robot_id: 'FANUC_M20iD_001',
      model: 'M-20iD/25',
      timestamp: now,
      pose: generateIndustrialPose(),
      joints: [
        { j: 1, load_pct: 62, temp_c: 41, current_a: 3.1, speed_rpm: 120, health_score: 88 },
        { j: 2, load_pct: 118, temp_c: 67, current_a: 5.4, speed_rpm: 90, health_score: 54, rul_days: 9 },
        { j: 3, load_pct: 45, temp_c: 38, current_a: 2.1, speed_rpm: 150, health_score: 92 },
        { j: 4, load_pct: 30, temp_c: 35, current_a: 1.8, speed_rpm: 200, health_score: 95 },
        { j: 5, load_pct: 25, temp_c: 33, current_a: 1.2, speed_rpm: 180, health_score: 97 },
        { j: 6, load_pct: 18, temp_c: 31, current_a: 0.9, speed_rpm: 240, health_score: 99 },
      ],
      alarms: generateIndustrialAlarms('fanuc'),
      runtime: {
        power_on_hours: 18432,
        operating_hours: 15200,
        cycle_count: 120321,
        last_maintenance_at: '2026-06-15T10:00:00+08:00',
        payload_kg: 12,
      },
      extensions: {
        r_register_200: Math.floor(Math.random() * 100),
        d_parameter_101: +(5 + Math.random() * 2).toFixed(2),
        tool_life_remaining: Math.floor(800 + Math.random() * 200),
        macro_status: 'M98 P1001',
        servo_alarm_history: '无',
      },
    },
  }
}

function mockKukaTelemetry() {
  const now = new Date().toISOString()
  return {
    type: 'industrial_state',
    brand: 'kuka',
    payload: {
      robot_id: 'KUKA_KR6_001',
      model: 'KR 6 R900 sixx',
      timestamp: now,
      pose: generateIndustrialPose(),
      joints: [
        { j: 1, load_pct: 35, temp_c: 36, current_a: 2.0, speed_rpm: 100, health_score: 90 },
        { j: 2, load_pct: 55, temp_c: 42, current_a: 3.0, speed_rpm: 80, health_score: 82 },
        { j: 3, load_pct: 40, temp_c: 37, current_a: 2.2, speed_rpm: 110, health_score: 88 },
        { j: 4, load_pct: 22, temp_c: 32, current_a: 1.1, speed_rpm: 160, health_score: 95 },
        { j: 5, load_pct: 18, temp_c: 30, current_a: 0.8, speed_rpm: 200, health_score: 97 },
        { j: 6, load_pct: 12, temp_c: 28, current_a: 0.5, speed_rpm: 220, health_score: 99 },
      ],
      alarms: generateIndustrialAlarms('kuka'),
      runtime: {
        power_on_hours: 12300,
        cycle_count: 85000,
        last_maintenance_at: '2026-07-01T10:00:00+08:00',
      },
      extensions: {
        safety_gate_open: Math.random() > 0.8,
        robroot_offset_x: +(Math.random() * 0.5).toFixed(3),
        robroot_offset_y: +(Math.random() * 0.5).toFixed(3),
        safety_controller_state: 'ACTIVE',
        axis_soft_limit: '正常',
      },
    },
  }
}

function mockEstunTelemetry() {
  const now = new Date().toISOString()
  return {
    type: 'industrial_state',
    brand: 'estun',
    payload: {
      robot_id: 'ESTUN_ER3A_001',
      model: 'ER3A-C60',
      timestamp: now,
      pose: generateIndustrialPose(),
      joints: [
        { j: 1, load_pct: 28, temp_c: 34, current_a: 1.5, speed_rpm: 90, health_score: 93 },
        { j: 2, load_pct: 42, temp_c: 39, current_a: 2.3, speed_rpm: 75, health_score: 85 },
        { j: 3, load_pct: 35, temp_c: 36, current_a: 1.9, speed_rpm: 100, health_score: 90 },
        { j: 4, load_pct: 20, temp_c: 31, current_a: 0.9, speed_rpm: 140, health_score: 96 },
        { j: 5, load_pct: 15, temp_c: 29, current_a: 0.6, speed_rpm: 170, health_score: 98 },
        { j: 6, load_pct: 10, temp_c: 27, current_a: 0.4, speed_rpm: 200, health_score: 99 },
      ],
      alarms: generateIndustrialAlarms('estun'),
      runtime: {
        power_on_hours: 5600,
        cycle_count: 42000,
      },
      extensions: {
        energy_consumption: +(1.2 + Math.random() * 0.8).toFixed(2),
        plc_extension: 'M1 Y0',
        custom_alarm_word: 0,
      },
    },
  }
}

const wssIndustrial = new WebSocketServer({ port: 8082 })
const industrialMocks = [mockFanucTelemetry, mockKukaTelemetry, mockEstunTelemetry]
let industrialIdx = 0

wssIndustrial.on('connection', (ws) => {
  console.log('[mock] Industrial client connected')
  // 连接后立即推送一台
  ws.send(JSON.stringify(industrialMocks[0]()))
})

// 每 5 秒轮流推送一台工业机器人遥测
setInterval(() => {
  if (wssIndustrial.clients.size === 0) return
  industrialIdx = (industrialIdx + 1) % industrialMocks.length
  const msg = industrialMocks[industrialIdx]()
  const data = JSON.stringify(msg)
  wssIndustrial.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(data)
    }
  })
}, 5000)

console.log('[mock] WS servers running:')
console.log('  G1         → ws://localhost:8080  (8方向避障巡航)')
console.log('  Peanut     → ws://localhost:8081')
console.log('  Industrial → ws://localhost:8082  (FANUC/KUKA/埃斯顿 轮流)')
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

