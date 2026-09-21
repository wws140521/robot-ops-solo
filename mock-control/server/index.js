// mock-control/server/index.js
// Control Service 入口：Express REST API + SSE + MQTT/WS 桥 + 静态操作页面
// 启动：pnpm --filter mock-control dev  →  http://localhost:3000

import express from 'express'
import cors from 'cors'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { StateEngine } from './state-engine.js'
import { CommandHandler } from './command-handler.js'
import { MqttBridge } from './mqtt-bridge.js'
import { ScenarioEngine } from './scenario-engine.js'
import { devicesRouter } from './routes/devices.js'
import { commandRouter } from './routes/command.js'
import { scenarioRouter } from './routes/scenario.js'
import { telemetryRouter } from './routes/telemetry.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const PORT = Number(process.env.PORT || 3000)

const app = express()
app.use(cors())
app.use(express.json({ limit: '1mb' }))

// ── 依赖注入组装 ──
const stateEngine = await new StateEngine().init()
const bridge = new MqttBridge(stateEngine)
const commandHandler = new CommandHandler(stateEngine, bridge)
const scenarioEngine = new ScenarioEngine(stateEngine, commandHandler)

// ── 路由 ──
app.use('/api/devices', devicesRouter(stateEngine, bridge))
app.use('/api/command', commandRouter(commandHandler))
app.use('/api/scenario', scenarioRouter(scenarioEngine))
app.use('/api/telemetry', telemetryRouter(stateEngine, scenarioEngine, bridge))

// 最近下发指令（日志面板冷启动回放）
app.get('/api/commands', (req, res) => res.json(bridge.getRecentCommands()))

app.get('/health', (req, res) => res.json({
  ok: true,
  devices: stateEngine.size(),
  transport: bridge.transportMode(),
}))

// ── 静态操作页面（无构建，直接托管 web/）──
app.use(express.static(resolve(__dirname, '../web')))

// ── 启动桥接（连 mock-ws-server 三端口收遥测 + 可选 MQTT）──
await bridge.start()

app.listen(PORT, () => {
  console.log('🎮 Mock Control Service running on http://localhost:3000')
  console.log(`   设备数: ${stateEngine.size()} · 传输模式: ${bridge.transportMode() === 'mqtt' ? 'MQTT' : 'WebSocket 直连（无 broker 时自动降级）'}`)
  console.log('   配套: 先启动 node mock-ws-server.js（:8080/:8081/:8082）')
})
