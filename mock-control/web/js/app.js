// mock-control/web/js/app.js
// 入口：组装 API 客户端 + 设备网格 + 控制面板 + 场景执行器 + 日志面板
// SSE 事件分发：state → 网格/控制面板，alert/scenario → 日志/进度条

import { ControlApiClient } from './api-client.js'
import { DeviceGrid } from './device-grid.js'
import { ControlPanel } from './control-panel.js'
import { ScenarioRunner } from './scenario-runner.js'

// ── 日志面板（内存保留 200 条，刷新即清）──
const logList = document.getElementById('log-list')
const logger = {
  entries: [],
  log(msg, level = 'info') {
    const time = new Date().toLocaleTimeString('zh-CN', { hour12: false })
    const entry = document.createElement('div')
    entry.className = `log-entry log-entry--${level}`
    entry.innerHTML = `<span class="log-entry__time">[${time}]</span><span class="log-entry__msg"></span>`
    entry.querySelector('.log-entry__msg').textContent = msg
    logList.appendChild(entry)
    this.entries.push({ time, msg, level })
    if (this.entries.length > 200) { this.entries.shift(); logList.removeChild(logList.firstChild) }
    logList.scrollTop = logList.scrollHeight
  },
}
document.getElementById('log-clear')?.addEventListener('click', () => {
  logList.innerHTML = ''
  logger.entries = []
})

// ── 组装 ──
const api = new ControlApiClient()
const grid = new DeviceGrid(document.getElementById('device-grid'))
const panel = new ControlPanel(document.querySelector('.panel--control'), api, logger)
const runner = new ScenarioRunner(api, logger)

const connDot = document.getElementById('conn-dot')
const transportChip = document.getElementById('transport-mode')

// 状态变化节流展示：只在状态翻转时记日志（电量滚动太吵）
const lastStatus = new Map()
function logStatusChange(device) {
  const prev = lastStatus.get(device.robotId)
  if (prev !== undefined && prev !== device.status) {
    logger.log(`← ${device.robotId}: ${prev} → ${device.status}`, 'telemetry')
  }
  lastStatus.set(device.robotId, device.status)
}

async function boot() {
  // 设备网格 + 场景按钮
  const devices = await api.getDevices()
  grid.init(devices)
  logger.log(`已加载 ${devices.length} 台设备`, 'info')

  await runner.init()

  // 默认选中第一台（演示常用 FANUC，直接高亮）
  const fanuc = devices.find((d) => d.brand === 'fanuc') || devices[0]
  if (fanuc) grid.selectDevice(fanuc.robotId)

  // SSE 订阅
  api.subscribe({
    onOpen: () => {
      connDot.className = 'status-dot status-dot--online'
      logger.log('SSE 已连接', 'info')
    },
    onDisconnect: () => {
      connDot.className = 'status-dot status-dot--offline'
      logger.log('SSE 连接中断，自动重连中…', 'warn')
    },
    onState: (device) => {
      if (device._meta) {
        // 传输模式提示帧
        const mode = device._meta.transport === 'mqtt' ? 'MQTT' : 'WS 直连'
        transportChip.textContent = mode
        transportChip.className = `transport-chip ${device._meta.transport === 'mqtt' ? 'transport-chip--mqtt' : 'transport-chip--ws'}`
        return
      }
      grid.updateCard(device)
      panel.handleState(device)
      logStatusChange(device)
    },
    onAlert: (alert) => {
      const desc = alert.alarms
        ? alert.alarms.map((a) => `${a.raw_code} ${a.zh_desc}`).join(', ')
        : `${alert.code} ${alert.zh_desc || ''}`
      logger.log(`← 告警广播: ${alert.robotId} ${desc}`, 'warn')
    },
    onScenario: (progress) => {
      runner.handleProgress(progress)
      logger.log(`🎬 ${progress.name} [${progress.phase}/${progress.total}] ${progress.label}`, 'info')
    },
  })
}

panel.init()
boot().catch((err) => {
  logger.log(`初始化失败: ${err.message}`, 'error')
  console.error(err)
})
