import { WebSocketServer } from 'ws'

const wss = new WebSocketServer({ port: 8080 })
let pos = { x: 0, y: 0 }
let heading = 0
const SPEED = 0.05

wss.on('connection', (ws) => {
  console.log('client connected')
  const iv = setInterval(() => {
    pos.x += Math.cos(heading) * SPEED
    pos.y += Math.sin(heading) * SPEED
    const msg = {
      topic: '/state',
      data: {
        position: [pos.x, 0, pos.y],
        rotation: [0, heading, 0],
        battery: 85,
        voltage: 54.2,
      },
      timestamp: Date.now(),
    }
    ws.send(JSON.stringify(msg))
  }, 100)
  ws.on('close', () => clearInterval(iv))
})

console.log('simple mock running on ws://localhost:8080 — straight line, 0.5 m/s')
