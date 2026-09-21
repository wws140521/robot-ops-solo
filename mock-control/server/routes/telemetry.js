// mock-control/server/routes/telemetry.js
// GET /api/telemetry/stream · SSE 实时状态流
// 事件类型（对齐文档附录 A.2）：
//   state    —— 设备状态更新（初始全量 + 后续增量）
//   alert    —— 告警事件（trigger_alarm / 遥测报警码）
//   scenario —— 场景剧本进度
import { Router } from 'express'

export function telemetryRouter(stateEngine, scenarioEngine, bridge) {
  const router = Router()

  router.get('/stream', (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream')
    res.setHeader('Cache-Control', 'no-cache')
    res.setHeader('Connection', 'keep-alive')
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.flushHeaders()

    // 心跳注释帧：防止代理超时断连
    const heartbeat = setInterval(() => {
      try { res.write(': ping\n\n') } catch { /* 已断开 */ }
    }, 15000)

    const send = (event, data) => {
      try {
        res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
      } catch { /* 已断开 */ }
    }

    // 初始全量推送
    stateEngine.getAll().forEach((device) => send('state', device))

    // 后续增量
    const onState = (device) => send('state', device)
    const onAlert = (alert) => send('alert', alert)
    const onScenario = (progress) => send('scenario', progress)

    stateEngine.on('change', onState)
    stateEngine.on('alert', onAlert)
    scenarioEngine.on('scenario', onScenario)

    // 传输模式变化提示（MQTT 掉线降级 WS 时 UI 会看到）
    send('state', { _meta: { transport: bridge.transportMode() } })

    req.on('close', () => {
      clearInterval(heartbeat)
      stateEngine.off('change', onState)
      stateEngine.off('alert', onAlert)
      scenarioEngine.off('scenario', onScenario)
    })
  })

  return router
}
