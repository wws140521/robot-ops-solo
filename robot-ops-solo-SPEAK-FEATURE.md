# Robot-Ops-Solo · B点自动播报功能文档

> 版本：v1.1 | 更新日期：2026-03
> 依赖：React 18 + Vite 5 + Zustand + TypeScript
> 前置：项目已能跑通 mock WS + Dashboard + 3D 孪生

---

## 一、功能概述

当机器人走到 **B 点（3号桌）** 时，系统自动触发播报 `"小心烫手～"`，表现层有三处联动：

| 表现位置 | 效果 |
|----------|------|
| 右下角气泡弹窗 | 蓝色卡片滑入，3 秒后自动消失 |
| 告警流（AlertsPage） | 新增一条 `info` 级别记录："播报: 小心烫手～" |
| 浏览器 TTS（可选） | 系统语音直接念出来 |

---

## 二、数据流总览

```
┌─────────────────┐
│ mock-ws-server  │  到 B 点时推 { topic: '/speak', data: { text: '...' } }
└────────┬────────┘
         │ WebSocket
         ▼
┌─────────────────┐
│   wsHub.ts      │  switch(msg.topic) → case '/speak' → speakStore + alertStore
└────────┬────────┘
         │ Zustand 状态更新
         ▼
┌─────────────────────────────────────┐
│   UI 消费层（3 个独立组件）         │
│  ┌─────────────┐ ┌──────────────┐ │
│  │ SpeakBubble  │ │ AlertsPage   │ │
│  │ (右下角气泡) │ │ (告警流)     │ │
│  └─────────────┘ └──────────────┘ │
│  ┌─────────────┐                   │
│  │ Browser TTS │ (可选，零成本)   │
│  └─────────────┘                   │
└─────────────────────────────────────┘
```

---

## 三、文件清单（本次新增/修改）

| 文件 | 操作 | 说明 |
|------|------|------|
| `mock-ws-server.js` | **替换** | 矩形路径 + B 点触发 `/speak` |
| `apps/web-console/src/lib/wsHub.ts` | **替换** | 按 topic 分发 + speakStore + alertStore |
| `apps/web-console/src/components/overlays/SpeakBubble.tsx` | **新增** | 右下角气泡组件 |
| `apps/web-console/src/stores/alertStore.ts` | **新增** | 告警流 Zustand store |
| `apps/web-console/src/App.tsx` | **修改** | 挂载 `<SpeakBubble />` |

---

## 四、完整代码（逐文件）

### 4.1 mock-ws-server.js（完整替换）

```js
/**
 * mock-ws-server.js
 * 模拟宇树 G1 机器人 WebSocket 数据服务
 * 功能：矩形路径循环 + 电量递减 + B点播报触发
 *
 * 启动：node mock-ws-server.js
 * 前端连接：ws://localhost:8080
 */

import { WebSocketServer } from 'ws'

const wss = new WebSocketServer({ port: 8080 })

// ========== 矩形路径定义 ==========
// A=传菜口  B=3号桌  C=7号桌  D=回传菜口
const PATH = [
  { x: 0, y: 0, name: 'A', label: '传菜口' },
  { x: 5, y: 0, name: 'B', label: '3号桌' },
  { x: 5, y: 3, name: 'C', label: '7号桌' },
  { x: 0, y: 3, name: 'D', label: '回传菜口' },
]

// ========== 状态机 ==========
let currentTarget = 1          // 当前目标点索引（从 B 开始）
let progress = 0                // 0→1 插值进度
let batteryPct = 85            // 起始电量
let hasSpokenAtB = false       // 防重复播报锁
let loopCount = 0              // 循环计数

// ========== 工具函数 ==========
function lerp(a, b, t) {
  return a + (b - a) * t
}

function broadcast(msg) {
  const data = JSON.stringify(msg)
  wss.clients.forEach(client => {
    if (client.readyState === 1) {  // OPEN
      client.send(data)
    }
  })
}

// ========== 主循环 ==========
const TICK_MS = 100      // 10Hz
const SPEED = 0.015      // 每 tick 进度增量（越小越慢）

setInterval(() => {
  // ---- 1. 推进路径进度 ----
  progress += SPEED

  // 到达目标点
  if (progress >= 1) {
    progress = 0
    const arrivedPoint = PATH[(currentTarget - 1 + 4) % 4]

    // ★ B 点触发播报
    if (arrivedPoint.name === 'B' && !hasSpokenAtB) {
      broadcast({
        topic: '/speak',
        data: {
          text: '小心烫手～',
          volume: 0.8,
          timestamp: Date.now()
        }
      })
      hasSpokenAtB = true
      console.log(`[mock] 到达 ${arrivedPoint.label}(B)，触发播报`)
    }

    // 经过 A 点（传菜口）重置播报锁 + 循环计数
    if (arrivedPoint.name === 'A') {
      hasSpokenAtB = false
      loopCount++
      console.log(`[mock] 完成第 ${loopCount} 圈`)
    }

    currentTarget = (currentTarget + 1) % PATH.length
  }

  // ---- 2. 插值算当前坐标 ----
  const from = PATH[(currentTarget - 1 + 4) % 4]
  const to = PATH[currentTarget]
  const x = lerp(from.x, to.x, progress)
  const y = lerp(from.y, to.y, progress)

  // 计算朝向（yaw）
  const dx = to.x - from.x
  const dy = to.y - from.y
  const yaw = Math.atan2(dy, dx)

  // ---- 3. 电量递减 ----
  batteryPct -= 0.01
  if (batteryPct < 10) batteryPct = 85  // 循环重置，方便演示

  // ---- 4. 告警判定 ----
  let alertLevel = null
  if (batteryPct <= 10) {
    alertLevel = 'error'
  } else if (batteryPct <= 20) {
    alertLevel = 'warn'
  }

  // ---- 5. 推位置/电量状态 ----
  broadcast({
    topic: '/battery',
    data: {
      percentage: Math.round(batteryPct * 10) / 10,
      voltage: Math.round((54.2 - (85 - batteryPct) * 0.1) * 100) / 100,
      position: { x: Math.round(x * 100) / 100, y: Math.round(y * 100) / 100, yaw: Math.round(yaw * 100) / 100 },
      joints: {
        hip_l: Math.sin(Date.now() / 500) * 0.3,
        hip_r: Math.sin(Date.now() / 500 + Math.PI) * 0.3,
        knee_l: Math.abs(Math.sin(Date.now() / 500)) * 0.5,
        knee_r: Math.abs(Math.sin(Date.now() / 500 + Math.PI)) * 0.5,
      },
      status: alertLevel === 'error' ? 'error' : 'moving',
      timestamp: Date.now()
    }
  })

  // ---- 6. 推告警（如果触发阈值）----
  if (alertLevel === 'warn') {
    broadcast({
      topic: '/alert',
      data: {
        level: 'warn',
        code: 'BATTERY_LOW',
        message: `电量较低: ${Math.round(batteryPct)}%`,
        timestamp: Date.now()
      }
    })
  } else if (alertLevel === 'error') {
    broadcast({
      topic: '/alert',
      data: {
        level: 'error',
        code: 'BATTERY_CRITICAL',
        message: `电量极低: ${Math.round(batteryPct)}%，请立即充电`,
        timestamp: Date.now()
      }
    })
  }

}, TICK_MS)

// ========== 连接日志 ==========
wss.on('connection', (ws) => {
  console.log(`[mock] 前端已连接，当前客户端数: ${wss.clients.size}`)
  ws.send(JSON.stringify({
    topic: '/system',
    data: { message: 'connected', robotId: 'g1-001' }
  }))
})

wss.on('close', () => {
  console.log(`[mock] 前端断开，当前客户端数: ${wss.clients.size}`)
})

console.log('[mock] WS 服务已启动 → ws://localhost:8080')
console.log('[mock] 路径: A(传菜口) → B(3号桌) → C(7号桌) → D(回传菜口)')
console.log('[mock] B 点将触发播报 "小心烫手～"')
```

---

### 4.2 wsHub.ts（完整替换）

```ts
/**
 * apps/web-console/src/lib/wsHub.ts
 * WebSocket 消息分发中心
 * 职责：连接 WS → 按 topic 路由 → 写入对应 Zustand store
 */

import { useRobotStore } from '../stores/robotStore'
import { useAlertStore } from '../stores/alertStore'
import { adaptUnitree, type UnifiedAlert } from 'robot-adapter-kit'

// ========== Speak Store ==========
import { create } from 'zustand'

export interface SpeakEvent {
  robotId: string
  text: string
  volume: number
  timestamp: number
}

interface SpeakStore {
  lastSpeak: SpeakEvent | null
  history: SpeakEvent[]
  setSpeak: (e: SpeakEvent) => void
  clear: () => void
}

export const useSpeakStore = create<SpeakStore>((set) => ({
  lastSpeak: null,
  history: [],
  setSpeak: (e) =>
    set((s) => ({
      lastSpeak: e,
      history: [...s.history.slice(-49), e],  // 保留最近 50 条
    })),
  clear: () => set({ lastSpeak: null }),
}))

// ========== WS 连接管理 ==========
let ws: WebSocket | null = null
let reconnectTimer: number | null = null
let reconnectAttempts = 0
const MAX_RECONNECT = 10
const RECONNECT_DELAY = 3000

const ROBOT_ID = 'g1-001'

function connect(url: string) {
  ws = new WebSocket(url)

  ws.onopen = () => {
    console.log('[wsHub] 已连接', url)
    reconnectAttempts = 0
  }

  ws.onmessage = (e) => {
    try {
      const msg = JSON.parse(e.data)
      handleMessage(msg)
    } catch (err) {
      console.error('[wsHub] 消息解析失败', err)
    }
  }

  ws.onclose = () => {
    console.warn('[wsHub] 连接断开，尝试重连...')
    scheduleReconnect(url)
  }

  ws.onerror = (err) => {
    console.error('[wsHub] WS 错误', err)
  }
}

function scheduleReconnect(url: string) {
  if (reconnectAttempts >= MAX_RECONNECT) {
    console.error('[wsHub] 重连次数超限，停止尝试')
    return
  }
  reconnectAttempts++
  reconnectTimer = window.setTimeout(() => {
    connect(url)
  }, RECONNECT_DELAY * Math.min(reconnectAttempts, 3))  // 最多 9 秒间隔
}

// ========== 消息分发核心 ==========
function handleMessage(msg: { topic: string; data: any }) {
  switch (msg.topic) {

    // ---- 位置/电量/状态 ----
    case '/battery': {
      const state = adaptUnitree(msg, ROBOT_ID)
      useRobotStore.getState().updateRobot(ROBOT_ID, state)
      break
    }

    // ---- 播报指令 ★ 核心 ----
    case '/speak': {
      const speakEvent: SpeakEvent = {
        robotId: ROBOT_ID,
        text: msg.data.text ?? '',
        volume: msg.data.volume ?? 0.8,
        timestamp: msg.data.timestamp ?? Date.now(),
      }

      // 1. 写入 speakStore → 驱动气泡 UI
      useSpeakStore.getState().setSpeak(speakEvent)

      // 2. 同步写入告警流（AlertsPage 可见）
      useAlertStore.getState().addAlert({
        robotId: ROBOT_ID,
        level: 'info',
        code: 'SPEAK',
        message: `🔊 播报: "${speakEvent.text}"`,
        timestamp: speakEvent.timestamp,
      })

      // 3. 浏览器 TTS 朗读（零成本，演示效果炸裂）
      if ('speechSynthesis' in window) {
        const utterance = new SpeechSynthesisUtterance(speakEvent.text)
        utterance.lang = 'zh-CN'
        utterance.volume = speakEvent.volume
        utterance.rate = 1.0
        speechSynthesis.speak(utterance)
      }

      console.log('[wsHub] 播报触发:', speakEvent.text)
      break
    }

    // ---- 告警 ----
    case '/alert': {
      const alert: UnifiedAlert = {
        robotId: ROBOT_ID,
        level: msg.data.level,
        code: msg.data.code,
        message: msg.data.message,
        timestamp: msg.data.timestamp ?? Date.now(),
      }
      useAlertStore.getState().addAlert(alert)
      break
    }

    // ---- 系统消息 ----
    case '/system': {
      console.log('[wsHub] 系统:', msg.data.message)
      break
    }

    default:
      console.log('[wsHub] 未知 topic:', msg.topic, msg.data)
  }
}

// ========== 对外 API ==========
export function startWS(url = 'ws://localhost:8080') {
  if (ws && ws.readyState === WebSocket.OPEN) {
    console.log('[wsHub] 已连接，跳过重复启动')
    return
  }
  connect(url)
}

export function stopWS() {
  if (reconnectTimer) {
    clearTimeout(reconnectTimer)
    reconnectTimer = null
  }
  ws?.close()
  ws = null
}

/** 向机器人发送指令（SOP 反向控制用） */
export function sendCommand(topic: string, payload: any) {
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ topic, data: payload }))
  } else {
    console.warn('[wsHub] WS 未连接，无法发送', topic)
  }
}
```

---

### 4.3 alertStore.ts（新增）

```ts
/**
 * apps/web-console/src/stores/alertStore.ts
 * 告警流全局状态
 */

import { create } from 'zustand'
import type { UnifiedAlert } from 'robot-adapter-kit'

interface AlertStore {
  alerts: UnifiedAlert[]
  unreadCount: number
  addAlert: (alert: UnifiedAlert) => void
  markAllRead: () => void
  clearAlerts: () => void
  removeAlert: (timestamp: number) => void
}

export const useAlertStore = create<AlertStore>((set) => ({
  alerts: [],
  unreadCount: 0,

  addAlert: (alert) =>
    set((s) => ({
      alerts: [alert, ...s.alerts.slice(0, 99)],  // 保留最近 100 条
      unreadCount: s.unreadCount + 1,
    })),

  markAllRead: () => set({ unreadCount: 0 }),

  clearAlerts: () => set({ alerts: [], unreadCount: 0 }),

  removeAlert: (timestamp) =>
    set((s) => ({
      alerts: s.alerts.filter(a => a.timestamp !== timestamp),
    })),
}))
```

---

### 4.4 SpeakBubble.tsx（新增）

```tsx
/**
 * apps/web-console/src/components/overlays/SpeakBubble.tsx
 * 右下角播报气泡：3 秒自动消失 + 滑入动画
 */

import { useSpeakStore } from '../../lib/wsHub'
import { useEffect, useState } from 'react'
import './SpeakBubble.css'

export function SpeakBubble() {
  const lastSpeak = useSpeakStore(s => s.lastSpeak)
  const [visible, setVisible] = useState(false)
  const [text, setText] = useState('')
  const [key, setKey] = useState(0)  // 强制重启动画

  useEffect(() => {
    if (lastSpeak) {
      setText(lastSpeak.text)
      setKey(k => k + 1)
      setVisible(true)

      const timer = setTimeout(() => {
        setVisible(false)
      }, 3000)

      return () => clearTimeout(timer)
    }
  }, [lastSpeak])

  if (!visible) return null

  return (
    <div
      key={key}
      className="speak-bubble"
      role="status"
      aria-live="polite"
    >
      <span className="speak-bubble__icon">🔊</span>
      <span className="speak-bubble__text">{text}</span>
    </div>
  )
}
```

---

### 4.5 SpeakBubble.css（新增）

```css
/* apps/web-console/src/components/overlays/SpeakBubble.css */

.speak-bubble {
  position: fixed;
  bottom: 24px;
  right: 24px;
  display: flex;
  align-items: center;
  gap: 10px;
  background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
  color: #fff;
  padding: 14px 22px;
  border-radius: 14px;
  font-size: 16px;
  font-weight: 500;
  box-shadow: 0 8px 24px rgba(37, 99, 235, 0.4);
  z-index: 9999;
  animation: speakSlideIn 0.35s cubic-bezier(0.34, 1.56, 0.64, 1);
  pointer-events: none;
  max-width: 360px;
}

.speak-bubble__icon {
  font-size: 22px;
  flex-shrink: 0;
}

.speak-bubble__text {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

@keyframes speakSlideIn {
  from {
    transform: translateY(40px) scale(0.85);
    opacity: 0;
  }
  to {
    transform: translateY(0) scale(1);
    opacity: 1;
  }
}

/* 播报历史小角标（可选，挂在侧边栏） */
.speak-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 20px;
  height: 20px;
  padding: 0 6px;
  background: #3b82f6;
  color: #fff;
  border-radius: 10px;
  font-size: 12px;
  font-weight: 600;
}
```

---

### 4.6 App.tsx（修改：挂载 SpeakBubble）

```tsx
/**
 * apps/web-console/src/App.tsx
 * 修改点：在 <TenantBranding> 内挂载 <SpeakBubble />
 */

import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { useEffect } from 'react'
import { startWS } from './lib/wsHub'
import { Dashboard } from './routes/Dashboard'
import { RobotsPage } from './routes/RobotsPage'
import { SopPage } from './routes/SopPage'
import { TwinPage } from './routes/TwinPage'
import { AlertsPage } from './routes/AlertsPage'
import { TenantsPage } from './routes/TenantsPage'
import { TenantBranding } from './components/layout/TenantBranding'
import { Sidebar } from './components/layout/Sidebar'
import { SpeakBubble } from './components/overlays/SpeakBubble'  // ★ 新增

export default function App() {
  useEffect(() => {
    startWS()
  }, [])

  return (
    <TenantBranding>
      <div className="app-layout">
        <Sidebar />
        <main className="app-main">
          <BrowserRouter>
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/robots" element={<RobotsPage />} />
              <Route path="/robots/:id" element={<TwinPage />} />
              <Route path="/sop" element={<SopPage />} />
              <Route path="/alerts" element={<AlertsPage />} />
              <Route path="/tenants" element={<TenantsPage />} />
            </Routes>
          </BrowserRouter>
        </main>

        {/* ★ 全局播报气泡，所有页面都能弹 */}
        <SpeakBubble />
      </div>
    </TenantBranding>
  )
}
```

---

### 4.7 AlertsPage.tsx（配合告警流显示）

```tsx
/**
 * apps/web-console/src/routes/AlertsPage.tsx
 * 告警流页面：显示所有告警 + 播报历史
 */

import { useAlertStore } from '../stores/alertStore'
import { useSpeakStore } from '../lib/wsHub'
import './AlertsPage.css'

const LEVEL_COLORS = {
  info: '#3b82f6',
  warn: '#f59e0b',
  error: '#ef4444',
}

const LEVEL_LABELS = {
  info: '信息',
  warn: '警告',
  error: '错误',
}

export function AlertsPage() {
  const alerts = useAlertStore(s => s.alerts)
  const unreadCount = useAlertStore(s => s.unreadCount)
  const markAllRead = useAlertStore(s => s.markAllRead)
  const clearAlerts = useAlertStore(s => s.clearAlerts)
  const speakHistory = useSpeakStore(s => s.history)

  return (
    <div className="alerts-page">
      <header className="alerts-header">
        <h1>告警与播报</h1>
        <div className="alerts-actions">
          <span className="alerts-unread">未读: {unreadCount}</span>
          <button onClick={markAllRead} className="btn btn--sm">全部已读</button>
          <button onClick={clearAlerts} className="btn btn--sm btn--danger">清空</button>
        </div>
      </header>

      {/* 告警流 */}
      <section className="alerts-section">
        <h2>告警流</h2>
        {alerts.length === 0 ? (
          <p className="alerts-empty">暂无告警 ✅</p>
        ) : (
          <ul className="alerts-list">
            {alerts.map((alert) => (
              <li
                key={alert.timestamp}
                className="alert-item"
                style={{ borderLeftColor: LEVEL_COLORS[alert.level] }}
              >
                <span
                  className="alert-level"
                  style={{ background: LEVEL_COLORS[alert.level] }}
                >
                  {LEVEL_LABELS[alert.level]}
                </span>
                <span className="alert-code">{alert.code}</span>
                <span className="alert-message">{alert.message}</span>
                <span className="alert-time">
                  {new Date(alert.timestamp).toLocaleTimeString()}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* 播报历史 */}
      <section className="alerts-section">
        <h2>播报历史</h2>
        {speakHistory.length === 0 ? (
          <p className="alerts-empty">暂无播报记录</p>
        ) : (
          <ul className="speak-history">
            {speakHistory.slice().reverse().map((s, i) => (
              <li key={`${s.timestamp}-${i}`} className="speak-item">
                <span className="speak-icon">🔊</span>
                <span className="speak-text">{s.text}</span>
                <span className="speak-time">
                  {new Date(s.timestamp).toLocaleTimeString()}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
```

---

### 4.8 AlertsPage.css（新增）

```css
/* apps/web-console/src/routes/AlertsPage.css */

.alerts-page {
  padding: 24px;
  max-width: 900px;
}

.alerts-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
}

.alerts-header h1 {
  font-size: 24px;
  font-weight: 700;
}

.alerts-actions {
  display: flex;
  gap: 12px;
  align-items: center;
}

.alerts-unread {
  font-size: 14px;
  color: #6b7280;
}

.btn {
  padding: 6px 14px;
  border-radius: 8px;
  border: none;
  cursor: pointer;
  font-size: 14px;
  font-weight: 500;
  transition: opacity 0.2s;
}

.btn--sm { font-size: 13px; padding: 4px 10px; }
.btn:hover { opacity: 0.85; }
.btn--danger { background: #ef4444; color: #fff; }

.alerts-section { margin-bottom: 32px; }

.alerts-section h2 {
  font-size: 18px;
  font-weight: 600;
  margin-bottom: 12px;
}

.alerts-empty {
  color: #9ca3af;
  font-size: 14px;
  padding: 16px;
  background: #f9fafb;
  border-radius: 8px;
  text-align: center;
}

.alerts-list, .speak-history {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.alert-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  background: #fff;
  border-radius: 8px;
  border-left: 4px solid #3b82f6;
  box-shadow: 0 1px 3px rgba(0,0,0,0.06);
}

.alert-level {
  font-size: 12px;
  color: #fff;
  padding: 2px 8px;
  border-radius: 4px;
  font-weight: 600;
}

.alert-code {
  font-family: 'Fira Code', monospace;
  font-size: 13px;
  color: #4b5563;
}

.alert-message {
  flex: 1;
  font-size: 14px;
  color: #1f2937;
}

.alert-time, .speak-time {
  font-size: 12px;
  color: #9ca3af;
  white-space: nowrap;
}

.speak-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 16px;
  background: #eff6ff;
  border-radius: 8px;
}

.speak-icon { font-size: 16px; }
.speak-text { flex: 1; font-size: 14px; color: #1e40af; }
```

---

## 五、文件放置位置总览

```
robot-ops-solo/
├── mock-ws-server.js              ← 替换
│
└── apps/web-console/src/
    ├── App.tsx                    ← 修改（加 2 行 import + 1 行 <SpeakBubble/>）
    ├── lib/
    │   └── wsHub.ts               ← 替换（完整版）
    ├── stores/
    │   └── alertStore.ts          ← 新增
    ├── components/
    │   └── overlays/
    │       ├── SpeakBubble.tsx    ← 新增
    │       └── SpeakBubble.css    ← 新增
    └── routes/
        ├── AlertsPage.tsx         ← 新增（或替换）
        └── AlertsPage.css         ← 新增
```

---

## 六、操作步骤（5 分钟搞定）

```bash
# 1. 停掉正在跑的服务（Ctrl+C）

# 2. 用本文档里的代码逐个替换/新增文件

# 3. 确认 SpeakBubble.css 被引入
#    在 SpeakBubble.tsx 顶部确认有：
#    import './SpeakBubble.css'

# 4. 重新启动
node mock-ws-server.js              # 终端 1
pnpm --filter web-console dev      # 终端 2
```

---

## 七、验证清单

打开浏览器 http://localhost:5173 ，依次确认：

| # | 预期现象 | 如果没出现 |
|---|----------|-----------|
| 1 | 终端 1 打印 `[mock] WS 服务已启动 → ws://localhost:8080` | 检查端口是否被占 |
| 2 | 终端 1 每 3-5 秒打印 `[mock] 到达 B(3号桌)，触发播报` | 路径参数正常 |
| 3 | 浏览器控制台打印 `[wsHub] 播报触发: 小心烫手～` | wsHub.ts 已替换 |
| 4 | 右下角蓝色气泡滑入，显示 🔊 小心烫手～，3 秒后消失 | SpeakBubble 已挂载到 App.tsx |
| 5 | 浏览器**念出**"小心烫手～"（中文 TTS） | 浏览器支持 speechSynthesis |
| 6 | 点 `/alerts` 页面，看到一条 `🔊 播报: "小心烫手～"` | alertStore 正常 |
| 7 | 电量到 20% 以下，告警流出现黄色 `BATTERY_LOW` | 阈值逻辑正常 |
| 8 | 电量到 10% 以下，告警流出现红色 `BATTERY_CRITICAL` | 阈值逻辑正常 |

---

## 八、B 点播报逻辑总结（一页纸版）

```
mock-ws-server.js
  │
  │ 矩形路径: A → B → C → D → A ...
  │ 到达 B 点时检测 hasSpokenAtB === false
  │
  ├─→ broadcast({ topic: '/speak', data: { text: '小心烫手～' } })
  │
  ▼
WebSocket (ws://localhost:8080)
  │
  ▼
wsHub.ts → handleMessage()
  │
  ├─→ useSpeakStore.setSpeak()         → 驱动 <SpeakBubble/> 弹气泡
  ├─→ useAlertStore.addAlert(SPEAK)    → 写入 /alerts 页面
  └─→ speechSynthesis.speak()          → 浏览器念出来
```

**三个输出端，一个数据源，互不耦合。**

---

## 九、后续扩展方向

| 方向 | 怎么做 |
|------|--------|
| 多语言 TTS | `utterance.lang = 'en-US'` 按租户配置切换 |
| 播报模板库 | 建 `packages/speak-templates/`，存 `{ event: 'arrive_table', text: '...' }` |
| 真机对接 | 机器人 SLAM 到达目标 → 机器人端发 `/speak` → 前端一样能收 |
| SOP 反向控制 | `sendCommand('/speak', { text: '欢迎光临' })` → 前端发 → 机器人念 |
| 音量/语速配置 | 在租户表加 `tts_volume` / `tts_rate` 字段，动态读取 |
| 播报历史持久化 | Supabase `speak_logs` 表，按 tenant_slug 隔离 |

---

> 文档结束。所有代码可直接复制粘贴覆盖现有文件。
> 如遇报错，检查 import 路径是否匹配你的目录结构，必要时调整 `.tsx` → `.ts` 后缀。
