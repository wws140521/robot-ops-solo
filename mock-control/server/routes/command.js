// mock-control/server/routes/command.js
// POST /api/command · 单条指令下发
import { Router } from 'express'

export function commandRouter(commandHandler) {
  const router = Router()

  router.post('/', async (req, res) => {
    try {
      const result = await commandHandler.execute(req.body)
      res.json(result)
    } catch (err) {
      if (err.name === 'ZodError') {
        return res.status(400).json({ error: 'VALIDATION_ERROR', details: err.errors })
      }
      if (err.status) {
        return res.status(err.status).json({ error: err.message })
      }
      console.error('[command]', err)
      res.status(500).json({ error: err.message })
    }
  })

  // 批量指令：body = ControlCommand[]
  router.post('/batch', async (req, res) => {
    if (!Array.isArray(req.body)) {
      return res.status(400).json({ error: 'VALIDATION_ERROR', details: 'body 必须是指令数组' })
    }
    try {
      const result = await commandHandler.executeBatch(req.body)
      res.json(result)
    } catch (err) {
      console.error('[batch]', err)
      res.status(500).json({ error: err.message })
    }
  })

  return router
}
