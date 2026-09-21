// mock-control/server/routes/scenario.js
// GET /api/scenario · POST /api/scenario/:name/start · POST /api/scenario/:name/stop
import { Router } from 'express'

export function scenarioRouter(scenarioEngine) {
  const router = Router()

  // 剧本列表（页面初始化渲染按钮用）
  router.get('/', (req, res) => {
    res.json({
      scenarios: scenarioEngine.list(),
      running: scenarioEngine.isRunning(),
    })
  })

  router.post('/:name/start', async (req, res) => {
    try {
      const result = await scenarioEngine.run(req.params.name)
      res.json(result)
    } catch (err) {
      res.status(400).json({ error: err.message })
    }
  })

  router.post('/:name/stop', (req, res) => {
    res.json(scenarioEngine.stop())
  })

  return router
}
