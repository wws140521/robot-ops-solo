// mock-control/server/routes/devices.js
// GET /api/devices · GET /api/devices/:id · GET /api/commands（最近指令）
import { Router } from 'express'

export function devicesRouter(stateEngine, bridge) {
  const router = Router()

  router.get('/', (req, res) => {
    res.json(stateEngine.getAll())
  })

  router.get('/:id', (req, res) => {
    const device = stateEngine.get(req.params.id)
    if (!device) return res.status(404).json({ error: `Device "${req.params.id}" not found` })
    res.json(device)
  })

  router.get('/:id/commands', (req, res) => {
    res.json(bridge.getRecentCommands().filter((c) => c.robotId === req.params.id))
  })

  return router
}
