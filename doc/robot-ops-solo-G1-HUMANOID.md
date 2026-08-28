# G1Humanoid.tsx 组件开发文档

> **版本**：v1.0
> **对应文件**：`packages/digital-twin/src/robots/G1Humanoid.tsx`
> **目标**：替换现有 `G1Dog.tsx`，实现宇树 G1 29 DOF 人形机器人关节级驱动的逼真数字孪生
> **前置依赖**：`three-urdf` / `urdf-loader`、R3F v9、Zustand store（干净架构）

---

## 一、组件定位

`G1Humanoid` 是数字孪生模块中**最复杂的机器人渲染组件**，负责：

1. **加载 URDF 模型**（29 DOF，含双腿 12 + 双臂 14 + 腰部 2 + 颈部 1）
2. **关节级驱动**：每帧从 `RobotStateContext` 读取 `joints`，映射到 URDF 关节树
3. **坐标系转换**：URDF（Z-up）→ Three.js（Y-up）
4. **HUD 信息锚定**：电量、状态、关节数等信息跟随机器人世界坐标
5. **降级兜底**：模型未加载/加载失败时显示占位几何体

---

## 二、URDF 资源准备

### 2.1 下载官方资源

```bash
# 推荐：orikuma/g1_description（含完整 mesh）
git clone https://github.com/orikuma/g1_description.git /tmp/g1

# 备选：宇树官方 unitree_ros
git clone https://github.com/unitreerobotics/unitree_ros.git /tmp/unitree_ros
```

### 2.2 拷贝到项目

```bash
# 在 robot-ops-solo 根目录执行
mkdir -p apps/web-console/public/models/g1
cp /tmp/g1/urdf/g1_29dof.urdf apps/web-console/public/models/g1/
cp -r /tmp/g1/meshes           apps/web-console/public/models/g1/
```

最终目录结构：

```
apps/web-console/public/models/g1/
├── g1_29dof.urdf
└── meshes/
    ├── trunk.stl
    ├── hip.stl
    ├── thigh.stl
    ├── calf.stl
    ├── foot.stl
    ├── shoulder.stl
    ├── upper_arm.stl
    ├── forearm.stl
    ├── hand.stl
    └── ...（其余 STL）
```

### 2.3 变体选择

| URDF 文件 | DOF | 适用场景 |
|-----------|-----|---------|
| `g1_23dof.urdf` | 23 | 固定腰部，入门演示 |
| **`g1_29dof.urdf`** | **29** | **推荐：腰部+手腕完整，演示效果最佳** |
| `g1_29dof_with_hand.urdf` | 29 + 灵巧手 | 抓取场景 |

> ⚠️ **本组件默认加载 `g1_29dof.urdf`**，如需切换，修改 `URDF_PATH` 常量。

---

## 三、依赖安装

```bash
# digital-twin 包内
pnpm --filter digital-twin add three-urdf urdf-loader

# 确保 three 版本兼容（urdf-loader 建议 three@0.162.0）
pnpm --filter digital-twin add three@0.162.0
```

`package.json` 关键依赖：

```json
{
  "dependencies": {
    "three": "0.162.0",
    "@react-three/fiber": "^9.0.0",
    "@react-three/drei": "^10.0.0",
    "three-urdf": "^1.0.0",
    "urdf-loader": "^0.11.0"
  }
}
```

---

## 四、完整组件代码

> **说明**：以下是 `G1Humanoid.tsx` 的完整实现，可直接替换现有文件。
> 采用 `three-urdf`（自动处理 Z-up → Y-up）+ Context 读取状态（干净架构）。

```tsx
/**
 * G1Humanoid.tsx
 * 宇树 G1 29 DOF 人形机器人数字孪生组件
 */
import { Canvas, useFrame } from '@react-three/fiber'
import {
  OrbitControls,
  Environment,
  Grid,
  Html,
  Center,
  Stage,
} from '@react-three/drei'
import {
  parseURDF,
  loadRobot,
  type URDFRobot,
} from 'three-urdf'
import { Suspense, useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'

import { useRobotState } from '../../hooks/useRobotState'
import type { UnifiedRobotState } from 'robot-adapter-kit'

// ─── 常量 ────────────────────────────────────────────
const URDF_PATH = '/models/g1/g1_29dof.urdf'
const PACKAGE_MAP = { robot_description: '/models/g1' }

const ENV_PRESET: 'warehouse' | 'city' | 'night' = 'warehouse'
const CAMERA_POSITION: [number, number, number] = [2, 1.5, 2]
const AUTO_ROTATE_SPEED = 0.5

// 关节名 → 旋转轴映射（URDF 约定推断）
// 详见附录 B
const JOINT_AXIS_OVERRIDE: Record<string, 'x' | 'y' | 'z'> = {
  'left_hip_pitch_joint': 'x',
  'right_hip_pitch_joint': 'x',
  'left_knee_joint': 'x',
  'right_knee_joint': 'x',
  'left_hip_roll_joint': 'z',
  'right_hip_roll_joint': 'z',
  'left_hip_yaw_joint': 'y',
  'right_hip_yaw_joint': 'y',
  'left_shoulder_pitch_joint': 'x',
  'right_shoulder_pitch_joint': 'x',
  'left_shoulder_roll_joint': 'z',
  'right_shoulder_roll_joint': 'z',
  'left_elbow_joint': 'x',
  'right_elbow_joint': 'x',
  'left_wrist_roll_joint': 'z',
  'right_wrist_roll_joint': 'z',
  'waist_yaw_joint': 'y',
  'waist_pitch_joint': 'x',
  'neck_pitch_joint': 'x',
}

// ─── 内部：URDF 加载与关节驱动 ────────────────────────
interface G1ModelProps {
  robotId: string
  joints?: Record<string, number>
  onLoaded?: (robot: URDFRobot) => void
}

function G1Model({ robotId, joints, onLoaded }: G1ModelProps) {
  const [robot, setRobot] = useState<URDFRobot | null>(null)
  const groupRef = useRef<THREE.Group>(null!)

  // 加载 URDF（仅一次）
  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const res = await fetch(URDF_PATH)
        const urdfText = await res.text()
        const model = parseURDF(urdfText, { packageMap: PACKAGE_MAP })
        const obj = await loadRobot(model, {
          // three-urdf 自动处理 Z-up → Y-up
          upAxis: 'y',
        })
        if (!cancelled) {
          setRobot(obj)
          onLoaded?.(obj)
        }
      } catch (err) {
        console.error('[G1Humanoid] URDF 加载失败:', err)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [onLoaded])

  // 每帧驱动关节
  useFrame(() => {
    if (!robot || !joints) return
    try {
      robot.setJointValues(joints)
    } catch (err) {
      // 忽略单帧非法值，避免崩溃
    }
  })

  if (!robot) {
    // 降级：占位几何体（躯干 + 头）
    return (
      <group ref={groupRef}>
        <mesh castShadow>
          <capsuleGeometry args={[0.15, 0.5, 8, 16]} />
          <meshStandardMaterial color="#3b82f6" wireframe />
        </mesh>
        <mesh position={[0, 0.45, 0]} castShadow>
          <sphereGeometry args={[0.12, 16, 16]} />
          <meshStandardMaterial color="#60a5fa" wireframe />
        </mesh>
      </group>
    )
  }

  return <primitive ref={groupRef} object={robot} castShadow receiveShadow />
}

// ─── 主组件 ──────────────────────────────────────────
export interface G1HumanoidProps {
  robotId: string
  /** 是否显示 HUD 标签 */
  showHUD?: boolean
  /** 是否自动旋转 */
  autoRotate?: boolean
  /** 环境光预设 */
  environment?: 'warehouse' | 'city' | 'night'
  /** 模型加载完成回调 */
  onLoaded?: (robot: URDFRobot) => void
  /** 自定义 URDF 路径（覆盖默认） */
  urdfPath?: string
  /** 自定义 package 映射 */
  packageMap?: Record<string, string>
}

export function G1Humanoid({
  robotId,
  showHUD = true,
  autoRotate = true,
  environment = ENV_PRESET,
  onLoaded,
  urdfPath = URDF_PATH,
  packageMap = PACKAGE_MAP,
}: G1HumanoidProps) {
  // 从 Context 读取状态（干净架构，不直接依赖 web-console）
  const state = useRobotState(robotId)

  return (
    <Canvas
      shadows
      dpr={[1, 2]}
      camera={{ position: CAMERA_POSITION, fov: 50 }}
      gl={{ antialias: true, alpha: false }}
    >
      {/* 背景 */}
      <color attach="background" args={['#0a0e1a']} />

      {/* 光照 */}
      <Environment preset={environment} />
      <ambientLight intensity={0.4} />
      <directionalLight
        position={[5, 10, 5]}
        intensity={1.2}
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
      />

      {/* 地面网格 */}
      <Grid
        args={[10, 10]}
        cellColor="#1a2235"
        sectionColor="#00f0ff"
        sectionThickness={1.2}
        cellThickness={0.6}
        fadeDistance={20}
        fadeStrength={1}
        followCamera={false}
        infiniteGrid
      />

      <Suspense fallback={null}>
        <Center>
          <G1Model
            robotId={robotId}
            joints={state?.joints}
            onLoaded={onLoaded}
          />
        </Center>
      </Suspense>

      {/* HUD 标签（锚定在头顶） */}
      {showHUD && state && <RobotHUD robotId={robotId} state={state} />}

      {/* 轨道控制 */}
      <OrbitControls
        enablePan={false}
        minDistance={1}
        maxDistance={6}
        autoRotate={autoRotate}
        autoRotateSpeed={AUTO_ROTATE_SPEED}
        target={[0, 0.9, 0]}
      />
    </Canvas>
  )
}

// ─── HUD 信息标签 ────────────────────────────────────
interface RobotHUDProps {
  robotId: string
  state: UnifiedRobotState
}

function RobotHUD({ robotId, state }: RobotHUDProps) {
  const statusColor = useMemo(() => {
    switch (state.status) {
      case 'error':
        return '#ff3d71'
      case 'moving':
        return '#00f0ff'
      case 'charging':
        return '#fbbf24'
      default:
        return '#00e676'
    }
  }, [state.status])

  return (
    <Html
      position={[0, 1.6, 0]}
      center
      distanceFactor={8}
      occlude={false}
      style={{ pointerEvents: 'none' }}
    >
      <div
        style={{
          background: 'rgba(10, 14, 26, 0.85)',
          border: `1px solid ${statusColor}`,
          borderRadius: 6,
          padding: '6px 10px',
          fontFamily: 'JetBrains Mono, monospace',
          fontSize: 11,
          color: '#e2e8f0',
          whiteSpace: 'nowrap',
          boxShadow: `0 0 12px ${statusColor}33`,
        }}
      >
        <div style={{ color: statusColor, fontWeight: 600 }}>
          {robotId} · {state.status}
        </div>
        <div>BAT {state.batteryPct.toFixed(0)}% · {state.voltage.toFixed(1)}V</div>
        <div>
          POS {state.position.x.toFixed(2)}, {state.position.y.toFixed(2)}
        </div>
        <div style={{ opacity: 0.7 }}>
          DOF {Object.keys(state.joints ?? {}).length}/29
        </div>
      </div>
    </Html>
  )
}

// ─── 关节轴工具（开发调试用） ────────────────────────
export function getJointAxis(jointName: string): 'x' | 'y' | 'z' {
  return JOINT_AXIS_OVERRIDE[jointName] ?? 'z'
}

export default G1Humanoid
```

---

## 五、关节驱动原理

### 5.1 数据流

```
WebSocket/MQTT
   ↓
wsHub（唯一写入点）
   ↓
RobotStateContext（Zustand）
   ↓
useRobotState(robotId)        ← G1Humanoid 只读
   ↓
state.joints: Record<string, number>
   ↓
useFrame → robot.setJointValues(joints)
   ↓
URDF 关节树旋转 → 视觉更新
```

### 5.2 坐标系转换

| 系统 | 上轴 | 说明 |
|------|------|------|
| URDF（ROS） | **Z-up** | 机器人描述标准 |
| Three.js / R3F | **Y-up** | 图形学标准 |

`three-urdf` 的 `loadRobot(model, { upAxis: 'y' })` **自动处理转换**，无需手动 `rotateX(-PI/2)`。
若改用 `urdf-loader`，需在加载后手动旋转：

```ts
urdf.rotateX(-Math.PI / 2)
```

### 5.3 关节名映射约定

URDF 关节命名遵循 **`{肢体}_{部位}_{类型}_joint`** 模式，轴推断规则：

| 关键词 | 旋转轴 |
|--------|--------|
| `hip_pitch` / `knee` / `shoulder_pitch` / `elbow` / `waist_pitch` / `neck_pitch` | **x** |
| `hip_yaw` / `waist_yaw` | **y** |
| `hip_roll` / `shoulder_roll` / `wrist_roll` | **z** |

完整映射见 `JOINT_AXIS_OVERRIDE`（第四节代码内）。

> 💡 **若实际 URDF 关节名不同**，打开 `g1_29dof.urdf` 搜索 `<joint name="...">`，对照 `<axis xyz="..."/>` 修正映射表。

---

## 六、集成方式

### 6.1 在 TwinPage 中使用

```tsx
// apps/web-console/src/routes/TwinPage.tsx
import { G1Humanoid } from 'digital-twin'

export function TwinPage() {
  return (
    <div style={{ width: '100%', height: '100vh' }}>
      <G1Humanoid
        robotId="g1-001"
        showHUD
        autoRotate
        environment="warehouse"
        onLoaded={(robot) => {
          console.log('[TwinPage] G1 加载完成，关节数:', robot.joints?.length)
        }}
      />
    </div>
  )
}
```

### 6.2 配合 mock-ws-server

确保 mock 推送 `/joint_states` 话题，字段形如：

```json
{
  "topic": "/joint_states",
  "data": {
    "position": {
      "left_hip_pitch_joint": 0.1,
      "right_hip_pitch_joint": 0.1,
      "left_knee_joint": -0.2,
      "right_knee_joint": -0.2,
      "left_shoulder_pitch_joint": 0.3,
      "right_shoulder_pitch_joint": 0.3,
      "waist_yaw_joint": 0.05,
      "neck_pitch_joint": 0.1
    }
  }
}
```

`wsHub` 将其转换为 `UnifiedRobotState.joints`，`G1Humanoid` 自动驱动。

### 6.3 与干净架构的对接

```
packages/
├── store/                    # 共享 Zustand store + Context
│   └── src/
│       ├── RobotStateContext.tsx   ← G1Humanoid 只依赖此 Context
│       └── createRobotStore.ts
├── digital-twin/
│   └── src/
│       ├── hooks/useRobotState.ts  ← 从 Context 读取
│       └── robots/G1Humanoid.tsx   ← 本组件
└── web-console/
    └── src/
        ├── App.tsx                 ← 根组件包 <RobotStateProvider>
        └── lib/wsHub.ts            ← 唯一写入点
```

`useRobotState` 实现（干净做法）：

```ts
// packages/digital-twin/src/hooks/useRobotState.ts
import { useContext, useMemo } from 'react'
import { RobotStateContext } from 'store'

export function useRobotState(robotId: string) {
  const store = useContext(RobotStateContext)
  return useMemo(() => store.getState().robots[robotId], [store, robotId])
}
```

> `digital-twin` **不 import 任何 web-console 代码**，仅依赖 `store` 包的 Context。

---

## 七、性能优化

| 策略 | 实现位置 | 说明 |
|------|---------|------|
| DPR 限制 | `<Canvas dpr={[1, 2]}>` | 避免 4K 屏过度渲染 |
| `useFrame` 只读 | `G1Model` | 每帧不创建新对象，只 `setJointValues` |
| `Suspense` 边界 | `<Center><G1Model/></Center>` | 异步加载不阻塞 UI |
| 降级占位 | `if (!robot)` | 加载失败不白屏 |
| `InfiniteGrid` | `<Grid infiniteGrid>` | Drei 优化的大场景网格 |
| `castShadow` 选择性 | 仅机器人主体 | 减少 shadow map 开销 |
| `Html distanceFactor` | HUD | 远近缩放，避免标签过大 |

**性能预算目标**：

| 指标 | 目标值 |
|------|--------|
| 帧率 | ≥ 60 fps |
| Draw calls | < 200 |
| 三角面数 | < 500K |
| 首帧时间 | < 3s |

---

## 八、分步实施（总计约 3-4 小时）

| 步骤 | 内容 | 耗时 | 验证点 |
|------|------|------|--------|
| 1 | 下载 URDF + meshes 到 `public/models/g1/` | 20min | 文件存在 |
| 2 | 安装 `three-urdf` + 锁 `three@0.162.0` | 10min | `pnpm install` 成功 |
| 3 | 替换 `G1Dog.tsx` → `G1Humanoid.tsx` | 30min | TS 编译通过 |
| 4 | 在 TwinPage 引入 `<G1Humanoid robotId="g1-001" />` | 20min | 页面能打开 |
| 5 | 运行 mock-ws-server，推 `/joint_states` | 20min | 看到占位几何体动 |
| 6 | 验证 URDF 加载（打开 DevTools Network） | 20min | `g1_29dof.urdf` 200 |
| 7 | 校准关节轴映射（对照 URDF `<axis>`） | 30min | 关节旋转方向正确 |
| 8 | 调整 HUD 样式 + 环境光预设 | 20min | 视觉达标 |
| 9 | 录 30 秒演示视频 | 10min | 关节级驱动可见 |
| 10 | 跑 `npx madge --circular` 验证无循环依赖 | 10min | 输出为空 |

---

## 九、验证清单

- [ ] URDF 文件位于 `public/models/g1/g1_29dof.urdf`
- [ ] meshes 目录完整（所有 STL 可访问，无 404）
- [ ] `three` 版本锁定 `0.162.0`
- [ ] `G1Humanoid.tsx` 编译无 TS 错误
- [ ] 页面打开显示机器人（或占位几何体）
- [ ] mock 推 `/joint_states` 后，机器人关节随之运动
- [ ] HUD 标签显示正确的 robotId / 电量 / 坐标 / DOF
- [ ] 坐标系正确（机器人站立，非躺倒）
- [ ] OrbitControls 可拖拽旋转/缩放
- [ ] 无 console error
- [ ] `madge --circular` 无循环依赖

---

## 十、常见问题

| 问题 | 原因 | 解决方案 |
|------|------|---------|
| 模型 404 | 路径错误 | 确认 `public/models/g1/` 且 Vite 能访问 |
| 机器人躺倒 | 坐标系未转换 | 确认 `three-urdf` 的 `upAxis:'y'` 或手动 `rotateX(-PI/2)` |
| 关节不动 | 关节名不匹配 | 对照 URDF `<joint>` 名修正 `JOINT_AXIS_OVERRIDE` |
| 关节反向 | 轴推断错误 | 在映射表中将该关节改为正确轴（x/y/z） |
| 低 FPS | mesh 面数过高 | 使用 decimated 版本或 LOD |
| HUD 穿透 | `occlude` 设置 | 调整 `distanceFactor` 或 `occlude` |
| Three 版本冲突 | hoist 问题 | 锁 `0.162.0`，`.npmrc` 加 `public-hoist-pattern=[]` |

---

## 附录 A：URDF 获取渠道

| 来源 | 地址 | 说明 |
|------|------|------|
| orikuma/g1_description | https://github.com/orikuma/g1_description | 推荐，含完整 mesh |
| unitreerobotics/unitree_ros | https://github.com/unitreerobotics/unitree_ros | 官方，含 12+ 变体 |
| mujoco_menagerie | https://github.com/google-deepmind/mujoco_menagerie | G1 37DoF 高精度 |
| ROS-Industrial | https://github.com/ros-industrial | 通用工业机器人 URDF |

---

## 附录 B：完整关节轴映射（29 DOF）

```
双腿（12）：
  left/right_hip_pitch_joint  → x
  left/right_hip_roll_joint   → z
  left/right_hip_yaw_joint    → y
  left/right_knee_joint       → x
  （脚踝通常为固定或 2 DOF，视 URDF 而定）

双臂（14）：
  left/right_shoulder_pitch_joint → x
  left/right_shoulder_roll_joint  → z
  left/right_elbow_joint          → x
  left/right_wrist_pitch_joint    → x（若 URDF 有）
  left/right_wrist_yaw_joint      → y
  left/right_wrist_roll_joint     → z

腰部（2）：
  waist_yaw_joint   → y
  waist_pitch_joint → x

颈部（1）：
  neck_pitch_joint → x
```

> 实际以 `g1_29dof.urdf` 为准，若名称不同请调整 `JOINT_AXIS_OVERRIDE`。

---

## 附录 C：与 G1Dog.tsx 的对照

| 维度 | G1Dog.tsx（旧） | G1Humanoid.tsx（新） |
|------|----------------|---------------------|
| 模型类型 | GLB（四足狗） | URDF（人形 29 DOF） |
| 加载器 | `useGLTF` | `three-urdf` |
| 关节驱动 | 手动骨骼遍历 | `setJointValues` 自动 |
| 坐标系 | 已适配 | `three-urdf` 自动转换 |
| DOF | 低（4-6） | **29** |
| 复杂度 | 入门级 | **生产级** |
| HUD | 无 | 内置 Html 标签 |

---

## 附录 D：未来扩展

- [ ] **多机同屏**：`Instances` 渲染 fleet，每个机器人独立关节状态
- [ ] **轨迹回放**：记录 joints 时间序列，`useFrame` 插值播放
- [ ] **SOP 联动**：SOP 执行时高亮当前节点对应的关节
- [ ] **碰撞检测**：接入 `collision.ts`，虚拟墙/障碍
- [ ] **XR 支持**：WebXR 沉浸式操控
- [ ] **GLB 兜底**：URDF 加载失败时切换低精度 GLB

---

**文档结束。按照第八节步骤执行，即可在 3-4 小时内将方块狗升级为关节级驱动的真人形机器人数字孪生。**
