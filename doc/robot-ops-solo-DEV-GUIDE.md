# Robot-Ops-Solo 开发文档

> 单人前端 · 跨品牌机器人运维中台 · MVP 开发指南
> 文档版本：v1.0 | 更新日期：2026-03

---

## 一、项目定位（一句话）

做一块**不属于任何机器人厂商的 Web 控制台**，能同时管宇树/擎朗/普渡/智元等多品牌机器人，给 RaaS 合伙人、本地连锁餐饮、集成商提供"状态监控 + 任务编排 + 3D 可视化 + 告警推送"。

---

## 二、技术栈速查

| 层 | 选型 | 用途 |
|----|------|------|
| 前端框架 | React 18 + TypeScript | 全栈 UI |
| 构建 | Vite 5 | 开发服务器 + 打包 |
| 包管理 | pnpm workspace | monorepo |
| 状态 | Zustand + TanStack Query | 机器人快照 + 服务端缓存 |
| 实时通信 | WebSocket + mqtt.js | 接厂商协议 |
| 3D | React Three Fiber + drei | 数字孪生 |
| 画布 | @xyflow/react (React Flow) | SOP 编排 |
| BaaS | Supabase（可选） | 多租户/Auth/DB |
| 部署 | Vercel + Cloudflare | 零运维 |
| 样式 | CSS Variables + shadcn/ui | 贴牌换肤 |

---

## 三、目录结构（权威版）

```
robot-ops-solo/
├── package.json
├── pnpm-workspace.yaml
├── tsconfig.base.json
├── .gitignore
├── README.md
├── DEV-GUIDE.md                 # 本文档
├── mock-ws-server.js              # 假数据服务
│
├── packages/
│   ├── adapter-kit/               # 纯 TS，无框架依赖 ⭐核心复利
│   │   ├── package.json
│   │   └── src/
│   │       ├── index.ts
│   │       ├── types/unified.ts
│   │       ├── adapters/
│   │       │   ├── adapter-unitree.ts
│   │       │   ├── adapter-keenon.ts
│   │       │   ├── adapter-agibot.ts
│   │       │   ├── adapter-pudutech.ts
│   │       │   └── index.ts
│   │       └── protocol/
│   │           ├── ws-client.ts
│   │           └── mqtt-client.ts
│   │
│   ├── sop-editor/                # React Flow 画布
│   │   ├── package.json
│   │   └── src/
│   │       ├── index.ts
│   │       ├── SopEditor.tsx
│   │       ├── schema/sop-schema.ts
│   │       ├── hooks/useSopStore.ts
│   │       ├── nodes/
│   │       │   ├── MoveNode.tsx
│   │       │   ├── SpeakNode.tsx
│   │       │   ├── WaitNode.tsx
│   │       │   ├── LoopNode.tsx
│   │       │   └── ConditionNode.tsx
│   │       └── sidebar/NodePalette.tsx
│   │
│   ├── digital-twin/              # R3F 3D 孪生
│   │   ├── package.json
│   │   └── src/
│   │       ├── index.ts
│   │       ├── RobotViewer.tsx
│   │       ├── robots/G1Dog.tsx
│   │       ├── robots/PeanutBot.tsx
│   │       ├── environment/Floor.tsx
│   │       ├── environment/SlamMap.tsx
│   │       └── overlays/StatusBadge.tsx
│   │
│   └── ui-kit/                    # 共用组件
│       ├── package.json
│       └── src/
│           ├── RobotStatusCard.tsx
│           ├── BatteryGauge.tsx
│           ├── AlertItem.tsx
│           ├── TenantLogo.tsx
│           └── ThemeProvider.tsx
│
└── apps/
    └── web-console/               # 主应用（贴牌后台）
        ├── package.json
        ├── vite.config.ts
        ├── index.html
        ├── .env.example
        └── src/
            ├── main.tsx
            ├── App.tsx
            ├── vite-env.d.ts
            ├── stores/
            │   ├── robotStore.ts
            │   └── tenantStore.ts
            ├── lib/
            │   ├── supabase.ts
            │   └── wsHub.ts
            ├── routes/
            │   ├── Dashboard.tsx
            │   ├── RobotsPage.tsx
            │   ├── SopPage.tsx
            │   ├── TwinPage.tsx
            │   ├── AlertsPage.tsx
            │   └── TenantsPage.tsx
            ├── components/
            │   └── layout/
            │       ├── Sidebar.tsx
            │       └── TenantBranding.tsx
            └── styles/globals.css
```

---

## 四、核心数据模型

> 文件：`packages/adapter-kit/src/types/unified.ts`

```ts
// 所有品牌统一成这个结构，页面只认这个
export interface UnifiedRobotState {
  robotId: string
  brand: string
  model: string
  batteryPct: number
  voltage: number
  online: boolean
  position: { x: number; y: number; theta: number }
  joints?: Record<string, number>
  status: 'idle' | 'moving' | 'working' | 'error' | 'charging'
  errorCode?: string
  lastSeen: number
}

export interface UnifiedAlert {
  robotId: string
  level: 'info' | 'warn' | 'error'
  code: string
  message: string
  timestamp: number
}

export interface TenantConfig {
  slug: string
  name: string
  logoUrl: string
  primaryColor: string
  brand: string
}
```

### 数据流总览

```
厂商机器人
   │
   ▼ (WebSocket / MQTT)
adapter-kit (纯TS转换层)
   │
   ▼ (统一 UnifiedRobotState)
Zustand robotStore
   │
   ├──▶ Dashboard / RobotsPage (卡片列表)
   ├──▶ TwinPage (R3F 3D 场景)
   ├──▶ AlertsPage (告警流)
   └──▶ SopPage (任务编排下发)
```

---

## 五、Adapter 编写规范

> 每个新品牌 = 1 个文件 + 1 个测试。adapters 禁止 import React。

### 模板

```ts
// packages/adapter-kit/src/adapters/adapter-xxx.ts
import type { UnifiedRobotState, UnifiedAlert } from '../types/unified'

interface XxxRawMsg {
  // 厂商原始 WS/MQTT 消息结构
  battery?: number
  voltage?: number
  x?: number
  y?: number
  yaw?: number
}

export function adaptXxx(raw: XxxRawMsg, robotId: string): UnifiedRobotState {
  return {
    robotId,
    brand: 'xxx',
    model: 'xxx-model',
    batteryPct: raw.battery ?? 0,
    voltage: raw.voltage ?? 0,
    online: true,
    position: { x: raw.x ?? 0, y: raw.y ?? 0, theta: raw.yaw ?? 0 },
    status: raw.battery != null && raw.battery < 10 ? 'error' : 'idle',
    lastSeen: Date.now(),
  }
}

// 可选：告警映射
export function adaptXxxAlert(raw: any, robotId: string): UnifiedAlert | null {
  if (!raw.error) return null
  return {
    robotId,
    level: raw.error.code?.startsWith('E') ? 'error' : 'warn',
    code: raw.error.code ?? 'UNKNOWN',
    message: raw.error.msg ?? 'Unknown error',
    timestamp: Date.now(),
  }
}
```

### 注册到工厂

```ts
// packages/adapter-kit/src/adapters/index.ts
import { adaptUnitree } from './adapter-unitree'
import { adaptKeenon } from './adapter-keenon'
import { adaptAgibot } from './adapter-agibot'
import { adaptPudutech } from './adapter-pudutech'
import type { UnifiedRobotState } from '../types/unified'

type AdapterFn = (raw: any, robotId: string) => UnifiedRobotState

const adapters: Record<string, AdapterFn> = {
  unitree: adaptUnitree,
  keenon: adaptKeenon,
  agibot: adaptAgibot,
  pudutech: adaptPudutech,
}

export function createAdapter(brand: string): AdapterFn {
  const fn = adapters[brand]
  if (!fn) throw new Error(`Unsupported brand: ${brand}`)
  return fn
}

export function adaptState(brand: string, raw: any, robotId: string): UnifiedRobotState {
  return createAdapter(brand)(raw, robotId)
}
```

### 通用 WS 客户端

```ts
// packages/adapter-kit/src/protocol/ws-client.ts
export interface WsOptions {
  url: string
  onMessage: (data: any) => void
  onOpen?: () => void
  onClose?: () => void
  reconnectInterval?: number  // 默认 3000ms
}

export class RobotWSClient {
  private ws: WebSocket | null = null
  private reconnectTimer?: number
  private closed = false

  constructor(private opts: WsOptions) {}

  connect() {
    this.closed = false
    this.ws = new WebSocket(this.opts.url)
    this.ws.onmessage = (e) => {
      try { this.opts.onMessage(JSON.parse(e.data)) }
      catch { /* ignore malformed */ }
    }
    this.ws.onopen = () => this.opts.onOpen?.()
    this.ws.onclose = () => {
      this.opts.onClose?.()
      if (!this.closed) this.scheduleReconnect()
    }
  }

  private scheduleReconnect() {
    const delay = this.opts.reconnectInterval ?? 3000
    this.reconnectTimer = window.setTimeout(() => this.connect(), delay)
  }

  send(topic: string, payload: any) {
    this.ws?.send(JSON.stringify({ topic, data: payload }))
  }

  close() {
    this.closed = true
    this.ws?.close()
  }
}
```

### 通用 MQTT 客户端

```ts
// packages/adapter-kit/src/protocol/mqtt-client.ts
import mqtt from 'mqtt'

export interface MqttOptions {
  brokerUrl: string
  topic: string
  onMessage: (topic: string, payload: any) => void
  username?: string
  password?: string
}

export class RobotMqttClient {
  private client: mqtt.MqttClient | null = null

  constructor(private opts: MqttOptions) {}

  connect() {
    this.client = mqtt.connect(this.opts.brokerUrl, {
      username: this.opts.username,
      password: this.opts.password,
      reconnectPeriod: 3000,
    })
    this.client.on('connect', () => {
      this.client!.subscribe(this.opts.topic)
    })
    this.client.on('message', (topic, buffer) => {
      try { this.opts.onMessage(topic, JSON.parse(buffer.toString())) }
      catch { /* ignore */ }
    })
  }

  publish(topic: string, payload: any) {
    this.client?.publish(topic, JSON.stringify(payload))
  }

  close() {
    this.client?.end()
  }
}
```

---

## 六、SOP 编辑器数据契约

> 文件：`packages/sop-editor/src/schema/sop-schema.ts`

```ts
export type SopNodeType = 'move' | 'speak' | 'wait' | 'loop' | 'condition'

export interface SopNode {
  id: string
  type: SopNodeType
  position: { x: number; y: number }
  data: MoveData | SpeakData | WaitData | LoopData | ConditionData
}

export interface MoveData { x: number; y: number; speed?: number; waypoints?: {x:number;y:number}[] }
export interface SpeakData { text: string; volume?: number; lang?: 'zh'|'en' }
export interface WaitData { seconds: number }
export interface LoopData { count: number; breakCondition?: string }
export interface ConditionData { field: string; operator: 'eq'|'gt'|'lt'; value: any; trueNodeId?: string; falseNodeId?: string }

export interface SopEdge {
  id: string
  source: string
  target: string
  label?: string
}

export interface SopGraph {
  id: string
  name: string
  industry: 'hotpot' | 'pharmacy' | 'mall' | 'factory' | 'other'
  brand: string
  model: string
  nodes: SopNode[]
  edges: SopEdge[]
  createdAt: number
  updatedAt: number
}

// 导出为机器人可执行格式（线性指令序列）
export function graphToPayload(graph: SopGraph) {
  return graph.nodes.map(node => ({
    action: node.type,
    params: node.data,
    next: graph.edges.find(e => e.source === node.id)?.target ?? null
  }))
}
```

### SOP 画布主组件

```tsx
// packages/sop-editor/src/SopEditor.tsx
import { ReactFlow, Background, Controls, MiniMap, applyNodeChanges, applyEdgeChanges, addEdge, NodeChange, EdgeChange, Connection } from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { useCallback, useState } from 'react'
import { MoveNode } from './nodes/MoveNode'
import { SpeakNode } from './nodes/SpeakNode'
import { WaitNode } from './nodes/WaitNode'
import { LoopNode } from './nodes/LoopNode'
import { ConditionNode } from './nodes/ConditionNode'
import { NodePalette } from './sidebar/NodePalette'
import { useSopStore } from './hooks/useSopStore'

const nodeTypes = {
  move: MoveNode,
  speak: SpeakNode,
  wait: WaitNode,
  loop: LoopNode,
  condition: ConditionNode,
}

export function SopEditor() {
  const { nodes, edges, setNodes, setEdges } = useSopStore()
  const [selectedNode, setSelectedNode] = useState<string | null>(null)

  const onNodesChange = useCallback(
    (changes: NodeChange[]) => setNodes(applyNodeChanges(changes, nodes)),
    [nodes, setNodes]
  )
  const onEdgesChange = useCallback(
    (changes: EdgeChange[]) => setEdges(applyEdgeChanges(changes, edges)),
    [edges, setEdges]
  )
  const onConnect = useCallback(
    (conn: Connection) => setEdges(eds => addEdge({ ...conn, id: crypto.randomUUID() }, eds)),
    [setEdges]
  )

  return (
    <div style={{ display: 'flex', width: '100%', height: '100%' }}>
      <NodePalette />
      <div style={{ flex: 1 }}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onNodeClick={(_, n) => setSelectedNode(n.id)}
          nodeTypes={nodeTypes}
          fitView
        >
          <Background />
          <Controls />
          <MiniMap />
        </ReactFlow>
      </div>
    </div>
  )
}
```

### 节点示例（MoveNode）

```tsx
// packages/sop-editor/src/nodes/MoveNode.tsx
import { Handle, Position, NodeProps } from '@xyflow/react'
import type { MoveData } from '../schema/sop-schema'

export function MoveNode({ data, selected }: NodeProps) {
  const d = data as MoveData
  return (
    <div style={{
      padding: 10, border: `2px solid ${selected ? '#3b82f6' : '#6366f1'}`,
      borderRadius: 8, background: '#eef2ff', minWidth: 120
    }}>
      <div style={{ fontWeight: 600, fontSize: 12 }}>📍 移动</div>
      <div style={{ fontSize: 11, color: '#555', marginTop: 4 }}>
        x: {d.x}, y: {d.y}
      </div>
      <div style={{ fontSize: 11, color: '#555' }}>
        速度: {d.speed ?? 1.0}m/s
      </div>
      <Handle type="target" position={Position.Left} />
      <Handle type="source" position={Position.Right} />
    </div>
  )
}
```

### Zustand 画布状态

```ts
// packages/sop-editor/src/hooks/useSopStore.ts
import { create } from 'zustand'
import type { Node, Edge } from '@xyflow/react'
import type { SopNode, SopEdge } from '../schema/sop-schema'

interface SopStore {
  nodes: Node[]
  edges: Edge[]
  setNodes: (n: Node[]) => void
  setEdges: (e: Edge[]) => void
  loadGraph: (graph: { nodes: SopNode[]; edges: SopEdge[] }) => void
  exportGraph: () => { nodes: SopNode[]; edges: SopEdge[] }
}

export const useSopStore = create<SopStore>((set, get) => ({
  nodes: [],
  edges: [],
  setNodes: (nodes) => set({ nodes }),
  setEdges: (edges) => set({ edges }),
  loadGraph: (graph) => set({
    nodes: graph.nodes as unknown as Node[],
    edges: graph.edges as unknown as Edge[]
  }),
  exportGraph: () => {
    const { nodes, edges } = get()
    return {
      nodes: nodes as unknown as SopNode[],
      edges: edges as unknown as SopEdge[]
    }
  }
}))
```

---

## 七、数字孪生数据流

```
WS/MQTT → wsHub.ts → Zustand robotStore → useRobotState(robotId) → R3F <RobotViewer />
```

**规则**：`digital-twin` 包**不直接连 WS**，只从 Zustand 读。

### 主场景

```tsx
// packages/digital-twin/src/RobotViewer.tsx
import { Canvas } from '@react-three/fiber'
import { OrbitControls, useGLTF } from '@react-three/drei'
import { G1Dog } from './robots/G1Dog'
import { PeanutBot } from './robots/PeanutBot'
import { Floor } from './environment/Floor'
import { SlamMap } from './environment/SlamMap'
import { TrajectoryLine } from './overlays/TrajectoryLine'
import { StatusBadge } from './overlays/StatusBadge'
import { useRobotState } from './hooks/useRobotState'

interface Props {
  robotId: string
  brand?: 'unitree' | 'keenon' | 'agibot' | 'pudutech'
}

export function RobotViewer({ robotId, brand = 'unitree' }: Props) {
  const state = useRobotState(robotId)

  return (
    <Canvas camera={{ position: [3, 3, 3], fov: 50 }}>
      <ambientLight intensity={0.5} />
      <directionalLight position={[5, 5, 5]} />
      <Floor />
      <SlamMap />
      {state && (
        <>
          {brand === 'unitree' && (
            <G1Dog
              position={[state.position.x, 0, state.position.y]}
              rotation={[0, state.position.theta, 0]}
              joints={state.joints}
            />
          )}
          {brand === 'keenon' && (
            <PeanutBot
              position={[state.position.x, 0, state.position.y]}
              rotation={[0, state.position.theta, 0]}
            />
          )}
          <TrajectoryLine robotId={robotId} />
          <StatusBadge position={[state.position.x, 1.5, state.position.y]} state={state} />
        </>
      )}
      <OrbitControls />
    </Canvas>
  )
}
```

### 宇树 G1 模型

```tsx
// packages/digital-twin/src/robots/G1Dog.tsx
import { useGLTF } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { useRef, useEffect } from 'react'
import * as THREE from 'three'

interface Props {
  position: [number, number, number]
  rotation: [number, number, number]
  joints?: Record<string, number>
}

export function G1Dog({ position, rotation, joints }: Props) {
  const ref = useRef<THREE.Group>(null!)

  // 尝试加载 GLB，失败则用占位几何体
  let scene: THREE.Object3D | null = null
  try {
    const gltf = useGLTF('/models/g1_dog.glb')
    scene = gltf.scene
  } catch {
    scene = null
  }

  useFrame(() => {
    if (!ref.current) return
    ref.current.rotation.y = rotation[1]
    // 用 joints 数据驱动骨骼（后续按真实骨骼名映射）
    if (joints && ref.current.children.length > 0) {
      // placeholder: 后续映射 hip/knee 等
    }
  })

  // 无模型时降级为蓝色方块狗
  if (!scene) {
    return (
      <group ref={ref} position={position}>
        <mesh>
          <boxGeometry args={[0.4, 0.3, 0.6]} />
          <meshStandardMaterial color="#3b82f6" />
        </mesh>
        <mesh position={[0, 0.25, 0]}>
          <boxGeometry args={[0.2, 0.15, 0.2]} />
          <meshStandardMaterial color="#1e40af" />
        </mesh>
      </group>
    )
  }

  return (
    <primitive
      ref={ref}
      object={scene}
      position={position}
      rotation={rotation}
      scale={0.5}
    />
  )
}
```

### 状态订阅 Hook

```ts
// packages/digital-twin/src/hooks/useRobotState.ts
import { useRobotStore } from '../../../web-console/src/stores/robotStore'
import type { UnifiedRobotState } from 'robot-adapter-kit'

export function useRobotState(robotId: string): UnifiedRobotState | undefined {
  return useRobotStore(s => s.robots[robotId])
}
```

### 轨迹线

```tsx
// packages/digital-twin/src/overlays/TrajectoryLine.tsx
import { useRef } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { useRobotState } from '../hooks/useRobotState'

const MAX_POINTS = 200

export function TrajectoryLine({ robotId }: { robotId: string }) {
  const state = useRobotState(robotId)
  const ref = useRef<THREE.Line>(null!)
  const points = useRef<THREE.Vector3[]>([])

  useFrame(() => {
    if (!state || !ref.current) return
    const p = new THREE.Vector3(state.position.x, 0.05, state.position.y)
    points.current.push(p)
    if (points.current.length > MAX_POINTS) points.current.shift()
    const geom = ref.current.geometry as THREE.BufferGeometry
    const positions = new Float32Array(points.current.length * 3)
    points.current.forEach((v, i) => {
      positions[i * 3] = v.x
      positions[i * 3 + 1] = v.y
      positions[i * 3 + 2] = v.z
    })
    geom.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    geom.computeBoundingSphere()
  })

  return (
    <line ref={ref}>
      <bufferGeometry />
      <lineBasicMaterial color="#f97316" linewidth={2} />
    </line>
  )
}
```

---

## 八、贴牌换肤机制

### CSS 变量定义

```css
/* apps/web-console/src/styles/globals.css */
:root {
  --primary-color: #3b82f6;
  --primary-dark: #1e40af;
  --tenant-name: 'RobotOps';
  --tenant-logo: '/default-logo.svg';
  --bg-color: #0f172a;
  --card-bg: #1e293b;
  --text-color: #e2e8f0;
  --text-muted: #94a3b8;
  --success: #22c55e;
  --warning: #f59e0b;
  --danger: #ef4444;
  --border-radius: 8px;
  --sidebar-width: 240px;
}

[data-tenant="laowang"] {
  --primary-color: #f97316;
  --primary-dark: #c2410c;
  --tenant-name: '老王机器人';
  --tenant-logo: '/tenants/laowang/logo.svg';
}

[data-tenant="hotpot01"] {
  --primary-color: #dc2626;
  --primary-dark: #991b1b;
  --tenant-name: '蜀大侠';
  --tenant-logo: '/tenants/hotpot01/logo.svg';
}

[data-tenant="pharmacy01"] {
  --primary-color: #10b981;
  --primary-dark: #047857;
  --tenant-name: '智慧药房';
  --tenant-logo: '/tenants/pharmacy01/logo.svg';
}

* { margin: 0; padding: 0; box-sizing: border-box; }
body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: var(--bg-color); color: var(--text-color); }
```

### TenantBranding 组件

```tsx
// apps/web-console/src/components/layout/TenantBranding.tsx
import { useEffect, ReactNode } from 'react'
import { useTenantStore } from '../../stores/tenantStore'

interface Props { children: ReactNode }

export function TenantBranding({ children }: Props) {
  const { tenant, loadTenant } = useTenantStore()

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const slug = params.get('tenant') ?? 'default'
    loadTenant(slug)
  }, [loadTenant])

  useEffect(() => {
    if (tenant) {
      document.documentElement.dataset.tenant = tenant.slug
      document.title = `${tenant.name} · 运维中心`
    }
  }, [tenant])

  return <>{children}</>
}
```

### Tenant Store

```ts
// apps/web-console/src/stores/tenantStore.ts
import { create } from 'zustand'
import type { TenantConfig } from 'robot-adapter-kit'

interface TenantStore {
  tenant: TenantConfig | null
  loadTenant: (slug: string) => void
}

// 内置租户配置（后续可迁 Supabase）
const builtinTenants: Record<string, TenantConfig> = {
  default: { slug: 'default', name: 'RobotOps', logoUrl: '/default-logo.svg', primaryColor: '#3b82f6', brand: 'RobotOps' },
  laowang: { slug: 'laowang', name: '老王机器人', logoUrl: '/tenants/laowang/logo.svg', primaryColor: '#f97316', brand: '老王机器人' },
  hotpot01: { slug: 'hotpot01', name: '蜀大侠', logoUrl: '/tenants/hotpot01/logo.svg', primaryColor: '#dc2626', brand: '蜀大侠' },
}

export const useTenantStore = create<TenantStore>((set) => ({
  tenant: builtinTenants.default,
  loadTenant: (slug) => {
    const t = builtinTenants[slug] ?? builtinTenants.default
    set({ tenant: t })
  }
}))
```

---

## 九、Supabase 表结构（可选）

> 不填 env 走纯前端 mock，日后接入只需补 `lib/supabase.ts` 查询。

```sql
-- robots 表
create table robots (
  id uuid primary key default gen_random_uuid(),
  robot_id text unique not null,
  brand text not null,
  model text not null,
  tenant_slug text not null,
  name text,
  created_at timestamp default now()
);

-- sop_templates 表
create table sop_templates (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  industry text not null,
  brand text not null,
  model text not null,
  graph jsonb not null,
  tenant_slug text not null,
  created_at timestamp default now(),
  updated_at timestamp default now()
);

-- alerts 表
create table alerts (
  id uuid primary key default gen_random_uuid(),
  robot_id text not null,
  level text not null,
  code text not null,
  message text not null,
  tenant_slug text not null,
  resolved boolean default false,
  created_at timestamp default now()
);

-- tenants 表
create table tenants (
  slug text primary key,
  name text not null,
  logo_url text,
  primary_color text default '#3b82f6',
  created_at timestamp default now()
);

-- RLS 行级安全
alter table robots enable row level security;
alter table sop_templates enable row level security;
alter table alerts enable row level security;

create policy "tenant_isolation_robots" on robots
  using (tenant_slug = current_setting('request.jwt.claims')::json->>'tenant_slug');

create policy "tenant_isolation_sop" on sop_templates
  using (tenant_slug = current_setting('request.jwt.claims')::json->>'tenant_slug');

create policy "tenant_isolation_alerts" on alerts
  using (tenant_slug = current_setting('request.jwt.claims')::json->>'tenant_slug');
```

### Supabase 客户端

```ts
// apps/web-console/src/lib/supabase.ts
import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabase = url && anonKey
  ? createClient(url, anonKey)
  : null  // null = 走 mock 模式

// 辅助：判断是否启用后端
export const isBackendEnabled = !!supabase
```

---

## 十、WS Hub（消息分发中心）

```ts
// apps/web-console/src/lib/wsHub.ts
import { RobotWSClient } from 'robot-adapter-kit'
import { adaptState } from 'robot-adapter-kit'
import { useRobotStore } from '../stores/robotStore'

interface WsConnection {
  brand: string
  url: string
  robotId: string
}

const clients: RobotWSClient[] = []

export function startWS(connections: WsConnection[]) {
  connections.forEach(({ brand, url, robotId }) => {
    const client = new RobotWSClient({
      url,
      onMessage: (raw) => {
        try {
          const state = adaptState(brand, raw, robotId)
          useRobotStore.getState().updateRobot(robotId, state)
        } catch (err) {
          console.warn(`[wsHub] adapt failed for ${brand}:`, err)
        }
      },
      onOpen: () => console.log(`[wsHub] connected: ${brand} ${robotId}`),
      onClose: () => console.log(`[wsHub] disconnected: ${brand} ${robotId}`),
    })
    client.connect()
    clients.push(client)
  })
}

export function stopAllWS() {
  clients.forEach(c => c.close())
  clients.length = 0
}
```

---

## 十一、Robot Store（全局状态池）

```ts
// apps/web-console/src/stores/robotStore.ts
import { create } from 'zustand'
import type { UnifiedRobotState, UnifiedAlert } from 'robot-adapter-kit'

interface RobotStore {
  robots: Record<string, UnifiedRobotState>
  alerts: UnifiedAlert[]
  updateRobot: (id: string, state: UnifiedRobotState) => void
  addAlert: (alert: UnifiedAlert) => void
  clearAlerts: (robotId?: string) => void
  getOnlineCount: () => number
  getErrorCount: () => number
}

export const useRobotStore = create<RobotStore>((set, get) => ({
  robots: {},
  alerts: [],
  updateRobot: (id, state) =>
    set((s) => ({ robots: { ...s.robots, [id]: state } })),
  addAlert: (alert) =>
    set((s) => ({ alerts: [alert, ...s.alerts].slice(0, 100) })),
  clearAlerts: (robotId) =>
    set((s) => ({
      alerts: robotId
        ? s.alerts.filter(a => a.robotId !== robotId)
        : []
    })),
  getOnlineCount: () => {
    const robots = Object.values(get().robots)
    return robots.filter(r => r.online).length
  },
  getErrorCount: () => {
    const robots = Object.values(get().robots)
    return robots.filter(r => r.status === 'error').length
  },
}))
```

---

## 十二、页面路由与功能对照

| 路由 | 页面 | 功能 | 关键组件 |
|------|------|------|----------|
| `/` | Dashboard | 机器人卡片网格 + 在线/离线统计 + 告警摘要 | RobotStatusCard, BatteryGauge |
| `/robots` | RobotsPage | 列表视图 + 筛选品牌/状态 | RobotStatusCard |
| `/robots/:id` | TwinPage | 3D 数字孪生 + 实时状态 + 轨迹 | RobotViewer |
| `/sop` | SopPage | SOP 编排画布 + 模板管理 | SopEditor |
| `/alerts` | AlertsPage | 告警流 + 确认/忽略 | AlertItem |
| `/tenants` | TenantsPage | 租户管理（贴牌配置） | TenantLogo |

### App.tsx 完整版

```tsx
// apps/web-console/src/App.tsx
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useEffect } from 'react'
import { TenantBranding } from './components/layout/TenantBranding'
import { Sidebar } from './components/layout/Sidebar'
import { Dashboard } from './routes/Dashboard'
import { RobotsPage } from './routes/RobotsPage'
import { TwinPage } from './routes/TwinPage'
import { SopPage } from './routes/SopPage'
import { AlertsPage } from './routes/AlertsPage'
import { TenantsPage } from './routes/TenantsPage'
import { startWS } from './lib/wsHub'
import { useTenantStore } from './stores/tenantStore'

export default function App() {
  const tenant = useTenantStore(s => s.tenant)

  useEffect(() => {
    // 开发模式：连 mock WS
    if (import.meta.env.DEV) {
      startWS([
        { brand: 'unitree', url: 'ws://localhost:8080', robotId: 'g1-001' },
        { brand: 'keenon', url: 'ws://localhost:8081', robotId: 'peanut-001' },
      ])
    }
    return () => { /* stopAllWS() */ }
  }, [])

  return (
    <TenantBranding>
      <div style={{ display: 'flex', minHeight: '100vh' }}>
        <Sidebar />
        <main style={{ flex: 1, padding: 24, overflow: 'auto' }}>
          <BrowserRouter>
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/robots" element={<RobotsPage />} />
              <Route path="/robots/:id" element={<TwinPage />} />
              <Route path="/sop" element={<SopPage />} />
              <Route path="/alerts" element={<AlertsPage />} />
              <Route path="/tenants" element={<TenantsPage />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </BrowserRouter>
        </main>
      </div>
    </TenantBranding>
  )
}
```

---

## 十三、Mock WS Server（完整版）

```js
// mock-ws-server.js
import { WebSocketServer } from 'ws'

// 宇树 G1 模拟：固定矩形路径 + 电量递减 + SOP 触发
const wssUnitree = new WebSocketServer({ port: 8080 })
let g1Battery = 85
let g1Angle = 0
const g1Path = [
  { x: 0, y: 0 }, { x: 3, y: 0 }, { x: 3, y: 2 }, { x: 0, y: 2 }
]

wssUnitree.on('connection', (ws) => {
  console.log('[mock] G1 connected')
  const interval = setInterval(() => {
    // 沿矩形路径移动
    g1Angle += 0.02
    const idx = Math.floor(g1Angle) % 4
    const nextIdx = (idx + 1) % 4
    const t = g1Angle - Math.floor(g1Angle)
    const x = g1Path[idx].x + (g1Path[nextIdx].x - g1Path[idx].x) * t
    const y = g1Path[idx].y + (g1Path[nextIdx].y - g1Path[idx].y) * t
    const yaw = Math.atan2(g1Path[nextIdx].y - g1Path[idx].y, g1Path[nextIdx].x - g1Path[idx].x)

    // 电量递减
    g1Battery = Math.max(0, g1Battery - 0.05)

    const msg = {
      topic: '/state',
      data: {
        percentage: Math.round(g1Battery),
        voltage: 54.2 - (85 - g1Battery) * 0.1,
        position: { x: Math.round(x * 100) / 100, y: Math.round(y * 100) / 100, yaw },
        joints: {
          hip_l: Math.sin(g1Angle * 4) * 0.3,
          hip_r: Math.sin(g1Angle * 4 + Math.PI) * 0.3,
          knee_l: Math.abs(Math.sin(g1Angle * 4)) * 0.5,
          knee_r: Math.abs(Math.sin(g1Angle * 4 + Math.PI)) * 0.5,
        }
      }
    }
    ws.send(JSON.stringify(msg))

    // 告警
    if (g1Battery === 20) {
      ws.send(JSON.stringify({ topic: '/alert', data: { code: 'W_BATTERY_LOW', msg: '电量低于20%，建议回充' } }))
    }
    if (g1Battery === 10) {
      ws.send(JSON.stringify({ topic: '/alert', data: { code: 'E_BATTERY_CRITICAL', msg: '电量极低，已停止运动' } }))
    }
    // SOP 触发：到 B 点播报
    if (idx === 1 && t < 0.05) {
      ws.send(JSON.stringify({ topic: '/speak', data: { text: '小心烫手～' } }))
    }
  }, 100)

  ws.on('close', () => { clearInterval(interval); console.log('[mock] G1 disconnected') })
})

// 擎朗 Peanut 模拟（简化）
const wssKeenon = new WebSocketServer({ port: 8081 })
let peanutBattery = 92
let peanutX = 1

wssKeenon.on('connection', (ws) => {
  console.log('[mock] Peanut connected')
  const interval = setInterval(() => {
    peanutX += 0.01
    if (peanutX > 5) peanutX = 0
    peanutBattery = Math.max(0, peanutBattery - 0.03)

    const msg = {
      cmd: 'state',
      payload: {
        level: Math.round(peanutBattery),
        v: 36.2 - (92 - peanutBattery) * 0.05,
        x: Math.round(peanutX * 100) / 100,
        y: 1.5,
        yaw: 0
      }
    }
    ws.send(JSON.stringify(msg))
  }, 150)

  ws.on('close', () => { clearInterval(interval); console.log('[mock] Peanut disconnected') })
})

console.log('[mock] WS servers running:')
console.log('  G1     → ws://localhost:8080')
console.log('  Peanut → ws://localhost:8081')
```

---

## 十四、启动命令

```bash
# 安装依赖
pnpm install

# 启动假数据 WS（终端 1）
node mock-ws-server.js

# 启动前端（终端 2）
pnpm --filter web-console dev

# 构建生产版
pnpm --filter web-console build

# 运行 adapter 单元测试
pnpm --filter adapter-kit test

# 预览生产构建
pnpm --filter web-console preview
```

打开 **http://localhost:5173** → 看到仪表盘、机器人卡片、3D 狗走矩形、电量掉、告警弹。

贴牌切换：访问 **http://localhost:5173?tenant=laowang** → 主题变橙色。

---

## 十五、开发阶段路线图

### Phase 1：跑通链路 ✅
- [x] monorepo 建起来
- [x] mock WS 推数据
- [x] adapter 转统一模型
- [x] Zustand 接状态
- [x] Dashboard 显示卡片
- [x] R3F 3D 狗能动
- [x] React Flow 画布能拖节点

### Phase 2：让假数据"像真的"（当前 👇）
- [ ] mock 固定路径循环（已完成，见上方代码）
- [ ] 电量递减 + 阈值告警（已完成）
- [ ] SOP 触发模拟（已完成）
- [ ] 做一份真实场景 SOP 模板 JSON（火锅店晚市）

### Phase 3：接真协议
- [ ] 找一家厂商公开 API/协议文档
- [ ] 补全对应 adapter 真实字段映射
- [ ] 用真机或社区模拟器测试
- [ ] 接第二家品牌

### Phase 4：见客户
- [ ] 找附近 3 家连锁餐饮（有机器人的）
- [ ] 免费给 1 家配一次
- [ ] 拿到反馈，迭代 SOP 模板
- [ ] 收第一个订阅（99 元/月）

### Phase 5：滚壁垒
- [ ] 接第 3、4 家品牌 adapter
- [ ] SOP 模板市场（按行业×品牌×机型打标）
- [ ] 企微/钉钉告警推送
- [ ] 多租户贴牌上线

---

## 十六、单人开发铁律

| # | 规则 | 原因 |
|---|------|------|
| 1 | adapter 永远纯 TS，不 import React | 未来可复用到 Node/Electron/CLI |
| 2 | 3D 组件只从 Zustand 读，不直连 WS | 页面刷新不断流、多组件共享 |
| 3 | 每服务一个客户，强制回流 3 样：adapter 补全 + SOP 模板入库 + 组件抽象 | 复利积累 |
| 4 | 不做后端重框架（Nest/Spring/K8s） | 单人维护不了，Supabase 够用 3 年 |
| 5 | 不碰控制算法、不写固件 | 那是别人的护城河，不是你的 |
| 6 | 每周至少跑 1 家实体店 | 代码写不出需求，老板一句话顶 10 篇报告 |
| 7 | 所有机器人交互走 SOP 模板，不硬编码 | 模板可复用 = 边际成本趋零 |

---

## 十七、常见问题

**Q：没有机器人怎么测试？**
A：mock-ws-server.js 就是干这个的。后续可搜 GitHub `ros2-web-bridge-docker` 跑本地 ROS2 容器模拟。

**Q：Supabase 免费额度够吗？**
A：个人起步完全够。500MB 数据库、50k 月活用户、1GB 文件存储，不收费。

**Q：模型 GLB 哪里搞？**
A：Sketchfab 搜 "Unitree G1" / "robot dog" 下免费 low-poly 版。先用占位几何体也行（代码已处理降级）。

**Q：客户担心数据安全怎么办？**
A：强调"数据不经过我服务器"——Vercel 只是前端托管，WS 直连厂商设备，Supabase 开 RLS 行级隔离。

**Q：以后想加移动端？**
A：React 代码不变，加 Capacitor 或 PWA 壳即可，3 天搞定。

**Q：adapter 测试怎么写？**
A：用 Vitest + 录制的真机报文 JSON 回放，断言输出符合 UnifiedRobotState。

```ts
// packages/adapter-kit/__tests__/adapter-unitree.test.ts
import { describe, it, expect } from 'vitest'
import { adaptUnitree } from '../src/adapters/adapter-unitree'

describe('adaptUnitree', () => {
  it('converts battery percentage correctly', () => {
    const raw = { topic: '/battery', data: { percentage: 75, voltage: 54.0, position: { x: 1, y: 2, yaw: 0.5 } } }
    const state = adaptUnitree(raw, 'g1-001')
    expect(state.batteryPct).toBe(75)
    expect(state.voltage).toBe(54.0)
    expect(state.position.x).toBe(1)
    expect(state.online).toBe(true)
  })

  it('sets error status when battery < 10', () => {
    const raw = { topic: '/battery', data: { percentage: 5, voltage: 48.0, position: { x: 0, y: 0, yaw: 0 } } }
    const state = adaptUnitree(raw, 'g1-001')
    expect(state.status).toBe('error')
  })
})
```

---

## 十八、火锅店晚市 SOP 模板样例

```json
{
  "id": "sop-hotpot-dinner-001",
  "name": "火锅店晚市传菜流程",
  "industry": "hotpot",
  "brand": "keenon",
  "model": "peanut",
  "nodes": [
    { "id": "n1", "type": "move", "position": { "x": 100, "y": 200 }, "data": { "x": 0, "y": 0, "speed": 0.8, "waypoints": [{ "x": 0, "y": 0 }, { "x": 3, "y": 0 }] } },
    { "id": "n2", "type": "wait", "position": { "x": 300, "y": 200 }, "data": { "seconds": 5 } },
    { "id": "n3", "type": "speak", "position": { "x": 500, "y": 100 }, "data": { "text": "您的菜品到了，小心烫手～", "volume": 0.8 } },
    { "id": "n4", "type": "move", "position": { "x": 500, "y": 300 }, "data": { "x": 3, "y": 2, "speed": 0.8 } },
    { "id": "n5", "type": "speak", "position": { "x": 700, "y": 300 }, "data": { "text": "请慢用！", "volume": 0.8 } },
    { "id": "n6", "type": "loop", "position": { "x": 700, "y": 500 }, "data": { "count": 20 } }
  ],
  "edges": [
    { "id": "e1", "source": "n1", "target": "n2" },
    { "id": "e2", "source": "n2", "target": "n3" },
    { "id": "e3", "source": "n3", "target": "n4" },
    { "id": "e4", "source": "n4", "target": "n5" },
    { "id": "e5", "source": "n5", "target": "n6", "label": "回传菜口" }
  ],
  "createdAt": 1711200000000,
  "updatedAt": 1711200000000
}
```

---

## 十九、三年演进路线

| 时间 | 定位 | 客户数 | 收入模型 | 核心资产 |
|------|------|--------|----------|----------|
| 2026 Q2-Q3 | 单店配置器 | 1-3 家 | 免费换案例 | adapter-unitree + 1 份 SOP |
| 2026 Q4 | 多店控制台 | 5-10 家 | 99-499/月/店 | 2 品牌 adapter + 3 份 SOP |
| 2027 | RaaS 合伙人贴牌 | 20-50 家 | 30-50/台/月 | 4 品牌 adapter + SOP 市场 |
| 2028 | 独立第三方运营层 | 100+ 家 | SaaS + 告警推送增值 | 8+ adapter + 场景数据飞轮 |
| 2029-2030 | 区域机器人运营标准 | 500+ 家 | 平台抽成 + 培训 | 行业 SOP 标准制定者 |

---

## 二十、下一步行动

1. **今天**：用文档里的 mock-ws-server.js 替换旧的，跑起来看矩形路径 + 电量递减 + 告警
2. **本周**：把"火锅店晚市 SOP"JSON 导入画布，确认能拖拽编辑
3. **下周**：接一家真厂商协议（擎朗/普渡二选一）
4. **2 周内**：找 1 家本地店免费配一次，拿到第一份真实反馈

---

> "你卖的是一块屏，不是一台机器人。屏幕后面接谁的 API 不重要，老板看懂、店长会点、集成商能贴牌，你就赢了。"
