# Robot-Ops-Solo · 完整开发文档（整合版）

> **定位**：单人前端 · 跨品牌机器人运维中台 · MVP → 商业化完整指南
> **版本**：v2.0（整合截至 2026-08-29 全部专题文档 + 高德地图接入最新进度）
> **适用**：`robot-ops-solo` monorepo · pnpm workspace · React 18 + TypeScript
> **入口**：本文件是**唯一索引与规范源**，各专题细节见末尾「文档地图」

---

## 第 0 章 · 项目快照（2026-08-29）

### 0.1 已完成 vs 待办

| 层 | 状态 | 说明 |
|----|------|------|
| **L0 代码能跑** | ✅ 完成 | pnpm install / mock-ws-server / dev 三件套通 |
| **L1 adapter-kit** | ✅ 完成 | unitree / keenon / pudutech / agibot + ws/mqtt 客户端 + Vitest |
| **L2 sop-editor** | ✅ 完成 | 8 类节点 + 执行引擎 + 模拟器 + 测试 |
| **L3 digital-twin** | 🟡 进行中 | R3F 已跑通；**等比例 G1 URDF 待替换占位几何体** |
| **L4 ui-kit + Supabase** | ✅ 完成 | 6 组件 + 3 迁移 + Edge Function（set-tenant-claim）|
| **L5 商业闭环** | ❌ 待办 | 部署 Vercel / 定价页 / 首付费客户 |
| **🆕 高德室外地图** | 🟡 进行中 | **Key 已配置正确，待写 MapRobotViewer** |

### 0.2 高德 Key 配置状态（最新）

你在高德控制台 `robot-ops` 应用下已建好**两个 Key，配置正确**：

| Key 名称 | 绑定服务 | 安全密钥 | 用途 |
|---------|---------|---------|------|
| `服务端` | Web 服务 | — | 后端 POI 批采 / 地理编码 / 路径规划 |
| `前端地图` | **Web 端（JS API）** ✅ | 有值 | 浏览器加载 3D 地图 |

> ✅ **判定正确**：`前端地图` 绑定「Web 端」而非「Web 服务」，且安全密钥非「—」。
> ⚠️ **待办**：把该 Key 值 + 安全密钥填入 `.env.local`，即可进入编码。

---

## 第一章 · 技术栈与架构

### 1.1 技术栈

| 层 | 选型 | 职责 |
|----|------|------|
| 前端 | React 18 + TypeScript | 全栈 UI |
| 构建 | Vite 5 + pnpm workspace | monorepo |
| 状态 | Zustand + TanStack Query | 机器人快照（**共享 store 包，无循环依赖**）|
| 实时 | WebSocket + mqtt.js | 接厂商协议 |
| 3D | React Three Fiber + drei + three-urdf | 数字孪生（GLB / URDF 双路线）|
| 画布 | @xyflow/react | SOP 编排 |
| 地图 | **高德 JS API 2.0（GLCustomLayer）** | 室外真实场景 |
| BaaS | Supabase（可选，不填 env 走 mock）| 多租户 / Auth / DB / Realtime |
| 样式 | CSS Variables + shadcn/ui + Tailwind | 贴牌换肤 + 科技感 |

### 1.2 干净架构（依赖单向，无循环）

```
adapter-kit  →  store (共享)  →  { sop-editor, digital-twin, ui-kit }  →  web-console
                                       ↓
                                 (只通过 Context 读 store)
```

**四条铁律**：
1. **共享状态外置**：`packages/store/` 用 `createRobotStore()` 工厂，不 export 单例
2. **面向接口**：`digital-twin` 只依赖 `RobotStateContext` 接口，不知道 `web-console` 存在
3. **唯一写入点**：只有 `wsHub.ts` 调 `store.updateRobot()`，3D 组件 `useFrame` 只读
4. **循环依赖检查**：`npx madge --circular packages/ apps/` 输出为空

> 详见 `3D-VIEW-CLEAN.md` 第六章。

### 1.3 目录结构（权威版）

```
robot-ops-solo/
├── package.json · pnpm-workspace.yaml · tsconfig.base.json · README.md
├── mock-ws-server.js                    # 假数据（含 /gps 真实经纬度路线）
├── supabase/
│   ├── migrations/001_init.sql ... 003_fix_sop_id_type.sql
│   └── functions/set-tenant-claim/index.ts
├── packages/
│   ├── store/                           # ★ 共享 Zustand 工厂
│   ├── adapter-kit/                     # 纯 TS，含 4 品牌 + protocol + __tests__
│   ├── sop-editor/                      # 8 节点 + engine + sidebar
│   ├── digital-twin/                    # RobotViewer + G1Humanoid + map/
│   └── ui-kit/                          # RobotStatusCard / BatteryGauge / AlertCard ...
├── apps/web-console/                    # ★ 主应用（贴牌后台）
│   ├── .env.local                       # ★ 高德 Key 在此
│   └── src/{routes,stores,lib,components,styles}
└── robot-ops-solo-*.md                  # 14 份专题文档
```

---

## 第二章 · 数据模型与 Adapter

### 2.1 统一状态模型 `adapter-kit/types/unified.ts`

```ts
export interface UnifiedRobotState {
  robotId: string
  brand: string
  model: string
  batteryPct: number
  voltage: number
  online: boolean
  position: { x: number; y: number; theta: number }  // 室内=米；室外 x=经度/y=纬度
  joints?: Record<string, number>                    // URDF 关节角（弧度）
  status: 'idle' | 'moving' | 'working' | 'error' | 'charging'
  errorCode?: string
  lastSeen: number
  mode?: 'indoor' | 'outdoor'                        // ★ 室内外区分
  gps?: { lng: number; lat: number; alt?: number; accuracy?: number }  // ★ 室外扩展
}

export interface UnifiedAlert {
  robotId: string
  level: 'info' | 'warn' | 'error'
  code: string
  message: string
  timestamp: number
}

export interface TenantConfig {
  slug: string; name: string; logoUrl: string
  primaryColor: string; brand: string
}
```

### 2.2 Adapter 规范（每品牌 = 1 文件 + 1 测试）

```ts
// adapter-kit/src/adapters/adapter-xxx.ts
export function adaptXxx(raw: XxxRawMsg, robotId: string): UnifiedRobotState { ... }

// adapters/index.ts —— 工厂分发
export function createAdapter(brand: string) {
  switch (brand) {
    case 'unitree': return adaptUnitree
    case 'keenon':  return adaptKeenon
    case 'pudutech':return adaptPudutech
    case 'agibot':  return adaptAgibot
    case 'gps':     return adaptGps          // ★ 室外 GPS
    default: throw new Error(`Unsupported: ${brand}`)
  }
}
```

**规则**：adapter 禁止 import React。

### 2.3 GPS Adapter（WGS-84 → GCJ-02 纠偏）★

```ts
// packages/adapter-kit/src/adapters/adapter-gps.ts
export interface GpsRawMsg {
  deviceId: string; lat: number; lng: number; alt?: number
  heading: number; speed: number; accuracy?: number; ts: number
}

const A = 6378245.0, EE = 0.00669342162296594323, PI = Math.PI

function transform(x: number, y: number) {
  const dLat = transformLat(y - 35.0, x - 105.0)
  const dLng = transformLng(y - 35.0, x - 105.0)
  const radLat = (y / 180.0) * PI
  let magic = Math.sin(radLat); magic = 1 - EE * magic * magic
  const sqrtMagic = Math.sqrt(magic)
  let lat = dLat * 180.0, lng = dLng * 180.0
  lat /= (A * (1 - EE)) / (magic * sqrtMagic) * PI
  lng /= (A / sqrtMagic) * Math.cos(radLat) * PI
  return { lat: y + lat, lng: x + lng }
}
// transformLat / transformLng 为标准高斯-克吕格近似（误差 < 2m）
// 完整实现见 AMAP-OUTDOOR.md 第六章

export function adaptGps(raw: GpsRawMsg, coordsys: 'wgs84' | 'gcj02' = 'wgs84') {
  const { lng, lat } = coordsys === 'wgs84' ? transform(raw.lng, raw.lat) : { lng: raw.lng, lat: raw.lat }
  return {
    robotId: raw.deviceId, brand: 'unitree', model: 'g1',
    batteryPct: 0, voltage: 0, online: true,
    position: { x: lng, y: lat, theta: (raw.heading * PI) / 180 },  // ★ 室外 x=经度 y=纬度
    status: raw.speed > 0.1 ? 'moving' : 'idle',
    lastSeen: raw.ts, mode: 'outdoor',
    gps: { lng, lat, alt: raw.alt, accuracy: raw.accuracy },
  }
}
```

> ⚠️ **不纠偏会偏移 300~500m**。上报时若 `coordsys=gps` 由 adapter 转换；若已 GCJ-02 则直接赋值。

---

## 第三章 · 高德室外真实路线（当前主线）★

### 3.1 目标画面

```
┌──────────────────────────────────────┐
│  [高德暗色 3D 地图，pitch=60°]         │
│   ● 朝阳大悦城 (poi)                  │
│    ╱╲                                 │
│   ╱  ╲  ◆ 取餐点A (真实经纬度)        │
│  ╱    ╲                              │
│ ●──────● 步行路径折线                  │
│ 充电柜   G1(沿路线实时移动)             │
│  [左上 HUD] [左下雷达] [右下状态机]    │
└──────────────────────────────────────┘
```

### 3.2 数据流（单向）

```
[真实世界] GPS/WGS-84
    ↓ ① 原始报文
adapter-gps.ts（WGS→GCJ 纠偏）→ UnifiedRobotState
    ↓ ② WS/MQTT
wsHub.ts（唯一写入点）→ store.updateRobot()
    ↓ ③ Zustand
useRobotState(robotId)
    ↓ ④ 每帧
MapRobotViewer（GLCustomLayer.render 同步相机 + lngLatsToCoords）
    ↓
高德地图 + R3F G1Humanoid + 路线折线 + 轨迹
```

### 3.3 Key 配置（你已完成 ✅ → 下一步编码）

**`apps/web-console/.env.local`**：
```env
VITE_AMAP_JS_KEY=前端地图的Key值
VITE_AMAP_SECURITY_JSCODE=前端地图的安全密钥
AMAP_WS_KEY=服务端Key值（Web服务，仅后端用，不进前端）
VITE_DEFAULT_COORDSYS=gcj02
```

**`index.html` 注入（必须在 maps 脚本之前）**：
```html
<script>
  window._AMapSecurityConfig = { securityJsCode: "%VITE_AMAP_SECURITY_JSCODE%" }
</script>
<script src="https://webapi.amap.com/maps?v=2.0&key=%VITE_AMAP_JS_KEY%&plugin=AMap.PlaceSearch,AMap.Walking,AMap.Geocoder,AMap.Scale"></script>
```

### 3.4 amapLoader（完整可用）

```ts
// apps/web-console/src/lib/amapLoader.ts
import AMapLoader from '@amap/amap-jsapi-loader'

let amapPromise: Promise<any> | null = null

export async function loadAMap() {
  if (amapPromise) return amapPromise
  const key = import.meta.env.VITE_AMAP_JS_KEY
  const security = import.meta.env.VITE_AMAP_SECURITY_JSCODE
  if (!key || !security) throw new Error('缺少 VITE_AMAP_JS_KEY / VITE_AMAP_SECURITY_JSCODE')

  ;(window as any)._AMapSecurityConfig = { securityJsCode: security }

  amapPromise = AMapLoader.load({
    key, version: '2.0',
    plugins: ['AMap.PlaceSearch', 'AMap.Walking', 'AMap.Geocoder', 'AMap.Scale', 'AMap.ToolBar'],
  })
  return amapPromise
}
```

### 3.5 POI / 路径 / GPS 三件套

```ts
// apps/web-console/src/lib/amap.ts
export interface POI { id: string; name: string; address: string; lng: number; lat: number; type?: string }

export async function searchPOI(keyword: string, city = '北京'): Promise<POI[]> {
  const AMap = await loadAMap()
  return new Promise((resolve, reject) => {
    const ps = new AMap.PlaceSearch({ city, pageSize: 25, extensions: 'base' })
    ps.search(keyword, (status: string, result: any) => {
      if (status !== 'complete') return reject(new Error(status))
      resolve((result.poiList?.pois ?? []).map((p: any) => ({
        id: p.id, name: p.name, address: p.address,
        lng: p.location.getLng(), lat: p.location.getLat(), type: p.type,
      })))
    })
  })
}

export async function geocode(address: string, city = '北京') {
  const AMap = await loadAMap()
  return new Promise<{ lng: number; lat: number }>((resolve, reject) => {
    const geocoder = new AMap.Geocoder()
    geocoder.getLocation(address, (status: string, result: any) => {
      if (status !== 'complete') return reject(new Error(status))
      const loc = result.geocodes?.[0]?.location
      if (!loc) return reject(new Error('no result'))
      resolve({ lng: loc.getLng(), lat: loc.getLat() })
    })
  })
}

export async function planWalking(from: { lng: number; lat: number }, to: { lng: number; lat: number }) {
  const AMap = await loadAMap()
  return new Promise<any[]>((resolve, reject) => {
    const walking = new AMap.Walking({ map: null, hideMarkers: true })
    walking.search([from.lng, from.lat], [to.lng, to.lat], (status: string, result: any) => {
      if (status !== 'complete') return reject(new Error(status))
      const points: any[] = []
      ;(result.routes?.[0]?.steps ?? []).forEach((step: any) =>
        step.path?.forEach((p: any) => points.push(p))
      )
      resolve(points)
    })
  })
}
```

### 3.6 MapRobotViewer（核心：GLCustomLayer 融合 R3F）★

```tsx
// packages/digital-twin/src/map/MapRobotViewer.tsx
import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { loadAMap } from '../../../apps/web-console/src/lib/amapLoader'
import { useRobotStore } from '@robot-ops/store'

interface Props {
  center: { lng: number; lat: number }
  route?: { lng: number; lat: number }[]
  robotId: string
  zoom?: number
}

export function MapRobotViewer({ center, route = [], robotId, zoom = 18 }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const sceneRef = useRef<THREE.Scene>()
  const cameraRef = useRef<THREE.PerspectiveCamera>()
  const rendererRef = useRef<THREE.WebGLRenderer>()
  const [map, setMap] = useState<any>(null)

  useEffect(() => {
    let mounted = true
    ;(async () => {
      const AMap = await loadAMap()
      if (!containerRef.current || !mounted) return

      const m = new AMap.Map(containerRef.current, {
        viewMode: '3D', pitch: 60, rotation: -35, zoom,
        center: [center.lng, center.lat],
        mapStyle: 'amap://styles/dark',
        showLabel: false, showBuildingBlock: true,
      })
      const customCoords = m.customCoords
      customCoords.setCenter([center.lng, center.lat])

      const scene = new THREE.Scene()
      const camera = new THREE.PerspectiveCamera(60, 1, 100, 1 << 30)
      const gl = (m as any).getGLContext?.()
      const renderer = new THREE.WebGLRenderer({ context: gl, antialias: true })
      renderer.autoClear = false   // ★ 必须 false，保留底图
      sceneRef.current = scene; cameraRef.current = camera; rendererRef.current = renderer

      // 路线折线
      if (route.length > 1) {
        const pts = customCoords.lngLatsToCoords(route.map(r => [r.lng, r.lat, 0]))
        const geom = new THREE.BufferGeometry().setFromPoints(
          pts.map(([x, y, z]: number[]) => new THREE.Vector3(x, y + 0.5, z))
        )
        scene.add(new THREE.Line(geom, new THREE.LineBasicMaterial({ color: 0x00f0ff, transparent: true, opacity: 0.8 })))
      }

      // GLCustomLayer 桥接
      m.add(new AMap.GLCustomLayer({
        zIndex: 200,
        init: () => {},
        render: () => {
          renderer.resetState()
          const p = customCoords.getCameraParams()
          camera.near = p.near; camera.far = p.far; camera.fov = p.fov
          camera.position.set(...(p.position as [number, number, number]))
          camera.up.set(...(p.up as [number, number, number]))
          camera.lookAt(...(p.lookAt as [number, number, number]))
          camera.updateProjectionMatrix()
          renderer.render(scene, camera)
          renderer.resetState()
        },
      }))
      setMap(m)
    })()
    return () => { mounted = false; map?.destroy() }
  }, [center.lng, center.lat])

  // 机器人跟随 GPS
  useEffect(() => {
    if (!map) return
    const customCoords = map.customCoords
    return useRobotStore.subscribe(state => {
      const r = state.robots[robotId]; if (!r) return
      const [x, y, z] = customCoords.lngLatsToCoords([[r.position.x, r.position.y, 0]])[0]
      let mesh = sceneRef.current?.getObjectByName('g1')
      if (!mesh) {
        mesh = new THREE.Mesh(
          new THREE.CapsuleGeometry(0.4, 1.2, 4, 8),
          new THREE.MeshBasicMaterial({ color: 0x00f0ff })
        )
        mesh.name = 'g1'
        sceneRef.current?.add(mesh)
      }
      mesh.position.set(x, y + 0.8, z)
      mesh.rotation.y = r.position.theta
    })
  }, [map, robotId])

  return <div ref={containerRef} style={{ width: '100%', height: '100%', minHeight: 500, background: '#0a0e1a' }} />
}
```

> 后续按 `G1-FULL-RESTORE.md` 把占位胶囊替换为 `G1Humanoid`（URDF 29 DOF 驱动）。

### 3.7 mock-ws-server GPS 模式

```js
// mock-ws-server.js 新增
const ROUTE = [
  { lng: 116.519942, lat: 39.924677 },  // 商场门口
  { lng: 116.520200, lat: 39.924900 },
  { lng: 116.520800, lat: 39.925300 },  // 取餐点 A
  { lng: 116.521400, lat: 39.924800 },  // 充电柜
]
let idx = 0, progress = 0
setInterval(() => {
  progress += 0.02
  if (progress >= 1) { progress = 0; idx = (idx + 1) % (ROUTE.length - 1) }
  const from = ROUTE[idx], to = ROUTE[idx + 1]
  const lng = from.lng + (to.lng - from.lng) * progress
  const lat = from.lat + (to.lat - from.lat) * progress
  const heading = Math.atan2(to.lat - from.lat, to.lng - from.lng) * 180 / Math.PI
  wss.clients.forEach(c => c.send(JSON.stringify({
    topic: '/gps',
    data: { deviceId: 'g1-001', lng, lat, alt: 0, heading, speed: 0.8, accuracy: 1.2, ts: Date.now() }
  })))
}, 100)
```

### 3.8 wsHub 分发

```ts
// web-console/src/lib/wsHub.ts
case '/gps': {
  const state = adaptGps(msg.data, msg.data.coordsys ?? 'wgs84')
  useRobotStore.getState().updateRobot(state.robotId, state)
  break
}
```

### 3.9 分步清单（总计 3-4 天）

| 步 | 动作 | 耗时 | 验证点 |
|----|------|------|--------|
| 1 | `.env.local` 填 Key + securityJsCode | 30min | 地图能显示 |
| 2 | `amapLoader.ts` + `lib/amap.ts` | 2h | 搜"朝阳大悦城"返经纬度 |
| 3 | `route.ts` 步行路径 | 2h | 两点间返折线 |
| 4 | `adapter-gps.ts` + mock /gps | 2h | 纠偏偏移 < 2m |
| 5 | wsHub `/gps` 分发 | 1h | store 实时更新 |
| 6 | `MapRobotViewer.tsx` | 4h | 地图+3D 胶囊 |
| 7 | 画路线折线 + 起终点 | 2h | 折线沿道路 |
| 8 | 机器人跟随 GPS + 朝向 | 2h | 沿路线移动 |
| 9 | 替换 G1Humanoid（URDF）| 3h | 真机器人沿路走 |
| 10 | 轨迹线 + 平滑 + 性能 | 2h | ≥60fps |

### 3.10 验证清单

- [ ] POI 经纬度落地图偏差 < 50m
- [ ] GPS(WGS-84) 纠偏后与实际位置重合（**不纠偏偏 300-500m**）
- [ ] 步行路径沿**人行道**，不穿越建筑
- [ ] mock 100ms 推 GPS，3D 同步 < 200ms
- [ ] `renderer.autoClear = false` + `resetState()`（否则底图黑屏）

### 3.11 常见坑

| 问题 | 原因 | 解决 |
|------|------|------|
| 偏移 300-500m | GPS 未纠偏 | `adapter-gps` transform |
| 路线穿越建筑 | 用驾车非步行 | 室外用 `AMap.Walking` |
| 3D 黑屏 | `autoClear=true` | 设 `false` + `resetState()` |
| Key 报错 | securityJsCode 未注入 | `_AMapSecurityConfig` 须在 maps 前 |
| 抖动 | 远离 customCoords 中心 | 动态 `setCenter` |

### 3.12 合规提醒

1. **Key 安全**：前端 Key 配域名白名单；Web 服务 Key 走后端代理，不进前端
2. **轨迹隐私**：GPS 轨迹属敏感数据 → 告知授权 + WSS/HTTPS + 租户隔离（RLS）
3. **高德条款**：禁止缓存/二次分发地图数据；超免费配额需商业授权

---

## 第四章 · SOP 编排引擎

### 4.1 数据结构

```ts
// sop-editor/src/schema/sop-schema.ts
export interface SopNode {
  id: string
  type: 'boot' | 'move' | 'speak' | 'wait' | 'loop' | 'condition' | 'pickup' | 'shutdown'
  position: { x: number; y: number }
  data: Record<string, any>
}
export interface SopEdge { id: string; source: string; target: string; label?: string }
export interface SopGraph {
  id: string; name: string
  industry: 'hotpot' | 'pharmacy' | 'mall' | 'factory' | 'outdoor'  // ★ 新增 outdoor
  brand: string; model: string
  nodes: SopNode[]; edges: SopEdge[]
  createdAt: number
}

// ★ 室外 Waypoint 扩展
export interface WaypointData {
  x?: number; y?: number          // 室内相对米
  lng?: number; lat?: number      // 室外经纬度
  floor?: number
  coordType: 'local' | 'wgs84' | 'gcj02'
  speed?: number
}

export function graphToPayload(graph: SopGraph) { ... }
```

### 4.2 执行引擎 + 模拟器

```ts
// sop-editor/src/engine/sop-executor.ts（核心，不依赖 React）
export interface ExecContext { robotId: string; store: any; signal: AbortSignal }
export async function executeGraph(graph: SopGraph, ctx: ExecContext) {
  // 拓扑排序 → 按 edges 遍历 → 每个节点调对应 handler
  // boot/pickup/shutdown 控制生命周期；move/speak/wait 执行动作
  // loop 循环；condition 分支（true/false 出口）
}

// sop-editor/src/engine/sop-simulator.ts（无真机时用 mock 数据模拟执行）
```

### 4.3 火锅店晚市传菜模板（真实场景示例）

17 节点 + 18 条边 + 航点 + 告警配置，存 `hotpot-dinner-v1.json`，导入画布即用。
详见 `SOP-HOTPOT.md`。

### 4.4 存储（Supabase 双层：优先远端，离线降级 localStorage）

```ts
// sop-editor/src/storage/sopStorage.ts
export async function saveSop(graph: SopGraph): Promise<StoredSop> {
  // ① 先写 Supabase（多租户 + RLS）
  // ② 失败则降级 localStorage（离线可用）
  // ③ 返回带 version + updatedAt 的完整记录
}
export async function listSops(): Promise<StoredSop[]> { ... }
export function exportSopFile(graph: SopGraph) { /* 下载 .json */ }
export async function importSopFile(file: File): Promise<SopGraph> { ... }
```

---

## 第五章 · 数字孪生（G1 等比例还原）

### 5.1 选型

| 机器人 | 模型 | 加载方式 |
|--------|------|---------|
| 宇树 G1 29 DOF（人形，复杂首选）| URDF | `three-urdf`：`parseURDF` + `loadRobot` + `setJointValues` |
| 宇树 Go2 / 四足 | URDF/GLB | useGLTF 或 three-urdf |
| 擎朗 Peanut / 普渡（餐饮主力）| GLB | `useGLTF` |
| 智元 D1 | URDF | three-urdf |

### 5.2 G1Humanoid 骨架（完整代码见 `G1-HUMANOID.md`）

```tsx
function G1Humanoid({ joints, position, rotation }: Props) {
  const { scene } = useGLTF('/models/g1/g1_29dof.urdf')  // three-urdf 加载
  const ref = useRef<THREE.Group>(null!)
  useFrame(() => {
    if (joints && ref.current) {
      Object.entries(joints).forEach(([name, val]) => {
        const bone = ref.current.getObjectByName(name)
        if (bone) bone.rotation.z = val  // 按 JOINT_AXIS_OVERRIDE 映射轴
      })
    }
  })
  return <primitive ref={ref} object={scene} position={position} rotation={rotation} />
}
```

### 5.3 等比例还原三层

| 层 | 校验 | 标准 |
|----|------|------|
| L1 几何 | `Box3` 量身高 | G1 = **1.30m**；肩宽 0.42m |
| L2 视觉 | Blender 单位=米 / Scale=1.0 / Apply Transform | PBR + Draco 压缩 |
| L3 运动学 | `JOINT_AXIS_OVERRIDE` 校准 29 关节 | 各关节按命名推断轴（hip→y, thigh/knee→x, roll→z）|

**单位转换（头号坑）**：STL 从 CAD 来是 mm → URDF 必须 `scale="0.001 0.001 0.001"`；Z-up(ROS)→Y-up(Three) 用 `loadRobot(model, { upAxis: 'y' })`。

### 5.4 完全还原 10 步（详见 `G1-FULL-RESTORE.md`）

1. 获取 `g1_29dof.urdf` + `meshes/` → `public/models/g1/`
2. `pnpm --filter digital-twin add three-urdf urdf-loader three@0.162.0`
3. 替换 G1Dog.tsx → G1Humanoid.tsx（含 validateScale 包围盒校验）
4. URDF mesh 加 `scale="0.001"` + `upAxis:'y'`
5. 升级 RobotViewer（OrbitControls + Environment + Grid + Html HUD）
6. 发光轨迹线（AdditiveBlending）
7. 校准关节轴映射表
8. RViz 交叉验证
9. 性能优化（Instances / LOD / dpr）
10. 录 30 秒演示视频

### 5.5 性能预算

| 项 | 预算 |
|----|------|
| 帧率 | ≥ 60fps |
| Draw call | < 200 |
| 三角面 | < 500K |
| 首帧 | < 3s |
| 同屏机器人 | ≤ 50（Instances）|

---

## 第六章 · UI 科技感

### 6.1 视觉语言（Fluent Glass + HUD + Cyberpunk 三层）

```css
:root {
  --bg-deep: #0a0e1a;
  --bg-card: rgba(16, 23, 42, 0.6);
  --accent: #00f0ff;        /* 青蓝霓虹（信号色）*/
  --accent-2: #7b61ff;      /* 紫 */
  --warn: #ff3d71; --ok: #00e676;
  --border: rgba(0, 240, 255, 0.15);
  --glow: 0 0 12px rgba(0, 240, 255, 0.4);
  --font-mono: 'JetBrains Mono', monospace;
  --font-sans: 'Inter', sans-serif;
}
[data-tenant="laowang"] { --accent: #f97316; }
[data-tenant="hotpot01"] { --accent: #dc2626; }
```

### 6.2 核心组件（可复用）

```tsx
// ui-kit/src/RobotStatusCard.tsx
export function RobotStatusCard({ robot }: Props) {
  return (
    <div className="card hud-frame">
      <div className="card-corner top-left" />
      <div className="card-header">
        <span className="status-dot pulse" data-online={robot.online} />
        <span className="font-mono">{robot.robotId}</span>
      </div>
      <BatteryGauge value={robot.batteryPct} />      {/* 分段能量条 10 段 */}
      <div className="coords font-mono">
        X {robot.position.x.toFixed(2)}
        Y {robot.position.y.toFixed(2)}
        θ {(robot.position.theta * 180 / Math.PI).toFixed(1)}°
      </div>
    </div>
  )
}
```

### 6.3 6 页面对照

| 路由 | 页面 | 风格 |
|------|------|------|
| `/` | Dashboard | 毛玻璃 KPI 卡 + 雷达 |
| `/robots` | RobotsPage | 三栏列表+3D+详情 |
| `/robots/:id` | TwinPage | 全屏 3D + 四角 HUD |
| `/sop` | SopPage | React Flow 画布 |
| `/alerts` | AlertsPage | 等级色条 + 跑马灯 |
| `/tenants` | TenantsPage | 租户卡 + 换肤 |
| **`/fleet-map`** | **★ FleetMapPage** | **高德 3D + R3F 融合** |

### 6.4 设计原则

- **暗色为底 → 毛玻璃承载 → 青蓝霓虹做信号色 → 等宽字体承载数据**
- 动效**只在变化时刻触发**（hover/选中/告警/数据刷新），平时克制
- 不用 emoji（用 Lucide 图标）；不用纯白（用 gray-300）
- `prefers-reduced-motion` 关闭动画

> 完整代码 + Tailwind 配置 + 9 套 Prompt 模板见 `UI-OPTIMIZATION.md` / `UI-INSPIRATION.md`。

---

## 第七章 · Supabase 多租户后端

### 7.1 表结构

```sql
create table tenants    (slug text primary key, name text, logo_url text, primary_color text default '#3b82f6');
create table robots    (id uuid primary key default gen_random_uuid(), robot_id text unique, brand text, model text, tenant_slug text, name text);
create table sop_templates (id uuid primary key, name text, industry text, brand text, model text, graph jsonb, tenant_slug text);
create table alerts    (id uuid primary key, robot_id text, level text, code text, message text, tenant_slug text, resolved boolean default false, created_at timestamp default now());
create table webhook_configs (id uuid primary key, tenant_slug text, type text, url text);

alter table robots enable row level security;
create policy "tenant_isolation" on robots
  using (tenant_slug = current_setting('request.jwt.claims')::json->>'tenant_slug');
-- 同理 sop_templates / alerts / webhook_configs
```

### 7.2 Edge Function：注入 tenant_slug

```ts
// supabase/functions/set-tenant-claim/index.ts
// 登录/注册后通过 RPC 设置 claims，RLS 自动按租户隔离
```

### 7.3 Realtime 替代 WS Hub（进阶）

数据库变更 → Supabase Realtime → 前端订阅 → 自动更新 Zustand。

### 7.4 企微/钉钉告警 Webhook

```ts
// 告警触发时
fetch(webhookUrl, { method: 'POST', body: JSON.stringify({
  msgtype: 'text', text: { content: `🤖 ${robotId} 电量低: ${batteryPct}%` }
})})
```

### 7.5 何时用 Supabase

满足**任一条**即迁：第 2 个客户 / 多设备 / 贴牌后台 / 团队协作 / 模板市场。
**现在**：配置 `.env` 即可；不填走纯前端 mock。

---

## 第八章 · 商业化路线图（18 个月）

### 8.1 阶段总览

| 阶段 | 时间 | 主题 | 收入预期 |
|------|------|------|---------|
| **M1-M3** 打磨期 | 已完成 ✅ | adapter 4 品牌 + UI + 测试 | ¥0 |
| **M4-M6** 冷启动 | 进行中 🟡 | **高德室外 + 找 RaaS 合伙人** | ¥0-3K |
| **M7-M9** 增长期 | — | 标准化漏斗 + 模板复制 | ¥15K/月 |
| **M10-M12** 盈利期 | — | 全职化决策（¥30K/月）| ¥30K/月 |
| **M13-M15** 深化期 | — | 模板市场上线 + 年度复盘 | ¥40-60K/月 |
| **M16-M18** 护城河期 | — | 公司化 + 招第 1 人 | ¥50-80K/月 |

### 8.2 壁垒三层（协议公开后仍成立）

1. **Layer 1 连接广度**（易抄）：adapter 4→6 家，覆盖餐饮 90%
2. **Layer 2 场景深度**（核心）：SOP 模板 5→25 份（火锅/药房/商场/工厂/室外）
3. **Layer 3 客户锁定**（最硬）：租户 0→30、转介绍占比→30%+

> 大厂做"连接层"标准化，你做"餐饮运营层"独家化。

### 8.3 单人铁律

| 规则 | 原因 |
|------|------|
| adapter 永远纯 TS，不 import React | 可复用到 Node/Electron/CLI |
| 3D 只从 Zustand 读，不直连 WS | 多组件共享，不断流 |
| 每服务一个客户 → adapter 补全 + SOP 入库 + 组件抽象 | 复利积累 |
| 不做后端重框架（Nest/Spring/K8s）| 单人维护不了，Supabase 够 3 年 |
| 不碰控制算法 / 不写固件 | 那是别人的护城河 |
| 每周至少跑 1 家实体店 | 代码写不出需求 |

### 8.4 城市选择

- **M1-M12 深圳起步**：厂商在楼下（普渡/优必选/越疆）+ 合伙人密集 + 零租加速营
  - 注册：龙岗 OPC（免租半年~2年 + 免费算力）
  - 对接：南山零租加速营孵化共同体
- **M13-M18 北京扩张**：亦庄万台计划 + 政企场景 + 算法资源

---

## 第九章 · 启动命令与验证

```bash
# 安装
pnpm install

# 启动假数据 WS（终端 1）
node mock-ws-server.js

# 启动前端（终端 2）
pnpm --filter web-console dev

# 构建
pnpm --filter web-console build

# 测试
pnpm --filter adapter-kit test
pnpm --filter sop-editor test

# 循环依赖检查（必跑）
npx madge --circular packages/ apps/

# 部署
# Vercel 导入 → 配 env（含 AMAP_JS_KEY）→ 自动构建
```

---

## 第十章 · 文档地图（14 份专题 + 本文件）

> 本文件是索引；**具体实现细节以专题文档为准**。

| # | 文件 | 主题 |
|---|------|------|
| 0 | **COMPLETE.md（本文件）** | 整合总览 + 高德主线 + 全部代码骨架 |
| 1 | DEV-GUIDE.md | 架构总纲 + 目录 + 20 章基础 |
| 2 | 18MONTH-ROADMAP.md | 18 个月壁垒路线图 |
| 3 | SUPABASE.md | 6 表 + RLS + Realtime + Webhook |
| 4 | adapter-kit | 各品牌字段映射（对照 unified.ts 实现）|
| 5 | SOP-HOTPOT.md | 火锅店 SOP 完整模板 + 执行引擎 |
| 6 | SPEAK-FEATURE.md | B 点自动播报（/speak + TTS）|
| 7 | 3D-VIEW-CLEAN.md | 数字孪生 + **干净架构（Context/store）** |
| 8 | G1-HUMANOID.md | G1 29 DOF 组件代码 |
| 9 | G1-FULL-RESTORE.md | G1 完全还原 10 步落地 |
| 10 | UNITREE-SCALE.md | 等比例三层规范 |
| 11 | **AMAP-OUTDOOR.md** | 高德室外路线（本文件第三章详版）|
| 12 | UI-OPTIMIZATION.md | UI 科技感完整方案 |
| 13 | UI-INSPIRATION.md | UI 参考站 + Prompt 模板 |
| 14 | robot-ops-solo-check/ | 自检脚本与验证工具 |

### 阅读顺序建议

1. **新成员/你自己回顾** → 本文件（COMPLETE.md）一遍打通
2. **写 adapter** → DEV-GUIDE + 各 `adapter-xxx.ts`
3. **接新品牌/真机** → adapter 规范 + UNITREE-SCALE
4. **做 3D** → 3D-VIEW-CLEAN + G1-HUMANOID + G1-FULL-RESTORE
5. **接地图/室外** → **AMAP-OUTDOOR**（本文件第三章为其精简版）
6. **商业化** → 18MONTH-ROADMAP + SUPABASE

---

## 附录 A · 你现在最该做的（今日清单）

1. **填 `.env.local`**：把控制台 `前端地图` 的 Key + 安全密钥粘贴进去
2. **验证 Key**：`pnpm dev` → 打开 `/fleet-map` → 暗色 3D 地图 + 青色胶囊沿路线移动
3. **替换 G1**：按 `G1-FULL-RESTORE.md` 下 `g1_29dof.urdf` + meshes → 胶囊变真人形
4. **录 30 秒视频**：真实地图 + G1 沿人行道走 = 见合伙人/投资人的杀手级演示
5. **找合伙人**：深圳龙岗/南山，谈"跨品牌统一后台贴牌，30 元/台/月"

## 附录 B · 室外 vs 室内坐标对照

| 维度 | 室内 | 室外 |
|------|------|------|
| 单位 | 米（相对原点）| 度（经纬度）|
| X 轴 | 东 | 经度 |
| Y 轴 | 北 | 纬度 |
| Z 轴 | 上 | 高度(alt) |
| 原点 | 自定义(0,0) | 动态=路线中心 |
| 来源 | CAD/SOP 标定 | GPS/路径规划/POI |
| 坐标系 | 右手系 | GCJ-02 |
| 转换 | 无 | `customCoords.lngLatsToCoords` |

## 附录 C · 版本变更

- **v2.0**（2026-08-29）：整合 14 份专题；纳入高德 Key 配置完成状态；新增第三章室外完整代码（amapLoader / amap.ts / MapRobotViewer / mock / wsHub）
- v1.0（2026-08-14）：初版，基础架构 + UI + Supabase

---

> **一句话定位**：你已有**完整的跨品牌运维中台骨架**（adapter / SOP / 孪生 / Supabase / UI 全通）+ **正确配置的高德 Key**。下一步只是**把 `前端地图` 的 Key 填进 `.env.local`，然后照第三章 3.9 清单 10 步走完**——一个站在朝阳大悦城真实经纬度、沿真实人行道行走的 URDF G1，就是你从"技术 demo"跃迁为"能拿去见合伙人/投资人的产品"的分水岭。
