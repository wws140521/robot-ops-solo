# Robot-Ops-Solo · 数字孪生 3D 视图优化文档（含干净架构）

> 版本：v2.0（干净架构版）| 适用栈：React 18 + Vite 5 + @react-three/fiber (R3F) + @react-three/drei + three.js
> 对应包：`packages/digital-twin/` | 消费方：`apps/web-console/`
> 目标：把"能动的方块狗"升级为"关节级驱动、多机同屏、HUD 叠加、SLAM 轨迹、可切换 URDF/GLB"的生产级数字孪生视图
> **v2.0 新增**：解决 v1.0 的架构瑕疵——`digital-twin` 反向依赖 `web-console` 的 store 导致的循环依赖。本版通过**共享 store 包 + Context 注入**彻底解耦。

---

## 目录

- [一、优化总览](#一优化总览)
- [二、技术选型最终确定](#二技术选型最终确定)
- [三、依赖安装](#三依赖安装)
- [四、目录结构（目标态 · 干净架构）](#四目录结构目标态-干净架构)
- [五、架构原则：为什么要"干净做法"](#五架构原则为什么要干净做法)
  - [5.1 v1.0 的架构瑕疵](#51-v10-的架构瑕疵)
  - [5.2 干净架构四原则](#52-干净架构四原则)
  - [5.3 改造前后对比](#53-改造前后对比)
- [六、干净做法落地（核心新增）](#六干净做法落地核心新增)
  - [6.1 新建 `packages/store/` 共享状态包](#61-新建-packagesstore-共享状态包)
  - [6.2 `RobotStateContext` 注入（digital-twin 不持有具体 store）](#62-robotstatecontext-注入digital-twin-不持有具体-store)
  - [6.3 `digital-twin` 的 useRobotState 改为读 Context](#63-digital-twin-的-userobotstate-改为读-context)
  - [6.4 `web-console` 在根组件提供 Context](#64-web-console-在根组件提供-context)
  - [6.5 wsHub 归属与数据写入](#65-wshub-归属与数据写入)
  - [6.6 包依赖单向化（pnpm workspace）](#66-包依赖单向化pnpm-workspace)
  - [6.7 依赖关系图](#67-依赖关系图)
  - [6.8 循环依赖规避检查清单](#68-循环依赖规避检查清单)
- [七、数据流向规范](#七数据流向规范)
- [八、核心代码（3D 组件）](#八核心代码3d-组件)
  - [8.1 RobotViewer.tsx](#81-robotviewertsx)
  - [8.2 G1Dog.tsx（GLB + 骨骼驱动）](#82-g1dogtsxglb--骨骼驱动)
  - [8.3 URDFRobot.tsx（URDF 关节驱动）](#83-urdfrobottsxurdf-关节驱动)
  - [8.4 overlays/HUDLabel.tsx](#84-overlayshudlabeltsx)
  - [8.5 environment/](#85-environment)
- [九、关节驱动规范](#九关节驱动规范)
- [十、多机同屏与性能优化](#十多机同屏与性能优化)
- [十一、模型资源规范](#十一模型资源规范)
- [十二、分步实施顺序](#十二分步实施顺序)
- [十三、验证清单](#十三验证清单)
- [十四、常见问题](#十四常见问题)
- [附录 A：URDF 获取渠道](#附录-aurdf-获取渠道)
- [附录 B：关节名映射约定](#附录-b关节名映射约定)
- [附录 C：性能预算](#附录-c性能预算)
- [附录 D：迁移清单（v1.0 → v2.0 干净架构）](#附录-d迁移清单v10--v20-干净架构)

---

## 一、优化总览

### 现状（基于项目文件树审查）

你的 `packages/digital-twin/` 当前已有：

| 文件 | 状态 | 评价 |
|------|------|------|
| `RobotViewer.tsx` | ✅ 存在 | 需升级：缺 OrbitControls / Environment / Grid / 分层 |
| `robots/G1Dog.tsx` | ✅ 存在 | 需升级：占位几何体 → useGLTF + useFrame 骨骼驱动 |
| `robots/PeanutBot.tsx` | ✅ 存在 | 同上，GLB 加载 + 关节驱动 |
| `environment/Floor.tsx` | ✅ 存在 | 保留，接入 Grid |
| `environment/SlamMap.tsx` | ✅ 存在 | 保留 |
| `environment/collision.ts` | ✅ 额外多 | 保留（你的加分项） |
| `overlays/StatusBadge.tsx` | ✅ 存在 | 升级为 Html 空间锚定 |
| `overlays/TrajectoryLine.tsx` | ✅ 存在 | 保留 |
| `overlays/GlowTrajectory.tsx` | ✅ 额外多 | 保留（发光轨迹）|

**结论**：骨架齐全，缺的是"复杂化"——真实模型加载、关节驱动、多机、HUD、性能优化。
**v2.0 额外结论**：架构上 `digital-twin` 不应反向依赖 `web-console`，必须把状态层抽到共享包（详见第五章）。

### 优化目标（5 个升级方向 + 1 个架构升级）

```
A. 模型真实化   占位几何体 → useGLTF 加载真实 GLB / URDF
B. 关节驱动化   骨骼/关节每帧随 WebSocket 数据更新
C. 场景专业化   Environment HDRI + Grid + 阴影 + 分层
D. 信息 HUD 化  3D 空间锚定标签（ID/电量/状态）
E. 多机规模化   Instances + LOD + 性能预算
F. 架构干净化  store 共享化 + Context 注入 + 依赖单向化（★v2.0 新增）
```

### 设计原则

1. **3D 组件只从 Context 读数据，绝不直连 WS**（多人共享、刷新不断流）
2. **模型加载异步 + Suspense 兜底占位**（防白屏闪烁）
3. **useFrame 里只 mutate，不 allocate**（避免 GC 卡顿）
4. **模型格式可切换**：GLB（默认）↔ URDF（关节机器人）由 `modelType` 字段决定
5. **★依赖单向**：`digital-twin` → `store`（只读类型+Hook）→ `adapter-kit`；绝不反向（干净架构核心）

---

## 二、技术选型最终确定

| 机器人类型 | 加载器 | 驱动方式 | 适用 |
|-----------|--------|---------|------|
| **宇树 G1 / Go2 四足、人形** | Drei `useGLTF` | 骨骼名映射 `joints` → `bone.rotation` | GLB 模型 |
| **擎朗 Peanut / 普渡 送餐机** | Drei `useGLTF` | 同上 | GLB 模型 |
| **机械臂 / 人形（关节级）** | `three-urdf` (`parseURDF` + `loadRobot`) | `robot.setJointValues(joints)` | URDF 模型 |
| **点云 / SLAM / 轨迹** | `THREE.Line` / `InstancedMesh` | Drei `Instances` | 环境数据 |
| **HUD 标签** | Drei `Html` | 空间坐标锚定 2D DOM | 状态浮层 |

### 为什么不用原生 three.js 手写

- R3F 声明式：场景 = React 组件树，状态驱动自动 diff，与你现有 React/Zustand 体系一致
- Drei 工具集：`OrbitControls` / `Environment` / `useGLTF` / `Html` / `Instances` / `Grid` / `Stage` / `Float` / `Detailed` 开箱即用
- 社区成熟：R3F + Drei + Zustand 做交互式机器人可视化是 2026 年事实标准栈

---

## 三、依赖安装

### 3.1 digital-twin 运行时依赖

```bash
pnpm --filter digital-twin add \
  three \
  @react-three/fiber \
  @react-three/drei \
  three-urdf \
  urdf-loader

# devDependencies（类型）
pnpm --filter digital-twin add -D \
  @types/three
```

### 3.2 store 包依赖（★v2.0 新增）

```bash
# 共享状态包只需要 zustand，不依赖 react 以外的任何业务包
pnpm --filter @robot-ops/store add zustand
```

### 3.3 版本参考（2026 主流）

```json
// packages/digital-twin/package.json
{
  "dependencies": {
    "three": "^0.181.0",
    "@react-three/fiber": "^9.4.0",
    "@react-three/drei": "^10.7.0",
    "three-urdf": "^1.0.0",
    "urdf-loader": "^1.3.0",
    "@robot-ops/store": "workspace:*"
  }
}
```

> ⚠️ **R3F v9 要求 React 18+**。若 `web-console` 用 React 18，保持 R3F v8（`@react-three/fiber@^8.17`）更稳妥，Drei 对应 v9。版本不匹配会在运行时报 `useContext(...) is null`。

---

## 四、目录结构（目标态 · 干净架构）

```
robot-ops-solo/
├── pnpm-workspace.yaml
├── tsconfig.base.json
│
├── packages/
│   ├── adapter-kit/          # 纯 TS，无框架依赖
│   │   └── src/
│   │       ├── types/unified.ts
│   │       ├── adapters/{adapter-unitree,adapter-keenon,adapter-pudutech,adapter-agibot}.ts
│   │       ├── adapters/index.ts
│   │       └── protocol/{ws-client,mqtt-client}.ts
│   │
│   ├── store/                # ★v2.0 新增：共享状态包（无业务依赖）
│   │   ├── package.json      # name: "@robot-ops/store"
│   │   ├── tsconfig.json
│   │   └── src/
│   │       ├── index.ts
│   │       ├── types.ts                  # UnifiedRobotState 等（从 adapter-kit 再导出）
│   │       ├── robotStore.ts             # createRobotStore()
│   │       ├── alertStore.ts
│   │       ├── sopStore.ts
│   │       └── RobotStateContext.tsx     # ★Context + Provider + useRobotState
│   │
│   ├── sop-editor/           # 依赖 store + adapter-kit
│   │   └── src/
│   │       ├── schema/sop-schema.ts
│   │       ├── engine/{sop-executor,sop-simulator}.ts
│   │       ├── hooks/useSopStore.ts      # 改用 @robot-ops/store
│   │       ├── nodes/...
│   │       └── SopEditor.tsx
│   │
│   ├── digital-twin/         # ★只依赖 store（通过 Context 读），不依赖 web-console
│   │   ├── package.json      # 依赖: @robot-ops/store (workspace:*)
│   │   └── src/
│   │       ├── index.ts
│   │       ├── RobotViewer.tsx
│   │       ├── robots/{G1Dog,PeanutBot,URDFRobot}.tsx
│   │       ├── environment/{Floor,SlamMap,collision}.ts(x)
│   │       ├── overlays/{StatusBadge,TrajectoryLine,GlowTrajectory,HUDLabel}.tsx
│   │       └── hooks/useRobotState.ts    # ★改为读 Context
│   │
│   └── ui-kit/               # 依赖 store
│       └── src/{RobotStatusCard,BatteryGauge,AlertCard,ThemeProvider,...}.tsx
│
├── apps/
│   └── web-console/          # ★依赖 store + 所有 ui 包；负责装配 + 提供 Context
│       └── src/
│           ├── main.tsx
│           ├── App.tsx       # ★<RobotStateProvider store={useCreateStore()}>
│           ├── stores/       # ★仅保留 createStore 工厂，不放业务状态
│           │   └── createRootStore.ts
│           ├── lib/{supabase,wsHub}.ts    # ★wsHub 写 store 的地方
│           ├── components/layout/{Sidebar,TenantBranding}.tsx
│           └── routes/{Dashboard,RobotsPage,SopPage,TwinPage,AlertsPage,Login}.tsx
```

### 关键变化（v1.0 → v2.0）

| 位置 | v1.0（有瑕疵） | v2.0（干净） |
|------|--------------|--------------|
| `digital-twin` 读状态 | `import { useRobotStore } from 'web-console'` ❌ 反向依赖 | `useContext(RobotStateContext)` ✅ 只依赖 store |
| 全局状态 | 散落在 `web-console/src/stores/` | 抽到 `packages/store/` 共享包 |
| wsHub 归属 | 不明确 | 明确在 `web-console/lib/`（唯一写入点） |
| 包依赖方向 | 可能循环 | pnpm `dependencies` 强制单向 |

---

## 五、架构原则：为什么要"干净做法"

### 5.1 v1.0 的架构瑕疵

v1.0 文档 6.7 节已经自己指出了问题：

> `useRobotState` 跨包引用 `web-console` 的 store——这是架构瑕疵。

具体有三个隐患：

**① 循环依赖（致命）**
```
digital-twin → web-console (读 store)
web-console  → digital-twin (在 TwinPage 里 import RobotViewer)
```
pnpm 的 `node_modules` 隔离会让这在构建时报 `Cannot access 'X' before initialization`，或运行时拿到 `undefined` 的 store。你现在是单仓，暂时靠 hoisting 蒙混过去，**一旦启用 `public-hoist-pattern` 严格模式或发包上线就炸**。

**② 不可复用**
`digital-twin` 本应是独立可视化库（可发 npm、可给别的 App 用），现在却被锁死在 `web-console` 里——抽不出来、测不了、发不了。

**③ 难测试**
3D 组件直接 `import` 具体 store 实现，写测试时要 `vi.mock('web-console/...')` 跨包 mock，极其脆弱。

### 5.2 干净架构四原则

| 原则 | 做法 | 解决 |
|------|------|------|
| **① 依赖单向** | 依赖关系只允许 `app → ui 包 → 纯逻辑包`，永不反向 | 循环依赖 |
| **② 共享状态外置** | 全局状态集中在 `packages/store/`，业务包只消费不持有 | 状态散落 |
| **③ 面向接口（Context）** | `digital-twin` 只依赖 `RobotStateContext`，不依赖具体实现 | 不可复用 |
| **④ 唯一写入点** | 只有 `web-console/lib/wsHub.ts` 能写 store，3D 组件纯消费 | 数据流混乱 |

### 5.3 改造前后对比

```
❌ v1.0（循环）
┌──────────────┐         ┌──────────────┐
│ digital-twin │────────→│  web-console │
│  (读 store)  │←────────│  (TwinPage)  │
└──────────────┘  循环   └──────────────┘

✅ v2.0（单向）
┌────────────┐    ┌────────────┐    ┌──────────────┐
│ adapter-kit│───→│   store    │←──│ digital-twin  │
└────────────┘    │ (共享+Context)│  │ (Context 消费)│
                  └─────┬──────┘    └──────┬───────┘
                        │ 提供              │ 渲染
                        ▼                   ▼
                  ┌─────────────────────────────┐
                  │         web-console         │
                  │  - createRootStore          │
                  │  - RobotStateProvider       │
                  │  - wsHub (唯一写入)         │
                  └─────────────────────────────┘
```

---

## 六、干净做法落地（核心新增）

### 6.1 新建 `packages/store/` 共享状态包

这是整个干净架构的**枢纽**。它只放"状态相关的纯逻辑"，不 import React 组件、不 import 任何业务包。

**`packages/store/package.json`**
```json
{
  "name": "@robot-ops/store",
  "version": "0.1.0",
  "type": "module",
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "exports": {
    ".": "./src/index.ts",
    "./react": "./src/RobotStateContext.tsx"
  },
  "dependencies": {
    "zustand": "^4.5.0"
  },
  "peerDependencies": {
    "react": "^18.0.0"
  }
}
```

**`packages/store/src/types.ts`**（从 adapter-kit 的 unified 类型 re-export，避免 store 反向依赖 adapter-kit）
```ts
// 注意：store 不依赖 adapter-kit，类型自己定义一份（或放 packages/types 共享）
// 这里选择"自包含"，减少包间耦合

export type RobotStatus = 'idle' | 'moving' | 'working' | 'error' | 'charging'

export interface UnifiedRobotState {
  robotId: string
  brand: string
  model: string
  modelType: 'glb' | 'urdf'   // ★决定 digital-twin 用哪个加载器
  glbUrl?: string              // GLB 模型路径
  urdfUrl?: string             // URDF 模型路径
  batteryPct: number
  voltage: number
  online: boolean
  position: { x: number; y: number; theta: number }
  joints?: Record<string, number>
  status: RobotStatus
  errorCode?: string
  lastSeen: number
}

export interface UnifiedAlert {
  id: string
  robotId: string
  level: 'info' | 'warn' | 'error'
  code: string
  message: string
  timestamp: number
  resolved?: boolean
}
```

**`packages/store/src/robotStore.ts`**
```ts
import { create, StoreApi, UseBoundStore } from 'zustand'
import { UnifiedRobotState } from './types'

export interface RobotStore {
  robots: Record<string, UnifiedRobotState>
  updateRobot: (id: string, state: UnifiedRobotState) => void
  removeRobot: (id: string) => void
  getRobot: (id: string) => UnifiedRobotState | undefined
}

// ★工厂函数：返回一个 store 实例（供 React Context 注入）
export function createRobotStore(): UseBoundStore<StoreApi<RobotStore>> {
  return create<RobotStore>((set, get) => ({
    robots: {},
    updateRobot: (id, state) =>
      set((s) => ({ robots: { ...s.robots, [id]: state } })),
    removeRobot: (id) =>
      set((s) => {
        const next = { ...s.robots }
        delete next[id]
        return { robots: next }
      }),
    getRobot: (id) => get().robots[id],
  }))
}
```

**`packages/store/src/alertStore.ts`**（同样做成工厂）
```ts
import { create, StoreApi, UseBoundStore } from 'zustand'
import { UnifiedAlert } from './types'

export interface AlertStore {
  alerts: UnifiedAlert[]
  addAlert: (a: UnifiedAlert) => void
  resolveAlert: (id: string) => void
  clear: () => void
}

export function createAlertStore(): UseBoundStore<StoreApi<AlertStore>> {
  return create<AlertStore>((set) => ({
    alerts: [],
    addAlert: (a) => set((s) => ({ alerts: [a, ...s.alerts].slice(0, 500) })),
    resolveAlert: (id) =>
      set((s) => ({
        alerts: s.alerts.map((a) => (a.id === id ? { ...a, resolved: true } : a)),
      })),
    clear: () => set({ alerts: [] }),
  }))
}
```

### 6.2 `RobotStateContext` 注入（digital-twin 不持有具体 store）

**`packages/store/src/RobotStateContext.tsx`**（这是"干净做法"的核心文件）
```tsx
import { createContext, useContext, ReactNode, useRef } from 'react'
import { StoreApi, UseBoundStore } from 'zustand'
import { createRobotStore, RobotStore } from './robotStore'
import { createAlertStore, AlertStore } from './alertStore'

// ★把 store 实例类型抽象成接口，digital-twin 只依赖这个接口
export interface RobotStateApi {
  robotStore: UseBoundStore<StoreApi<RobotStore>>
  alertStore: UseBoundStore<StoreApi<AlertStore>>
}

// ★默认实例（兜底，防止没包 Provider 时报错）
const defaultApi: RobotStateApi = {
  robotStore: createRobotStore(),
  alertStore: createAlertStore(),
}

export const RobotStateContext = createContext<RobotStateApi>(defaultApi)

interface ProviderProps {
  children: ReactNode
  // ★可选注入：测试时可传入 mock store
  value?: RobotStateApi
}

export function RobotStateProvider({ children, value }: ProviderProps) {
  // 无 value 时用默认实例（兜底，保证单测/简单场景也能跑）
  const apiRef = useRef(value ?? defaultApi)
  return (
    <RobotStateContext.Provider value={apiRef.current}>
      {children}
    </RobotStateContext.Provider>
  )
}

// ★digital-twin 唯一的"读状态"入口——只碰 Context，不知道 web-console 存在
export function useRobotStateSelector<T>(selector: (state: RobotStore) => T): T {
  const { robotStore } = useContext(RobotStateContext)
  return robotStore(selector)
}

export function useRobotStore(): RobotStore {
  const { robotStore } = useContext(RobotStateContext)
  return robotStore.getState()
}

export function useAlertStore(): AlertStore {
  const { alertStore } = useContext(RobotStateContext)
  return alertStore.getState()
}
```

**`packages/store/src/index.ts`**
```ts
export * from './types'
export * from './robotStore'
export * from './alertStore'
export * from './RobotStateContext'
```

### 6.3 `digital-twin` 的 useRobotState 改为读 Context

**`packages/digital-twin/src/hooks/useRobotState.ts`**（v2.0 重写）
```ts
// ❌ v1.0：import { useRobotStore } from 'web-console/src/stores/robotStore'
// ✅ v2.0：只依赖共享 store 包的 Context
import { useRobotStateSelector, useRobotStore } from '@robot-ops/store/react'

export function useRobotState(robotId: string) {
  // 订阅单台机器人的状态切片，仅在 robotId 对应数据变化时重渲染
  return useRobotStateSelector((state) => state.robots[robotId])
}

export { useRobotStore }
```

> **关键**：`digital-twin` 现在对 `web-console` **零 import**。它只认识 `@robot-ops/store`。
> 这样 `digital-twin` 可以单独发包到 npm，被任何 App 通过 `<RobotStateProvider>` 接入。

### 6.4 `web-console` 在根组件提供 Context

**`apps/web-console/src/stores/createRootStore.ts`**（★唯一的 store 装配点）
```ts
import { createRobotStore, createAlertStore, RobotStateApi } from '@robot-ops/store'

// ★在 App 根组件调用一次，把实例通过 Provider 注入整棵树
export function createRootStore(): RobotStateApi {
  return {
    robotStore: createRobotStore(),
    alertStore: createAlertStore(),
  }
}
```

**`apps/web-console/src/App.tsx`**（装配 Context + 启动 wsHub）
```tsx
import { useEffect, useState } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { RobotStateProvider } from '@robot-ops/store/react'
import { createRootStore } from './stores/createRootStore'
import { startWS } from './lib/wsHub'
import { Sidebar } from './components/layout/Sidebar'
import { TenantBranding } from './components/layout/TenantBranding'
import { Dashboard } from './routes/Dashboard'
import { TwinPage } from './routes/TwinPage'
// ... 其他页面

export default function App() {
  // ★store 实例在 App 层创建，一次
  const [store] = useState(() => createRootStore())

  useEffect(() => {
    // ★唯一写入点：wsHub 拿到 store 引用后写入
    const stop = startWS(store)
    return stop
  }, [store])

  return (
    <RobotStateProvider value={store}>
      <TenantBranding>
        <div style={{ display: 'flex' }}>
          <Sidebar />
          <main style={{ flex: 1 }}>
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/robots/:id" element={<TwinPage />} />
              {/* ... */}
            </Routes>
          </main>
        </div>
      </TenantBranding>
    </RobotStateProvider>
  )
}
```

### 6.5 wsHub 归属与数据写入

**`apps/web-console/src/lib/wsHub.ts`**（★唯一允许写 store 的地方）
```ts
import {
  RobotStateApi,
  adaptUnitree,
  adaptKeenon,
} from '@robot-ops/store' // 只导入类型 + adapter（adapter-kit 已导出 adapt 函数）
import { UnifiedRobotState } from '@robot-ops/store'

// ★接收 store 实例，闭包内写入；返回停止函数
export function startWS(store: RobotStateApi): () => void {
  const ws = new WebSocket('ws://localhost:8080')

  ws.onmessage = (e) => {
    const msg = JSON.parse(e.data)
    const robotId = 'g1-001'

    switch (msg.topic) {
      case '/battery': {
        // ★写入统一状态（adapter 在 adapter-kit，被 store 间接引用）
        const state = adaptUnitree(msg, robotId)
        store.robotStore.getState().updateRobot(robotId, state)
        break
      }
      case '/speak': {
        // 走 alertStore（信息级）
        store.alertStore.getState().addAlert({
          id: crypto.randomUUID(),
          robotId,
          level: 'info',
          code: 'SPEAK',
          message: `播报: ${msg.data.text}`,
          timestamp: Date.now(),
        })
        break
      }
    }
  }

  return () => ws.close()
}
```

> **写入规则**：3D 组件（`RobotViewer`/`G1Dog`）**绝不调用 `updateRobot`**，它们只 `useRobotState(robotId)` 读。这是保证数据流的单向性的关键纪律。

### 6.6 包依赖单向化（pnpm workspace）

**`pnpm-workspace.yaml`**
```yaml
packages:
  - "packages/*"
  - "apps/*"
```

**各包 `package.json` 的 `dependencies` 必须严格单向**：

```json
// packages/adapter-kit/package.json —— 纯 TS，零业务依赖
{ "name": "@robot-ops/adapter-kit", "dependencies": {} }

// packages/store/package.json —— 只依赖 zustand
{ "name": "@robot-ops/store", "dependencies": { "zustand": "^4.5.0" } }

// packages/sop-editor/package.json
{
  "name": "@robot-ops/sop-editor",
  "dependencies": {
    "@robot-ops/store": "workspace:*",
    "@robot-ops/adapter-kit": "workspace:*",
    "zustand": "^4.5.0"
  }
}

// packages/digital-twin/package.json ★关键
{
  "name": "@robot-ops/digital-twin",
  "dependencies": {
    "@robot-ops/store": "workspace:*",   // ✅ 只依赖 store
    "three": "^0.181.0",
    "@react-three/fiber": "^8.17.0",
    "@react-three/drei": "^9.114.0"
    // ❌ 绝不包含 "web-console": "workspace:*"
  }
}

// packages/ui-kit/package.json
{
  "name": "@robot-ops/ui-kit",
  "dependencies": {
    "@robot-ops/store": "workspace:*",
    "zustand": "^4.5.0"
  }
}

// apps/web-console/package.json —— 唯一允许反向聚合的地方
{
  "name": "web-console",
  "dependencies": {
    "@robot-ops/store": "workspace:*",
    "@robot-ops/adapter-kit": "workspace:*",
    "@robot-ops/sop-editor": "workspace:*",
    "@robot-ops/digital-twin": "workspace:*",
    "@robot-ops/ui-kit": "workspace:*",
    "zustand": "^4.5.0"
  }
}
```

**`tsconfig.base.json`** 加路径映射兜底：
```json
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@robot-ops/*": ["packages/*/src/index.ts"]
    }
  }
}
```

### 6.7 依赖关系图（最终）

```
                 ┌─────────────────────┐
                 │   adapter-kit (纯TS) │
                 └──────────┬──────────┘
                            │ (导出 UnifiedRobotState 类型 + adapt 函数)
                            ▼
                 ┌─────────────────────┐
                 │     store (zustand)  │ ← 只依赖 zustand
                 └──┬──────────┬───────┘
                    │          │ (导出类型 + Context + Hook)
        依赖 store  │          │ 依赖 store
        ┌───────────┤          ├───────────┐
        ▼           ▼          ▼           ▼
  ┌──────────┐ ┌────────┐ ┌──────────┐ ┌────────┐
  │sop-editor│ │digital-│ │  ui-kit  │ │(将来包)│
  │          │ │ twin   │ │          │ │        │
  └────┬─────┘ └────┬───┘ └────┬─────┘ └───┬────┘
       │             │           │            │
       │     渲染依赖 │           │            │
       │             ▼           │            │
       │      ┌──────────┐       │            │
       │      │   three  │       │            │
       │      └──────────┘       │            │
       └─────────┬──────────────┘            │
                 ▼                            │
        ┌──────────────────┐                  │
        │   web-console    │ ← 唯一聚合点    │
        │  - Provider      │ ← 装配 store    │
        │  - wsHub(写)     │ ← 唯一写入     │
        │  - 路由/布局     │                  │
        └──────────────────┘                  │
                                               ▼
                                          (无反向依赖)
```

**校验命令**（每次重构后跑）：
```bash
# 用 madge 生成依赖图，确认无循环
pnpm add -D -w madge
npx madge --image deps.png --extensions ts,tsx packages/ apps/
# 或纯文本查看循环
npx madge --circular packages/ apps/
```
**输出应为空**（无循环）。若有循环，madge 会打印出循环路径。

### 6.8 循环依赖规避检查清单

| 检查项 | 命令/方法 | 期望 |
|--------|----------|------|
| ① madge 无循环 | `npx madge --circular packages/ apps/` | 无输出 |
| ② digital-twin 不引 web-console | `grep -r "web-console" packages/digital-twin/src` | 无匹配 |
| ③ store 不引任何 ui/app 包 | `grep -r "from '@robot-ops/(sop-editor\|digital-twin\|ui-kit\|web-console)" packages/store/src` | 无匹配 |
| ④ 只有 web-console 引所有包 | 见各包 package.json | 仅 web-console 全聚合 |
| ⑤ 启用严格 hoist 测试 | `.npmrc` 加 `public-hoist-pattern=[]` 后 `pnpm i && pnpm build` | 仍能构建 |
| ⑥ 3D 组件不写 store | 搜 `getState().updateRobot` 在 digital-twin 里 | 无匹配 |

> 第 ⑤ 条尤其重要：pnpm 默认会 hoist 一部分依赖到根 `node_modules`，可能**掩盖**循环依赖。生产前务必用严格 hoist 模式验证一次。

---

## 七、数据流向规范

### 单向数据流（干净架构版）

```
┌──────────────────────────────────────────────────────────┐
│  WebSocket / MQTT (mock-ws-server 或真机)               │
└────────────────────┬─────────────────────────────────────┘
                     │ onmessage
                     ▼
┌──────────────────────────────────────────────────────────┐
│  apps/web-console/lib/wsHub.ts   ★唯一写入点             │
│   - 按 topic 分发                                        │
│   - adapter-kit 转换 → UnifiedRobotState                 │
│   - store.robotStore.getState().updateRobot()            │
│   - store.alertStore.getState().addAlert()              │
└────────────────────┬─────────────────────────────────────┘
                     │ Zustand 状态更新
                     ▼
┌──────────────────────────────────────────────────────────┐
│  packages/store/   (RobotStateContext)                  │
│   - robotStore / alertStore                             │
└────────────────────┬─────────────────────────────────────┘
                     │ Context.Provider (在 App.tsx 根)
                     ▼
┌──────────────────────────────────────────────────────────┐
│  packages/digital-twin/   ★纯消费                       │
│   - useRobotState(robotId) → 订阅切片                   │
│   - RobotViewer / G1Dog / URDFRobot                     │
│   - useFrame 每帧读 joints → 驱动骨骼                   │
└──────────────────────────────────────────────────────────┘
```

### 铁律

1. **只有 wsHub 写 store**（6.4 的 startWS）；其余所有地方只读
2. **3D 组件通过 Context 读**，禁止 `import` 具体 store 实现
3. **adapter 纯函数**（input raw → output UnifiedRobotState），不放进 React 组件
4. **一个 robotId 对应一个订阅切片**：`useRobotStateSelector(s => s.robots[id])`，避免整树重渲染
5. **写入批量合并**：高频 WS（>30Hz）用 `useShallow` + `flushSync` 或 ref 累积，避免每帧触发 React 提交

---

## 八、核心代码（3D 组件）

### 8.1 RobotViewer.tsx

```tsx
import { Canvas, useFrame } from '@react-three/fiber'
import {
  OrbitControls, Environment, Grid, Html,
  AdaptiveDpr, AdaptiveEvents,
} from '@react-three/drei'
import { Suspense, useRef } from 'react'
import * as THREE from 'three'
import { useRobotState } from './hooks/useRobotState'
import { G1Dog } from './robots/G1Dog'
import { URDFRobot } from './robots/URDFRobot'
import { HUDLabel } from './overlays/HUDLabel'
import { TrajectoryLine } from './overlays/TrajectoryLine'
import { Floor } from './environment/Floor'

interface RobotViewerProps {
  robotId: string
  /** 模型格式：glb（默认）或 urdf */
  modelType?: 'glb' | 'urdf'
}

export function RobotViewer({ robotId, modelType = 'glb' }: RobotViewerProps) {
  const robot = useRobotState(robotId)  // ★从 Context 读（非 web-console）

  if (!robot) {
    return <div style={{ color: '#94a3b8' }}>等待机器人数据…</div>
  }

  const pos: [number, number, number] = [robot.position.x, 0, robot.position.y]

  return (
    <Canvas
      shadows
      dpr={[1, 2]}              // ★性能：限制像素比
      camera={{ position: [4, 3, 4], fov: 50 }}
      gl={{ antialias: true, powerPreference: 'high-performance' }}
    >
      {/* ★专业场景：HDRI 光照 + 阴影 */}
      <Environment preset="warehouse" />
      <ambientLight intensity={0.4} />
      <directionalLight position={[5, 10, 5]} intensity={1} castShadow />

      {/* ★地面网格 + 自定义 Floor */}
      <Grid
        args={[20, 20]}
        cellSize={1}
        cellColor="#1e293b"
        sectionSize={5}
        sectionColor="#334155"
        fadeDistance={30}
        infiniteGrid
      />
      <Floor />

      <Suspense fallback={null}>   {/* ★异步加载兜底 */}
        {modelType === 'urdf' ? (
          <URDFRobot robotId={robotId} />
        ) : (
          <G1Dog
            joints={robot.joints}
            position={pos}
            rotation={[0, robot.position.theta, 0]}
          />
        )}
      </Suspense>

      {/* HUD 空间锚定标签 */}
      <HUDLabel position={[pos[0], 2.2, pos[2]]} robot={robot} />

      {/* SLAM 轨迹线 */}
      <TrajectoryLine robotId={robotId} />

      <OrbitControls makeDefault enableDamping dampingFactor={0.1} />
      <AdaptiveDpr pixelated />   {/* ★低配设备降级 */}
      <AdaptiveEvents />
    </Canvas>
  )
}
```

### 8.2 G1Dog.tsx（GLB + 骨骼驱动）

```tsx
import { useGLTF, useAnimations } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { useEffect, useRef } from 'react'
import * as THREE from 'three'

interface G1DogProps {
  joints?: Record<string, number>
  position?: [number, number, number]
  rotation?: [number, number, number]
  /** GLB 模型路径，默认 /models/g1_dog.glb */
  url?: string
}

export function G1Dog({
  joints,
  position = [0, 0, 0],
  rotation = [0, 0, 0],
  url = '/models/g1_dog.glb',
}: G1DogProps) {
  const { scene, animations } = useGLTF(url)
  const { actions } = useAnimations(animations, scene)
  const ref = useRef<THREE.Group>(null!)

  // ★useFrame 里只 mutate 骨骼，不创建新对象
  useFrame(() => {
    if (!joints || !ref.current) return
    Object.entries(joints).forEach(([jointName, value]) => {
      const bone = ref.current.getObjectByName(jointName)
      if (bone && bone instanceof THREE.Object3D) {
        // ★按关节名推断旋转轴（详见第九章约定）
        const axis = inferAxis(jointName)
        bone.rotation[axis] = value
      }
    })
  })

  return (
    <primitive
      ref={ref}
      object={scene}
      position={position}
      rotation={rotation}
      scale={0.5}
      castShadow
      receiveShadow
    />
  )
}

/**
 * 关节名 → 旋转轴推断（hip→y, thigh/knee→x, roll→z）
 * 完整约定见附录 B；复杂机器人建议在 GLB 导出时固化轴信息。
 */
function inferAxis(jointName: string): 'x' | 'y' | 'z' {
  const n = jointName.toLowerCase()
  if (n.includes('hip') || n.includes('yaw')) return 'y'
  if (n.includes('roll')) return 'z'
  return 'x'  // thigh / knee / pitch 默认 x
}

// ★预加载，防首次渲染闪烁
useGLTF.preload('/models/g1_dog.glb')
```

> **降级策略**：若 `url` 加载失败或文件不存在，建议上层 `RobotViewer` 渲染一个占位几何体（见第十一章），保证不白屏。

### 8.3 URDFRobot.tsx（URDF 关节驱动）

```tsx
import { useEffect, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import { useRobotState } from './hooks/useRobotState'
import { parseURDF, loadRobot, URDFRobot as URDFModel } from 'three-urdf'

interface URDFRobotProps {
  robotId: string
  /** URDF 文件地址，如 /models/robot.urdf */
  urdfUrl?: string
}

export function URDFRobot({ robotId, urdfUrl = '/models/robot.urdf' }: URDFRobotProps) {
  const [robot, setRobot] = useState<URDFModel | null>(null)
  const robotState = useRobotState(robotId)

  // ★加载 URDF（一次）
  useEffect(() => {
    let cancelled = false
    fetch(urdfUrl)
      .then((r) => r.text())
      .then((urdfText) => {
        if (cancelled) return
        const model = parseURDF(urdfText, {
          packageMap: { robot_description: '/models' },
        })
        return loadRobot(model)
      })
      .then((obj) => {
        if (!cancelled && obj) setRobot(obj)
      })
      .catch((err) => console.error('[URDFRobot] load failed:', err))
    return () => {
      cancelled = true
    }
  }, [urdfUrl])

  // ★每帧驱动关节（three-urdf 自动处理 Z-up → Y-up 转换）
  useFrame(() => {
    if (robot && robotState?.joints) {
      robot.setJointValues(robotState.joints)
    }
  })

  if (!robot) return null
  return <primitive object={robot} castShadow receiveShadow />
}
```

> `three-urdf` 的 `setJointValues` 会递归遍历 `<joint>` 树并按 `type` 驱动 `revolute`/`continuous`/`prismatic` 关节，比手动映射骨骼更可靠——**机械臂/人形首选 URDF**。

### 8.4 overlays/HUDLabel.tsx

```tsx
import { Html } from '@react-three/drei'
import { UnifiedRobotState } from '@robot-ops/store'

interface HUDLabelProps {
  position: [number, number, number]
  robot: UnifiedRobotState
}

export function HUDLabel({ position, robot }: HUDLabelProps) {
  const color =
    robot.status === 'error' ? '#ff3d71' :
    robot.status === 'moving' ? '#00f0ff' : '#94a3b8'

  return (
    <Html
      position={position}
      center
      distanceFactor={8}     // ★随距离缩放，避免远处方块过大
      occlude="blending"     // ★被物体遮挡时半透明
      style={{ pointerEvents: 'none' }}
    >
      <div
        style={{
          background: 'rgba(10, 14, 26, 0.85)',
          border: `1px solid ${color}`,
          borderRadius: 6,
          padding: '4px 8px',
          color: '#e2e8f0',
          fontFamily: 'JetBrains Mono, monospace',
          fontSize: 11,
          whiteSpace: 'nowrap',
          boxShadow: `0 0 8px ${color}44`,
        }}
      >
        <div style={{ color }}>● {robot.robotId}</div>
        <div>{robot.batteryPct}% · {robot.status}</div>
      </div>
    </Html>
  )
}
```

### 8.5 environment/

**`Floor.tsx`**（保留并增强阴影）
```tsx
import { MeshReflectorMaterial } from '@react-three/drei'

export function Floor() {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
      <planeGeometry args={[40, 40]} />
      <MeshReflectorMaterial
        blur={[300, 100]}
        resolution={1024}
        mixBlur={1}
        mixStrength={2}
        roughness={1}
        depthScale={1.2}
        minDepthThreshold={0.4}
        maxDepthThreshold={1.4}
        color="#0f172a"
        metalness={0.5}
      />
    </mesh>
  )
}
```

**`SlamMap.tsx` / `collision.ts`**：保留现有实现。建议 `collision.ts` 的碰撞检测结果也通过 `store` 暴露（新增 `collisionStore`），供告警页消费——保持"状态走 store"的一致性。

---

## 九、关节驱动规范

### 9.1 命名 → 旋转轴约定

| 关节名关键词 | 旋转轴 | 说明 |
|-------------|--------|------|
| `hip`、`yaw`、`waist_yaw` | **Y** | 水平转向 |
| `shoulder_pan`、`pan` | **Y** | 水平回转 |
| `thigh`、`knee`、`elbow`、`pitch` | **X** | 屈伸 |
| `roll`、`wrist_roll` | **Z** | 侧翻 |
| 含 `x` 轴后缀（`hip_x`） | **X** | 显式 |
| 含 `z` 轴后缀 | **Z** | 显式 |

> 完整映射与调试技巧见附录 B。**注意**：这只是**兜底推断**。权威做法是从 URDF 的 `<joint type="revolute" axis="0 0 1"/>` 读取，或用厂商提供的骨骼-关节对照表（宇树 IDL、智元 AimDK）。

### 9.2 Z-up → Y-up

- ROS/URDF 用 **Z-up**，Three.js/R3F 用 **Y-up**
- `three-urdf` 的 `loadRobot` **自动转换**，用 URDF 时无需手动处理
- GLB 模型若由 ROS 工具链导出（如 `urdf_to_glb`），导出时通常已带 `meshUp="y"`；若姿态歪了，在 `useGLTF` 后用 `scene.up.set(0,1,0)` + `scene.rotation.set(...)` 修正

### 9.3 驱动频率

- WS 推送关节角通常 20-50Hz
- `useFrame` 约 60Hz，每帧读 store 最新值 → 足够平滑
- **高频场景（>60Hz）优化**：用 `useRef` 存上一帧值，差值小于阈值不提交；或改用 `instancedMesh` 批量

---

## 十、多机同屏与性能优化

### 10.1 Instances 渲染 fleet

```tsx
import { Instances, Instance } from '@react-three/drei'

export function RobotFleet({ ids }: { ids: string[] }) {
  return (
    <Instances limit={ids.length} castShadow receiveShadow>
      {/* 共享几何体 + 材质，GPU 一次 draw call */}
      <boxGeometry args={[0.6, 0.4, 0.8]} />
      <meshStandardMaterial color="#00f0ff" />
      {ids.map((id) => (
        <RobotInstance key={id} robotId={id} />
      ))}
    </Instances>
  )
}

function RobotInstance({ robotId }: { robotId: string }) {
  const robot = useRobotState(robotId)
  if (!robot) return null
  return (
    <Instance
      position={[robot.position.x, 0.2, robot.position.y]}
      rotation={[0, robot.position.theta, 0]}
      color={robot.status === 'error' ? '#ff3d71' : '#00f0ff'}
    />
  )
}
```

### 10.2 useFrame 性能铁律

- ✅ **只 mutate**：`bone.rotation.x = value`
- ❌ **不 allocate**：禁止在帧循环里 `new THREE.Vector3()`、`[]`、`{}`
- ✅ **复用变量**：把临时对象提到组件外或 `useRef`
- ✅ **节流**：位置插值用 `lerp` 而非每帧硬设
- ✅ **切片订阅**：`useRobotStateSelector(s => s.robots[id])` 而非订阅整个 store

### 10.3 LOD 与降级

```tsx
import { Detailed } from '@react-three/drei'

<Detailed distances={[0, 10, 25]}>
  <G1DogHigh detail="high" />   {/* 近距离高模 */}
  <G1DogMid />                   {/* 中距离 */}
  <G1DogLow />                   {/* 远距离占位 */}
</Detailed>
```

### 10.4 性能预算（详见附录 C）

| 指标 | 目标值 |
|------|--------|
| 帧率 | ≥60fps（中高端 GPU） |
| Draw calls | < 200 |
| 三角面数/机器人 | < 500K |
| 首帧可交互 | < 3s |

---

## 十一、模型资源规范

### 11.1 目录

```
apps/web-console/public/
└── models/
    ├── g1_dog.glb          # 宇树 G1
    ├── peanut_bot.glb      # 擎朗 Peanut
    └── robot.urdf          # 机械臂/人形 URDF
```

### 11.2 获取渠道

- **宇树 G1**：官方 IDL（`unitree_hg`）+ ROS2 仓库的 xacro/urdf
- **Sketchfab**：搜 "Unitree G1"、"robot dog" 下免费 low-poly（先用占位验证管线）
- **ROS-Industrial / Gazebo Model DB**：标准 URDF 模型库
- **智元 AimDK**：开源 protobuf + 模型定义

### 11.3 降级兜底

```tsx
// RobotViewer 里
{robot.modelType === 'urdf' ? (
  <URDFRobotWithFallback robotId={robotId} urdfUrl={robot.urdfUrl} />
) : (
  <GLBWithFallback robotId={robotId} url={robot.glbUrl ?? '/models/g1_dog.glb'} />
)}

// 加载失败时渲染占位几何体
function GLBWithFallback({ url, ...props }) {
  const { scene } = useGLTF(url)
  if (!scene) return <PlaceholderRobot {...props} />
  return <G1Dog {...props} url={url} />
}
```

---

## 十二、分步实施顺序

> 总计约 **8-10 小时**（含干净架构重构）。每步标注耗时与验证点。

| 步骤 | 内容 | 耗时 | 验证点 |
|------|------|------|--------|
| **1** | 新建 `packages/store/`，写 types + robotStore + alertStore + Context | 1.5h | `pnpm --filter @robot-ops/store build` 通过 |
| **2** | 改 `digital-twin/src/hooks/useRobotState.ts` 读 Context，删除对 web-console 的 import | 0.5h | `grep -r "web-console" packages/digital-twin/src` 无输出 |
| **3** | `web-console` 新建 `stores/createRootStore.ts` + `App.tsx` 包 `<RobotStateProvider value={createRootStore()}>` | 1h | 应用能启动，store 可注入 |
| **4** | 迁移 wsHub 到 `web-console/lib/`，改为接收 store 参数写入 | 1h | WS 数据能流入 store |
| **5** | 更新所有包 `package.json` 依赖为单向（6.6） | 0.5h | `madge --circular` 无循环 |
| **6** | 升级 `RobotViewer.tsx`（OrbitControls + Environment + Grid + Suspense） | 1h | 页面有专业光照+可旋转 |
| **7** | 放 low-poly GLB 到 `public/models/`，验证 `G1Dog` 骨骼驱动 | 1.5h | 关节角变化 → 狗腿动 |
| **8** | 下载 6 轴机械臂 URDF，验证 `URDFRobot` | 1h | setJointValues 驱动机械臂 |
| **9** | 加 `HUDLabel` + `TrajectoryLine` + 告警联动 | 1h | 空间标签 + 轨迹可见 |
| **10** | 跑 6.8 检查清单 + 性能预算（附录 C） | 0.5h | 全绿 |

---

## 十三、验证清单

### 功能（11 条）
- [ ] `madge --circular` 输出为空（无循环依赖）
- [ ] `digital-twin` 对 `web-console` 零 import
- [ ] `store` 包不依赖任何 ui/app 包
- [ ] 只有 `wsHub` 调用 `updateRobot`/`addAlert`
- [ ] 浏览器打开 TwinPage 显示 3D 机器人
- [ ] mock WS 推 `/battery` → 机器人位置/电量更新
- [ ] mock WS 推 `/speak` → HUD 显示播报 + alertStore 有记录
- [ ] GLB 模型加载成功（或降级占位几何体）
- [ ] URDF 机器人关节随 `joints` 数据转动
- [ ] 切换 robotId，视图跟随不同机器人
- [ ] 多机 fleet 用 Instances 同屏渲染不卡顿

### 架构（干净做法专属）
- [ ] `RobotStateProvider` 只在 `App.tsx` 根调用一次
- [ ] 3D 组件全部通过 `useRobotState` (Context) 读，无直接 store import
- [ ] wsHub 是唯一的 `store.xxx.getState()` 写入点
- [ ] 严格 hoist 模式（`public-hoist-pattern=[]`）下 `pnpm build` 仍成功
- [ ] 单测可注入 mock store（测试干净架构的解耦价值）

---

## 十四、常见问题

| 问题 | 原因 | 解决 |
|------|------|------|
| **模型 404 / 白屏** | `public/models/` 路径错或文件缺失 | 用 `Suspense` 兜底 + 占位几何体（11.3） |
| **关节不动** | ① GLB 骨骼名与 joints key 不匹配 ② 轴推断错 | 打印 `scene.traverse` 看骨骼名；改用 URDF 的权威 axis |
| **`Cannot access 'X' before initialization`** | **循环依赖** | 跑 6.8 检查清单 + madge；抽 store 包 |
| **`useContext(...) is null`** | R3F v9 与 React 版本不匹配 / 忘了包 Provider | 锁 React 18 + R3F v8；确认 `<RobotStateProvider>` 在 Canvas 父级 |
| **低 FPS / 卡顿** | useFrame 里 allocate / draw call 过多 | 10.2 铁律 + Instances + LOD |
| **URDF 材质丢失** | `three-urdf` 未加载关联 mesh 文件 | `packageMap` 指向正确目录；或换 GLB |
| **HUD 标签穿透物体** | 未开 occlude | `<Html occlude="blending">` |
| **重复 three.js 实例** | hoisting 导致多版本 | 根 `package.json` 加 `"overrides": { "three": "$three" }` |

---

## 附录 A：URDF 获取渠道

| 渠道 | 说明 |
|------|------|
| 宇树官方 ROS2 仓库 | G1/Go2 的 xacro + urdf（含关节 axis 定义） |
| ROS-Industrial | 工业机器人标准 URDF |
| Gazebo Model Database | 大量开源机器人模型 |
| 智元 AimDK | 开源 protobuf 定义 + 模型 |
| 自定义 | SolidWorks/Blender 导出 → `ros2 run xacro` → URDF → GLB |

---

## 附录 B：关节名映射约定

**G1 四足（推断示例，实际以官方 IDL 为准）**：

| 关节名 | 轴 | 说明 |
|--------|----|------|
| `LF_hip_joint` | Y | 左前髋转向 |
| `LF_hip` | Y | （同上，命名变体） |
| `LF_thigh_joint` | X | 大腿屈伸 |
| `LF_knee_joint` | X | 小腿屈伸 |
| `LF_roll_joint` | Z | 侧翻 |
| `RF_hip_joint` | Y | 右前髋 |

**调试技巧**：
```ts
// 一次性打印所有骨骼名
scene.traverse((o) => { if (o.isBone) console.log(o.name) })
```
拿到真实骨骼名后，**固化成映射表**（`jointMap.ts`），比 `inferAxis` 兜底推断可靠。

---

## 附录 C：性能预算

| 指标 | 目标 | 测量 |
|------|------|------|
| 帧率 | ≥60fps（中高端 GPU） | Chrome DevTools Performance / `stats.js` |
| Draw calls | < 200 | Spector.js |
| 三角面数/机器人 | < 500K | `gltf.report` |
| 首帧可交互 | < 3s | Lighthouse |
| 内存（100 台 fleet） | < 1.5GB | Chrome Memory |

**达标策略**：LOD（`Detailed`）+ Instances（同模型批量）+ GLB Draco 压缩 + 纹理 KTX2 + 模型按需加载（路由懒加载 RobotViewer）。

---

## 附录 D：迁移清单（v1.0 → v2.0 干净架构）

> 如果你已按 v1.0 实现，按此清单迁移。**不必重写 3D 组件**，只动状态和依赖。

### D.1 必做（消除循环依赖）

- [ ] 新建 `packages/store/`，把 `UnifiedRobotState` 等类型移入
- [ ] 把 `web-console/src/stores/robotStore.ts` 的 `create` 逻辑搬到 `store/createRobotStore`
- [ ] 新建 `RobotStateContext.tsx`，导出 `RobotStateProvider` + `useRobotState`
- [ ] 改 `digital-twin/src/hooks/useRobotState.ts`：删掉对 `web-console` 的 import，改用 Context
- [ ] 改 `sop-editor/src/hooks/useSopStore.ts`：同上
- [ ] 改 `ui-kit` 各组件：同上（若直接读 store）
- [ ] `web-console/src/App.tsx` 包 `<RobotStateProvider value={createRootStore()}>`
- [ ] `web-console/src/lib/wsHub.ts`：改为接收 store 参数，成为唯一写入点
- [ ] 更新所有 `package.json` 依赖（第六章 6.6）
- [ ] 跑 `madge --circular` 确认无循环

### D.2 建议做（架构更干净）

- [ ] 把 `collision.ts` 的碰撞结果也走 store（`collisionStore`）
- [ ] `adapter-kit` 的 `UnifiedRobotState` 改为从 `@robot-ops/store` re-export（避免重复定义）
- [ ] 启用严格 hoist 验证一次：`public-hoist-pattern=[]`
- [ ] 为 `RobotViewer` 写单测：注入 mock store，断言关节驱动逻辑
- [ ] 发 `@robot-ops/digital-twin` 到私有 npm registry（验证可复用性）

### D.3 不用做（保持现状）

- ✅ 3D 组件（`G1Dog`/`URDFRobot`/`RobotViewer`）的渲染逻辑——只改数据来源
- ✅ `adapter-kit` 的 adapter 函数——保持纯 TS 无依赖
- ✅ Supabase 表结构、RLS、Edge Function——与前端架构无关
- ✅ SOP 编辑器业务逻辑——只把 store import 路径改掉

> **迁移核心口诀**：**抽 store、改 import、Provider 注入、wsHub 独写、madge 验环**。五步完成，3D 组件几乎不动。

---

> 文档版本：v2.0（干净架构版）| 更新日期：2026-08-28
> 反馈：架构问题优先查第六章 + 附录 D；3D 渲染问题查第八、九章。
