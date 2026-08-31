# 高德室外真实路线 + 实时 3D 显示 开发文档

> **目标**：把 G1（或任意机器人）从"灰色迷宫原点"搬进**真实世界经纬度**，室外沿**真实道路/人行道路线**移动，轨迹实时渲染到 R3F 3D 场景上。
> **适用范围**：robot-ops-solo · packages/digital-twin · apps/web-console
> **前置文档**：`UNITREE-SCALE.md`（等比例）、`G1-HUMANOID.md`、`3D-VIEW-CLEAN.md`、`G1-FULL-RESTORE.md`、`AMAP-INTEGRATION.md`（若已生成）

---

## 一、目标场景定义

### 1.1 用户视角的"室外"

指机器人在**商场外广场、园区道路、人行步道、校园/产业园**等开放区域作业：
- 沿**真实可走的道路**巡航（不是直线穿越建筑）
- 停靠点是**真实 POI**（门口、取餐点、充电柜）
- 路线来自**高德步行/驾车路径规划**（遵守单行、禁行、转弯半径）
- 位置来自**GPS/WGS-84 或 UWB/RTK**，上报 GCJ-02 经纬度

### 1.2 画面效果

```
┌──────────────────────────────────────┐
│  [高德暗色 3D 地图，pitch=60°]         │
│   ● 朝阳大悦城 (poi)                  │
│    ╱╲                                 │
│   ╱  ╲  ◆ 取餐点A (真实经纬度)        │
│  ╱    ╲                              │
│ ●──────● 道路折线(高德步行路径)        │
│ 充电柜  机器人(G1，正沿路线移动)        │
│                                        │
│  [左下雷达] [右下 STATE MACHINE]      │
└──────────────────────────────────────┘
```

### 1.3 与已有模块的关系

| 模块 | 本场景职责 |
|------|-----------|
| `adapter-kit` | 新增 `adapter-gps.ts`：把 GPS/WGS-84 原始报文 → `UnifiedRobotState`，含 `coordsys` 纠偏 |
| `digital-twin` | 新增 `MapRobotViewer.tsx`：高德地图 + GLCustomLayer 承载 R3F 机器人 + 路线 |
| `web-console` | 新增 `/fleet-map` 室外总览页；改造 `/robots/:id` 增加"室外路线"Tab |
| `sop-editor` | Waypoint 节点坐标从"相对米"升级为"经纬度 + 楼层" |

---

## 二、整体架构与数据流

### 2.1 数据流（单向，遵守干净架构）

```
[真实世界]
  GPS/WGS-84 (机器人/手机/模拟器)
        │
        ▼ ① 原始报文 {lat, lng, alt, heading, speed, ts}
[adapter-kit / adapter-gps.ts]
  - 坐标纠偏 coordsys=gps → GCJ-02
  - 映射为 UnifiedRobotState
        │
        ▼ ② WS/MQTT 推到前端
[web-console / wsHub.ts]  ← 唯一写入点
  - 调 store 的 updateRobot()
        │
        ▼ ③ Zustand robotStore
[useRobotState(robotId)]
        │
        ▼ ④ 每帧消费
[MapRobotViewer.tsx]
  - GLCustomLayer.render() 同步相机
  - 经纬度 → Three 世界坐标 (customCoords)
  - 渲染 G1Humanoid + 路线折线 + 轨迹
```

### 2.2 关键设计原则

1. **真实经纬度只在一处产生**：POI 搜索 / 路径规划 / GPS 上报，全部 GCJ-02
2. **3D 场景不存经纬度**：内部用局部"米"坐标，仅在 GL 层做 `lngLatsToCoords` 转换
3. **原点动态设置**：以"当前机器人或路线中心"为 customCoords 中心，避免远离原点浮点精度丢失
4. **GPS 抖动平滑**：前端对 heading/speed 做低通滤波，不直连原始值

---

## 三、环境准备与 Key 申请

### 3.1 高德 Key

1. 控制台 → 应用管理 → 创建应用 → 添加 Key
2. **JS API 的 Key**：勾选 "Web端 JS API"（浏览器使用）
3. **Web 服务 Key**：勾选 "Web服务"（服务端 POI 搜索/路径规划，可选）
4. 安全密钥：`securityJsCode`（JS API 2.0 必须）

### 3.2 `.env.example`

```env
# apps/web-console/.env.local
VITE_AMAP_JS_KEY=你的JS_API_Key
VITE_AMAP_SECURITY_CODE=你的securityJsCode
VITE_AMAP_WEB_KEY=你的Web服务Key   # 服务端路径规划用

# 机器人坐标系（默认 gcj02，若上报 gps 则保持）
VITE_DEFAULT_COORDSYS=gcj02
```

> ⚠️ **不要用同一个 Key 混用 JS 和 Web 服务**，高德会按类型校验。

### 3.3 依赖

```bash
# web-console 需要高德 JS API 类型
pnpm --filter web-console add @amap/amap-jsapi-types

# 不需要装 three 之外的包，GLCustomLayer 用原生
```

通过 `<script>` 全局引入（Vite 里用 `vite-plugin-html` 注入）：

```html
<!-- index.html -->
<script>
  window._AMapSecurityConfig = {
    securityJsCode: "%VITE_AMAP_SECURITY_CODE%",
  }
</script>
<script src="https://webapi.amap.com/maps?v=2.0&key=%VITE_AMAP_JS_KEY%&plugin=AMap.PlaceSearch,AMap.Walking,AMap.Driving,AMap.Geocoder,AMap.Polyline"></script>
```

---

## 四、Step 1：POI 搜索 —— 获取真实停靠点

### 4.1 封装地理工具 `lib/amap.ts`

```ts
// apps/web-console/src/lib/amap.ts
declare global {
  interface Window { AMap: any }
}

export function getAMap(): Promise<any> {
  return new Promise((resolve) => {
    if (window.AMap) return resolve(window.AMap)
    const timer = setInterval(() => {
      if (window.AMap) {
        clearInterval(timer)
        resolve(window.AMap)
      }
    }, 100)
  })
}

export interface POI {
  id: string
  name: string
  address: string
  lng: number
  lat: number
  type?: string
}

/** 关键字搜索（JS 端，适合少量点） */
export async function searchPOI(keyword: string, city = '北京'): Promise<POI[]> {
  const AMap = await getAMap()
  return new Promise((resolve, reject) => {
    const placeSearch = new AMap.PlaceSearch({
      city,
      pageSize: 25,
      extensions: 'base',
    })
    placeSearch.search(keyword, (status: string, result: any) => {
      if (status !== 'complete') return reject(new Error(status))
      const list = result.poiList?.pois ?? []
      resolve(
        list.map((p: any) => ({
          id: p.id,
          name: p.name,
          address: p.address,
          lng: p.location.getLng(),
          lat: p.location.getLat(),
          type: p.type,
        }))
      )
    })
  })
}

/** 地理编码：地址 → 经纬度 */
export async function geocode(address: string, city = '北京') {
  const AMap = await getAMap()
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

/** 逆地理编码：经纬度 → 地址（机器人上报时用） */
export async function regeocode(lng: number, lat: number) {
  const AMap = await getAMap()
  return new Promise<any>((resolve, reject) => {
    const geocoder = new AMap.Geocoder({ extensions: 'all' })
    geocoder.getAddress([lng, lat], (status: string, result: any) => {
      if (status !== 'complete') return reject(new Error(status))
      resolve(result.regeocode)
    })
  })
}
```

### 4.2 服务端批量采集（可选，生产推荐）

```ts
// server/amap-batch.ts —— Node 脚本，不走前端配额
import fetch from 'node-fetch'

const KEY = process.env.AMAP_WEB_KEY!

async function searchWeb(keyword: string, adcode: string) {
  const url = `https://restapi.amap.com/v3/place/text?keywords=${encodeURIComponent(keyword)}&city=${adcode}&types=050000&offset=25&page=1&key=${KEY}`
  const res = await fetch(url)
  const json: any = await res.json()
  return json.pois ?? []
}

// 朝阳 110105 / 海淀 110108
for (const adcode of ['110105', '110108']) {
  const pois = await searchWeb('火锅', adcode)
  console.log(pois.length)
  // 落库: {poi_id, brand, name, lng, lat, address, source:'amap', coord:'GCJ-02'}
}
```

---

## 五、Step 2：路径规划 —— 获取真实道路路线

### 5.1 步行路径（机器人室外推荐）

```ts
// apps/web-console/src/lib/route.ts
import { getAMap, POI } from './amap'

export interface RoutePoint { lng: number; lat: number; floor?: number }

/** 高德步行路径规划，返回折线经纬度数组 */
export async function planWalking(from: RoutePoint, to: RoutePoint): Promise<RoutePoint[]> {
  const AMap = await getAMap()
  return new Promise((resolve, reject) => {
    const walking = new AMap.Walking({
      map: null,              // 不在地图上自动绘制，手动控制
      hideMarkers: true,
    })
    walking.search(
      [from.lng, from.lat],
      [to.lng, to.lat],
      (status: string, result: any) => {
        if (status !== 'complete') return reject(new Error(status))
        const path = result.routes?.[0]?.steps ?? []
        const points: RoutePoint[] = []
        path.forEach((step: any) => {
          // 每步有 start_location / end_location / path(折线)
          step.path?.forEach((p: any) => points.push({ lng: p.getLng(), lat: p.getLat() }))
        })
        resolve(points)
      }
    )
  })
}

/** 多点路线（传菜 A→B→C） */
export async function planMultiWaypoints(waypoints: RoutePoint[]): Promise<RoutePoint[]> {
  const all: RoutePoint[] = []
  for (let i = 0; i < waypoints.length - 1; i++) {
    const seg = await planWalking(waypoints[i], waypoints[i + 1])
    all.push(...seg)
  }
  return all
}
```

### 5.2 驾车/货车（园区配送车）

```ts
// 同理用 AMap.Driving，可传 strategy 避拥堵
const driving = new AMap.Driving({ strategy: 10 })  // 10=躲避拥堵
```

> 💡 **机器人室外默认用步行路径**：遵守人行道、转弯半径小；园区配送车/送货车才用驾车。

### 5.3 SOP Waypoint 升级

```ts
// sop-editor/src/schema/sop-schema.ts 扩展
export interface WaypointData {
  x?: number        // 室内相对米（保留）
  y?: number
  lng?: number      // 室外经纬度（新增）
  lat?: number
  floor?: number    // 楼层
  coordType: 'local' | 'wgs84' | 'gcj02'
  speed?: number
}
```

---

## 六、Step 3：GPS 上报与坐标纠偏

### 6.1 adapter-kit 新增 `adapter-gps.ts`

```ts
// packages/adapter-kit/src/adapters/adapter-gps.ts
import type { UnifiedRobotState } from '../types/unified'

/** 机器人原始 GPS 报文（WGS-84，GPS/手机/大多数模块默认） */
export interface GpsRawMsg {
  deviceId: string
  lat: number        // WGS-84 纬度
  lng: number        // WGS-84 经度
  alt?: number
  heading: number    // 0-360，正北为 0
  speed: number      // m/s
  accuracy?: number  // 定位精度 m
  ts: number
}

/**
 * GPS 坐标纠偏：WGS-84 → GCJ-02
 * 高德/腾讯/百度中国区统一用 GCJ-02，GPS 直接画会偏移 300~500m
 * 采用标准高斯-克吕格近似（误差 < 2m，够室外机器人用）
 */
const A = 6378245.0
const EE = 0.00669342162296594323
const PI = Math.PI

function transform(x: number, y: number) {
  const dLat = transformLat(y - 35.0, x - 105.0)
  const dLng = transformLng(y - 35.0, x - 105.0)
  const radLat = (y / 180.0) * PI
  let magic = Math.sin(radLat)
  magic = 1 - EE * magic * magic
  const sqrtMagic = Math.sqrt(magic)
  let lat = dLat * 180.0
  let lng = dLng * 180.0
  lat /= (A * (1 - EE)) / (magic * sqrtMagic) * PI
  lng /= (A / sqrtMagic) * Math.cos(radLat) * PI
  return { lat: y + lat, lng: x + lng }
}

function transformLat(x: number, y: number) {
  let ret = -100.0 + 2.0 * x + 3.0 * y + 0.2 * y * y + 0.1 * x * y + 0.2 * Math.sqrt(Math.abs(x))
  ret += (20.0 * Math.sin(6.0 * x * PI) + 20.0 * Math.sin(2.0 * x * PI)) * 2.0 / 3.0
  ret += (20.0 * Math.sin(y * PI) + 40.0 * Math.sin(y / 3.0 * PI)) * 2.0 / 3.0
  ret += (160.0 * Math.sin(y / 12.0 * PI) + 320 * Math.sin(y * PI / 30.0)) * 2.0 / 3.0
  return ret
}

function transformLng(x: number, y: number) {
  let ret = 300.0 + x + 2.0 * y + 0.1 * x * x + 0.1 * x * y + 0.1 * Math.sqrt(Math.abs(x))
  ret += (20.0 * Math.sin(6.0 * x * PI) + 20.0 * Math.sin(2.0 * x * PI)) * 2.0 / 3.0
  ret += (20.0 * Math.sin(x * PI) + 40.0 * Math.sin(x / 3.0 * PI)) * 2.0 / 3.0
  ret += (150.0 * Math.sin(x / 12.0 * PI) + 300.0 * Math.sin(x / 30.0 * PI)) * 2.0 / 3.0
  return ret
}

export function adaptGps(raw: GpsRawMsg, coordsys: 'wgs84' | 'gcj02' = 'wgs84'): UnifiedRobotState {
  // 统一转 GCJ-02
  const { lng, lat } = coordsys === 'wgs84' ? transform(raw.lng, raw.lat) : { lng: raw.lng, lat: raw.lat }

  return {
    robotId: raw.deviceId,
    brand: 'unitree',
    model: 'g1',
    batteryPct: 0,            // GPS 模块不带电量，由机器人其他 topic 补充
    voltage: 0,
    online: true,
    position: {
      x: lng,                  // ★ 注意：position.x = 经度，.y = 纬度（室外模式）
      y: lat,
      theta: (raw.heading * PI) / 180,
    },
    status: raw.speed > 0.1 ? 'moving' : 'idle',
    lastSeen: raw.ts,
    // 扩展字段（unified.ts 需加）
    // gps: { lng, lat, alt: raw.alt, accuracy: raw.accuracy }
  }
}
```

> ⚠️ **关键**：室外模式下 `position.x=经度, .y=纬度`，与室内 `(x_m, y_m)` 不同。建议在 `UnifiedRobotState` 增加 `mode: 'indoor' | 'outdoor'` 和 `gps?: {...}` 字段区分。

### 6.2 mock-ws-server 增加 GPS 模式

```js
// mock-ws-server.js 新增
const ROUTE = [               // 真实经纬度（朝阳大悦城周边）
  { lng: 116.519942, lat: 39.924677 },  // 起点：商场门口
  { lng: 116.520200, lat: 39.924900 },
  { lng: 116.520500, lat: 39.925100 },  // 途经
  { lng: 116.520800, lat: 39.925300 },  // 取餐点 A
  { lng: 116.521100, lat: 39.925100 },
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

### 6.3 wsHub 分发

```ts
// web-console/src/lib/wsHub.ts 增加 case
case '/gps': {
  const state = adaptGps(msg.data, msg.data.coordsys ?? 'wgs84')
  useRobotStore.getState().updateRobot(state.robotId, state)
  break
}
```

---

## 七、Step 4：MapRobotViewer —— 高德 + R3F 融合

### 7.1 坐标转换封装

```ts
// packages/digital-twin/src/map/mapCoords.ts
export interface MapContext {
  map: any
  customCoords: any
  center: { lng: number; lat: number }
}

/** 经纬度数组 → Three.js 世界坐标（X右/Y上/Z前，高度=Y） */
export function lngLatToWorld(
  ctx: MapContext,
  lng: number, lat: number, alt = 0
): [number, number, number] {
  const [x, y, z] = ctx.customCoords.lngLatsToCoords([[lng, lat, alt]])
  return [x, y, z]  // Three 坐标系
}

/** 路线经纬度数组 → 世界坐标数组 */
export function routeToWorld(ctx: MapContext, route: { lng: number; lat: number }[]) {
  return route.map(p => lngLatToWorld(ctx, p.lng, p.lat))
}
```

### 7.2 完整 MapRobotViewer

```tsx
// packages/digital-twin/src/map/MapRobotViewer.tsx
import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { getAMap } from '../../../apps/web-console/src/lib/amap'
import { lngLatToWorld, routeToWorld, MapContext } from './mapCoords'
import { G1Humanoid } from '../robots/G1Humanoid'

interface Props {
  center: { lng: number; lat: number }   // 路线/机器人中心
  route?: { lng: number; lat: number }[]  // 真实路径折线
  robotId: string
  zoom?: number
}

export function MapRobotViewer({ center, route = [], robotId, zoom = 18 }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [ctx, setCtx] = useState<MapContext | null>(null)
  const sceneRef = useRef<THREE.Scene>()
  const cameraRef = useRef<THREE.PerspectiveCamera>()
  const rendererRef = useRef<THREE.WebGLRenderer>()

  useEffect(() => {
    let mounted = true
    const init = async () => {
      const AMap = await getAMap()
      if (!containerRef.current || !mounted) return

      const map = new AMap.Map(containerRef.current, {
        viewMode: '3D',
        pitch: 60,
        rotation: -35,
        zoom,
        center: [center.lng, center.lat],
        mapStyle: 'amap://styles/dark',
        showLabel: false,
        showBuildingBlock: true,     // 3D 楼块
      })

      const customCoords = map.customCoords
      customCoords.setCenter([center.lng, center.lat])

      // —— 初始化 Three 场景（复用地图 gl）——
      const scene = new THREE.Scene()
      const camera = new THREE.PerspectiveCamera(60, 1, 100, 1 << 30)

      const gl = (map as any).getGLContext ? (map as any).getGLContext() : null
      const renderer = new THREE.WebGLRenderer({ context: gl as any, antialias: true })
      renderer.autoClear = false   // ★ 必须 false，保留底图

      sceneRef.current = scene
      cameraRef.current = camera
      rendererRef.current = renderer

      // —— 绘制路线折线 ——
      if (route.length > 1) {
        const points = routeToWorld({ map, customCoords, center }, route)
        const geom = new THREE.BufferGeometry().setFromPoints(
          points.map(([x, y, z]) => new THREE.Vector3(x, y + 0.5, z))
        )
        const mat = new THREE.LineBasicMaterial({
          color: 0x00f0ff,
          transparent: true,
          opacity: 0.8,
        })
        scene.add(new THREE.Line(geom, mat))
        // 起点/终点标记
        ;[points[0], points[points.length - 1]].forEach((p, i) => {
          const mesh = new THREE.Mesh(
            new THREE.SphereGeometry(0.5, 8, 8),
            new THREE.MeshBasicMaterial({ color: i === 0 ? 0x00e676 : 0xff3d71 })
          )
          mesh.position.set(p[0], p[1] + 0.5, p[2])
          scene.add(mesh)
        })
      }

      // —— GLCustomLayer 桥接 ——
      const glLayer = new AMap.GLCustomLayer({
        zIndex: 200,
        init: (_gl: any) => { /* renderer 已在上方创建 */ },
        render: () => {
          renderer.resetState()
          const params = customCoords.getCameraParams()
          camera.near = params.near
          camera.far = params.far
          camera.fov = params.fov
          camera.position.set(...params.position as any)
          camera.up.set(...params.up as any)
          camera.lookAt(...params.lookAt as any)
          camera.updateProjectionMatrix()
          renderer.render(scene, camera)
          renderer.resetState()
        },
      })
      map.add(glLayer)

      setCtx({ map, customCoords, center })

      return () => {
        map.destroy()
        renderer.dispose()
      }
    }
    init()
    return () => { mounted = false }
  }, [center.lng, center.lat])

  // —— 机器人跟随实时 GPS 移动 ——
  useEffect(() => {
    if (!ctx || !sceneRef.current) return
    const unsub = useRobotStore.subscribe((state) => {
      const robot = state.robots[robotId]
      if (!robot) return
      const [x, y, z] = lngLatToWorld(
        ctx, robot.position.x, robot.position.y   // x=经度, y=纬度
      )
      // 找到/创建机器人 Mesh（简化：单实例）
      let robotMesh = sceneRef.current!.getObjectByName('g1')
      if (!robotMesh) {
        // 实际应加载 G1Humanoid，此处用占位 + 朝向
        robotMesh = new THREE.Mesh(
          new THREE.CapsuleGeometry(0.4, 1.2, 4, 8),
          new THREE.MeshBasicMaterial({ color: 0x00f0ff })
        )
        robotMesh.name = 'g1'
        sceneRef.current!.add(robotMesh)
      }
      robotMesh.position.set(x, y + 0.8, z)
      robotMesh.rotation.y = robot.position.theta  // 朝向
    })
    return unsub
  }, [ctx, robotId])

  return (
    <div
      ref={containerRef}
      style={{ width: '100%', height: '100%', minHeight: 500, background: '#0a0e1a' }}
    />
  )
}
```

> ⚠️ **注意**：完整版应把 `G1Humanoid`（URDF/GLB）作为 `robotMesh` 替换占位胶囊体；这里用胶囊仅为跑通数据流，后续按 `G1-FULL-RESTORE.md` 替换。

### 7.3 使用页面

```tsx
// apps/web-console/src/routes/FleetMapPage.tsx
import { MapRobotViewer } from 'digital-twin'

const ROUTE = [
  { lng: 116.519942, lat: 39.924677 },
  { lng: 116.520800, lat: 39.925300 },
  { lng: 116.521400, lat: 39.924800 },
]

export function FleetMapPage() {
  return (
    <div style={{ width: '100vw', height: '100vh' }}>
      <MapRobotViewer
        center={{ lng: 116.520500, lat: 39.925000 }}
        route={ROUTE}
        robotId="g1-001"
        zoom={18}
      />
    </div>
  )
}
```

---

## 八、Step 5：轨迹与实时性优化

### 8.1 轨迹线（历史路径）

```ts
// digital-twin/src/map/Trajectory.tsx
// 维护最近 N 个点，每帧更新 Line geometry
export function useTrajectory(robotId: string, maxPoints = 200) {
  const pointsRef = useRef<number[][]>([])
  useRobotStore.subscribe((state) => {
    const r = state.robots[robotId]
    if (!r) return
    pointsRef.current.push([r.position.x, r.position.y])
    if (pointsRef.current.length > maxPoints) pointsRef.current.shift()
    // 更新 BufferGeometry ...
  })
  return pointsRef
}
```

### 8.2 GPS 平滑（低通滤波）

```ts
// adapter-kit/src/utils/smooth.ts
export function lowPass(current: number, prev: number, alpha = 0.3) {
  return prev + alpha * (current - prev)
}
// wsHub 里对 heading/speed 平滑后再写 store
```

### 8.3 性能预算

| 项 | 预算 |
|----|------|
| 地图 POI 数量 | ≤ 200（分批加载）|
| 路线折点数 | ≤ 500 |
| 轨迹历史点 | ≤ 200 |
| 同屏机器人 | ≤ 50（Instances）|
| 帧率 | ≥ 60fps |

---

## 九、分步实施清单（总计 3-4 天）

| 步 | 动作 | 耗时 | 验证点 |
|----|------|------|--------|
| 1 | 申请高德 JS + Web Key，配 `.env` | 30min | 地图能显示 |
| 2 | 封装 `lib/amap.ts`（search/geocode/regeocode）| 2h | 搜"朝阳大悦城"返回经纬度 |
| 3 | 封装 `route.ts`（步行路径规划）| 2h | 两点间返回折线 |
| 4 | 写 `adapter-gps.ts`（WGS→GCJ 纠偏）+ mock | 2h | 纠偏后偏移 < 2m |
| 5 | wsHub 增加 `/gps` 分发 | 1h | store 实时更新 |
| 6 | 新建 `MapRobotViewer.tsx`（GLCustomLayer）| 4h | 地图+3D 胶囊显示 |
| 7 | 接真实路线，画折线 + 起终点 | 2h | 折线沿道路 |
| 8 | 机器人跟随 GPS 移动 + 朝向 | 2h | 胶囊沿路线走 |
| 9 | 替换为 G1Humanoid（URDF/GLB）| 3h | 真机器人沿路线走 |
| 10 | 轨迹线 + 平滑 + 性能优化 | 2h | ≥60fps，轨迹连贯 |

---

## 十、验证清单

### 10.1 坐标正确性
- [ ] POI 搜索返回的经纬度，在地图上 `new AMap.Marker` 定位，与真实位置偏差 < 50m
- [ ] GPS(WGS-84) 上报点，经 `adapter-gps` 纠偏后，在地图上与实际位置重合（不纠偏会偏 300-500m）
- [ ] `customCoords.lngLatsToCoords` 转换后，路线起点/终点与高德地图 Marker 位置一致

### 10.2 路线正确性
- [ ] 步行路径沿**人行道/可通行区域**，不穿越建筑（驾车路径可能走车行道）
- [ ] 多点 SOP（A→B→C）各段路径首尾相接，无跳跃
- [ ] 路线在 3D 场景下贴合地面（高度偏移 +0.5m 避免 Z-fighting）

### 10.3 实时性
- [ ] mock 每 100ms 推 GPS，前端 3D 机器人位置同步更新（延迟 < 200ms）
- [ ] heading 变化时机器人朝向正确（正北=0，顺时针）
- [ ] GPS 丢失（WS 断开）机器人标记 offline，轨迹停止增长

### 10.4 场景集成
- [ ] 暗色地图 + 3D 楼块 + 发光路线 = 科技感大屏
- [ ] HUD（电量/状态/坐标）锚定机器人头部
- [ ] 2D 总览 ↔ 单机器人 3D 下钻 切换流畅

---

## 十一、常见问题（FAQ）

| 问题 | 原因 | 解决 |
|------|------|------|
| 机器人在地图上偏移 300-500m | GPS(WGS-84) 未纠偏 | `adapter-gps.ts` 的 transform，或上报时 `coordsys=gps` |
| 路线穿越建筑 | 用了驾车而非步行 | 室外机器人用 `AMap.Walking` |
| 3D 场景黑屏 | `renderer.autoClear=true` 清掉了底图 | 设为 `false` + `resetState()` |
| 机器人在原点外抖动 | 浮点精度（远离 customCoords 中心）| 动态 `setCenter` 到机器人当前位置 |
| 地图不显示 | Key 错误 / securityJsCode 未配 / 未加载 JS API | 检查 console + network |
| 轨迹断断续续 | mock 间隔太长 / 未插值 | 100ms + 线性插值 |
| TypeScript 报 AMap 不存在 | 缺 `@amap/amap-jsapi-types` | 安装并在 tsconfig types 引入 |
| 配额超限 | 前端频繁搜索 | 批量采集走 Web 服务 Key，前端仅渲染 |

---

## 十二、安全与合规提醒

1. **API Key 安全**：`securityJsCode` 若暴露可被刷配额，建议：
   - 生产环境走**自有后端代理**（服务端用 Web 服务 Key）
   - 前端 Key 配**域名白名单**（高德控制台）
2. **用户位置隐私**：GPS 轨迹属敏感数据，需：
   - 明确告知用户并获授权
   - 传输加密（WSS/HTTPS）
   - 存储最小化，按租户隔离（RLS）
3. **数据合规**：《个人信息保护法》下，机器人轨迹可能构成"行踪轨迹"，需评估是否为个人信息
4. **高德使用条款**：禁止缓存/二次分发地图数据；超出免费配额需商业授权

---

## 附录 A：完整目录变更

```
robot-ops-solo/
├── apps/web-console/
│   ├── .env.local                    # 新增：高德 Key
│   ├── index.html                    # 修改：注入 securityJsCode + maps v=2.0
│   └── src/
│       ├── lib/
│       │   ├── amap.ts               # 新增：POI/geocode/regeocode 封装
│       │   └── route.ts              # 新增：步行/驾车路径规划
│       └── routes/
│           └── FleetMapPage.tsx      # 新增：室外总览页
├── packages/
│   ├── adapter-kit/src/
│   │   ├── adapters/
│   │   │   └── adapter-gps.ts        # 新增：WGS→GCJ 纠偏 + 映射
│   │   ├── types/unified.ts          # 修改：增加 mode / gps 字段
│   │   └── utils/smooth.ts           # 新增：低通滤波
│   └── digital-twin/src/
│       ├── map/
│       │   ├── mapCoords.ts          # 新增：lngLatToWorld 等
│       │   ├── MapRobotViewer.tsx    # 新增：GLCustomLayer 融合
│       │   └── Trajectory.tsx        # 新增：轨迹线
│       └── robots/G1Humanoid.tsx     # 修改：支持室外坐标
└── mock-ws-server.js                  # 修改：增加 /gps 模式 + 真实经纬度路线
```

## 附录 B：室外 vs 室内坐标对照

| 维度 | 室内 | 室外 |
|------|------|------|
| 坐标单位 | 米（相对原点）| 度（经纬度）|
| X 轴 | 东 | 经度 |
| Y 轴 | 北 | 纬度 |
| Z 轴 | 上 | 高度(alt) |
| 原点 | 自定义(0,0) | 动态=路线中心 |
| 来源 | CAD/SOP 人工标定 | GPS/路径规划/POI |
| 坐标系 | 右手系 | GCJ-02 |
| 转换 | 无 | `customCoords.lngLatsToCoords` |

## 附录 C：版本变更

- **v1.0**（2026）：初版，覆盖 Step 1-5 + POI/路径/GPS/GLCustomLayer/轨迹
- 后续计划：v1.1 室内外无缝切换、v1.2 多机 fleet、v1.3 飞线调度动画

---

> **一句话**：室外真实路线 = 高德 **PlaceSearch（取点）+ Walking（取路）+ GLCustomLayer（融合 3D）+ GPS 纠偏（准）+ 轨迹线（顺）**。五件事做完，你的 G1 就站在朝阳大悦城门口的真实经纬度上，沿真实人行道走向取餐点——从"实验室方块"变成"真实世界运维"。
