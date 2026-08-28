# 宇树 G1 完全还原优化开发文档

> **目标**：将当前"方块占位"机器人，升级为 100% 等比例还原的宇树 G1 人形机器人数字孪生
> **覆盖范围**：① 模型替换（URDF + GLB）→ ② 等比例与坐标系校验 → ③ 场景与环境渲染升级
> **定位**：`robot-ops-solo-UNITREE-SCALE.md`（等比例规范）+ `G1-HUMANOID.md`（组件代码）的**落地执行手册**
> **版本**：v1.0 | 2026-03

---

## 一、优化总览

### 1.1 当前问题诊断

根据截图，当前 `digital-twin` 处于**降级占位模式**：

| 维度 | 当前表现 | 问题根因 |
|------|---------|---------|
| **模型** | 头部蓝色半球 + 身体灰白方块 + 腿部深蓝柱体 | 未加载真实 URDF/GLB，使用 `THREE.BoxGeometry` / `SphereGeometry` 拼接 |
| **比例** | 躯干方块过大，四肢比例失调 | 手工设定的固定尺寸，非真实 URDF 数据 |
| **姿态** | T-Pose 站立 | 无关节角驱动，`setJointValues` 未接入 |
| **场景** | 灰色立方体迷宫 + 平淡光照 | 临时 `Floor` + 默认灯光 |
| **HUD** | 左上状态 + 左下雷达 + 底部状态机 | 2D 叠加，未锚定 3D 空间 |

### 1.2 优化目标（三步到位）

```
Step 1: 模型替换  → 真实 URDF + STL mesh 加载
Step 2: 等比例校验 → 单位/坐标系/包围盒高度 1.30m
Step 3: 场景升级  → PBR 环境 + 阴影 + 轨迹线 + HUD 空间锚定
```

### 1.3 完成标准（对应 `UNITREE-SCALE.md` 第九节校验清单）

- [ ] **L1 几何**：`Box3` 量取身高 = **1.30m ± 0.05m**
- [ ] **L1 几何**：肩宽 = **0.42m ± 0.02m**
- [ ] **L2 视觉**：真实 mesh 渲染（非方块），金属质感 + 自发光
- [ ] **L3 运动学**：29 DOF 关节可被 `setJointValues` 驱动
- [ ] **场景**：HDRI 环境 + 地面网格 + 模型投射阴影
- [ ] **HUD**：头部锚定 + 状态机高亮当前状态

---

## 二、Step 1：模型替换（URDF + GLB 双路线）

### 2.1 资源获取

```bash
# 官方源（unitreerobotics）
git clone https://github.com/unitreerobotics/unitree_ros.git /tmp/unitree_ros

# 社区维护源（推荐，含完整 mesh）
git clone https://github.com/orikuma/g1_description.git /tmp/g1_description
```

**拷贝到项目**：

```bash
# 在 apps/web-console/public/models/ 下建立 g1 目录
mkdir -p apps/web-console/public/models/g1/meshes

# 拷贝 URDF
cp /tmp/g1_description/urdf/g1_29dof.urdf \
   apps/web-console/public/models/g1/

# 拷贝视觉 mesh（STL/DAE，高精度）
cp -r /tmp/g1_description/meshes/visual/* \
      apps/web-console/public/models/g1/meshes/

# 确认目录结构
ls -R apps/web-console/public/models/g1/
# g1_29dof.urdf
# meshes/
#   ├── base_link_visual.stl
#   ├── left_hip_yaw_link_visual.stl
#   ├── left_knee_link_visual.stl
#   └── ... (29 个关节对应 mesh)
```

### 2.2 依赖安装

```bash
# digital-twin 包
pnpm --filter digital-twin add three-urdf urdf-loader

# three 版本锁定（urdf-loader 兼容要求）
pnpm --filter digital-twin add three@0.162.0
```

> ⚠️ **版本锁定**：`urdf-loader` 在 Three.js ≥ 0.184 与 Vite 存在 TDZ 问题，必须锁 `0.162.0`。

### 2.3 方案 A：URDF 路线（推荐，可关节驱动）

**`packages/digital-twin/src/robots/G1Humanoid.tsx`**：

```tsx
import { Canvas, useFrame } from '@react-three/fiber'
import { OrbitControls, Environment, Grid, Html } from '@react-three/drei'
import { parseURDF, loadRobot, type URDFRobot } from 'three-urdf'
import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { useRobotState } from '../../hooks/useRobotState'

interface G1HumanoidProps {
  robotId: string
  urdfUrl?: string
}

/**
 * URDF 加载器：负责拉取 + 解析 + 自动 Z-up → Y-up 转换
 */
function G1Model({ urdfUrl, onLoaded }: {
  urdfUrl: string
  onLoaded: (robot: URDFRobot) => void
}) {
  const [robot, setRobot] = useState<URDFRobot | null>(null)

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const res = await fetch(urdfUrl)
        const urdfText = await res.text()

        // 关键：packageMap 映射 package:// 路径 → 本地 /models/g1/
        const model = parseURDF(urdfText, {
          packageMap: { g1_description: '/models/g1' }
        })

        // three-urdf 自动处理：
        //   ✅ STL mesh 缩放（mm → m，依据 URDF 内 scale 属性）
        //   ✅ Z-up → Y-up 坐标转换（upAxis: 'y'）
        //   ✅ 关节层级树构建
        const obj = await loadRobot(model, { upAxis: 'y' })

        if (!cancelled) {
          setRobot(obj)
          onLoaded(obj)
        }
      } catch (err) {
        console.error('[G1Humanoid] URDF 加载失败:', err)
      }
    }
    load()
    return () => { cancelled = true }
  }, [urdfUrl, onLoaded])

  return robot ? <primitive object={robot} /> : null
}

/**
 * 关节驱动：每帧从 Zustand 读取 joints，驱动 URDF 关节树
 */
function useJointDrive(
  robot: URDFRobot | null,
  robotId: string
) {
  useFrame(() => {
    if (!robot) return
    const state = useRobotState(robotId)
    const joints = state?.joints
    if (joints) {
      // setJointValues 批量设置所有关节角（弧度）
      robot.setJointValues(joints)
    }
  })
}

/**
 * 主组件：Canvas + 环境 + 机器人 + HUD
 */
export function G1Humanoid({
  robotId,
  urdfUrl = '/models/g1/g1_29dof.urdf'
}: G1HumanoidProps) {
  const [robot, setRobot] = useState<URDFRobot | null>(null)
  const robotState = useRobotState(robotId)

  useJointDrive(robot, robotId)

  return (
    <Canvas
      shadows
      dpr={[1, 2]}
      camera={{ position: [2, 1.5, 2], fov: 50 }}
    >
      {/* 背景色（科技感深蓝黑） */}
      <color attach="background" args={['#0a0e1a']} />

      {/* 环境光照（PBR 金属质感关键） */}
      <Environment preset="warehouse" />

      {/* 定向光 + 阴影 */}
      <directionalLight
        position={[5, 10, 5]}
        intensity={1.2}
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
      />
      <ambientLight intensity={0.3} />

      {/* 地面网格 */}
      <Grid
        args={[10, 10]}
        cellColor="#1a2235"
        sectionColor="#00f0ff"
        fadeDistance={20}
        infiniteGrid
      />

      {/* 机器人本体 */}
      <group position={[0, 0, 0]}>
        <G1Model
          urdfUrl={urdfUrl}
          onLoaded={setRobot}
        />

        {/* HUD：锚定在头部上方 2D HTML */}
        {robotState && (
          <Html
            position={[0, 1.6, 0]}
            center
            distanceFactor={10}
            occlude
          >
            <div className="g1-hud">
              <div className="g1-hud__title">
                {robotState.robotId} · unitree g1
              </div>
              <div className="g1-hud__status">
                <span className={`dot dot--${robotState.status}`} />
                {robotState.status.toUpperCase()}
              </div>
              <div className="g1-hud__battery">
                🔋 {robotState.batteryPct.toFixed(1)}%
              </div>
              <div className="g1-hud__dof">
                DOF: {Object.keys(robotState.joints || {}).length}/29
              </div>
            </div>
          </Html>
        )}
      </group>

      {/* 轨道控制 */}
      <OrbitControls
        enablePan={false}
        minDistance={1}
        maxDistance={5}
        autoRotate
        autoRotateSpeed={0.3}
      />
    </Canvas>
  )
}
```

### 2.4 方案 B：GLB 路线（视觉还原，可选叠加）

> 当厂商提供 GLB（照片级 PBR）时，用 `useGLTF` 加载，与 URDF 并存。

```tsx
import { useGLTF } from '@react-three/drei'

function G1VisualGLB() {
  const { scene } = useGLTF('/models/g1/g1_visual.glb')

  useEffect(() => {
    // 开启阴影
    scene.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        child.castShadow = true
        child.receiveShadow = true
      }
    })
  }, [scene])

  return <primitive object={scene} />
}

// 预加载（防闪烁）
useGLTF.preload('/models/g1/g1_visual.glb')
```

**混合架构**（终极）：
- URDF 做**运动学真源**（`three-urdf` + `setJointValues`）
- GLB 做**视觉表现层**（`useGLTF` + Draco 压缩）
- 关节名 → GLB 骨骼名映射，每帧同步

---

## 三、Step 2：等比例与坐标系校验

### 3.1 包围盒校验（L1 几何，唯一权威判据）

**在 `G1Humanoid.tsx` 加载完成后立即执行**：

```ts
import * as THREE from 'three'

/**
 * 校验机器人等比例：身高 + 肩宽 + 各肢体长度
 */
export function validateScale(robot: THREE.Object3D) {
  const box = new THREE.Box3().setFromObject(robot)
  const size = new THREE.Vector3()
  box.getSize(size)

  const height = size.y
  const width = size.x
  const depth = size.z

  // 官方规格（宇树 G1 29 DOF）
  const EXPECTED = {
    height: 1.30,   // 身高 1.30m
    shoulderWidth: 0.42,  // 肩宽 0.42m
    tolerance: 0.05
  }

  const checks = {
    height: Math.abs(height - EXPECTED.height) < EXPECTED.tolerance,
    width: Math.abs(width - EXPECTED.shoulderWidth) < EXPECTED.tolerance,
  }

  console.table({
    '实际身高(m)': height.toFixed(3),
    '期望身高(m)': EXPECTED.height,
    '身高校验': checks.height ? '✅ PASS' : '❌ FAIL',
    '实际肩宽(m)': width.toFixed(3),
    '期望肩宽(m)': EXPECTED.shoulderWidth,
    '肩宽校验': checks.width ? '✅ PASS' : '❌ FAIL',
    '深度(m)': depth.toFixed(3),
  })

  if (!checks.height || !checks.width) {
    console.error(
      '🚨 等比例校验失败！请检查 URDF mesh scale 与单位转换'
    )
  }

  return checks
}
```

**集成到加载回调**：

```tsx
<G1Model
  urdfUrl={urdfUrl}
  onLoaded={(robot) => {
    setRobot(robot)
    // 关键：加载完成后立即校验
    validateScale(robot)
  }}
/>
```

### 3.2 单位与坐标系转换（头号坑）

#### 3.2.1 URDF 内 mesh 缩放

打开 `g1_29dof.urdf`，检查每个 `<mesh>` 标签：

```xml
<!-- ✅ 正确：CAD 导出 STL 为毫米，URDF 需 0.001 缩放 -->
<mesh filename="package://g1_description/meshes/visual/base_link_visual.stl"
      scale="0.001 0.001 0.001" />

<!-- ❌ 错误：缺少 scale → 机器人放大 1000 倍 -->
<mesh filename="package://g1_description/meshes/visual/base_link_visual.stl" />
```

> **规则**：所有来自 CAD（SolidWorks/Fusion 360/FreeCAD）的 STL 默认**毫米**，URDF 世界是**米**，必须 `scale="0.001 0.001 0.001"`。

#### 3.2.2 Z-up → Y-up 转换

| 加载方式 | 转换方式 |
|---------|---------|
| `three-urdf` | `loadRobot(model, { upAxis: 'y' })` **自动转换** ✅ |
| `urdf-loader` | 手动 `robot.rotateX(-Math.PI / 2)` ⚠️ |

**推荐 `three-urdf`**，避免手动旋转导致的"躺倒"问题。

#### 3.2.3 原点位置

机器人**脚底应在 Y=0 平面**，头顶在正 Y 方向：

```ts
// 校验原点（脚底是否在地面）
const box = new THREE.Box3().setFromObject(robot)
if (box.min.y > 0.01 || box.min.y < -0.01) {
  console.warn('⚠️ 原点偏移，脚底不在地面:', box.min.y)
  // 可通过 group.position.y = -box.min.y 修正
}
```

### 3.3 关节轴映射校验（L3 运动学）

**`JOINT_AXIS_OVERRIDE` 推断表**（基于命名约定）：

```ts
/**
 * 关节名 → 旋转轴映射（校准用）
 * 实际以 URDF 内 <axis xyz="..."/> 为准
 */
export const JOINT_AXIS_OVERRIDE: Record<string, 'x' | 'y' | 'z'> = {
  // 腿部（矢状面弯曲 → X 轴）
  'left_hip_pitch': 'x',
  'left_knee': 'x',
  'right_hip_pitch': 'x',
  'right_knee': 'x',

  // 髋部旋转（Y 轴）
  'left_hip_yaw': 'y',
  'right_hip_yaw': 'y',

  // 侧摆（Z 轴）
  'left_hip_roll': 'z',
  'right_hip_roll': 'z',

  // 手臂（肩部复合 → Y，肘部 → X）
  'left_shoulder_pitch': 'x',
  'left_shoulder_yaw': 'y',
  'left_shoulder_roll': 'z',
  'left_elbow': 'x',
  'right_shoulder_pitch': 'x',
  'right_shoulder_yaw': 'y',
  'right_shoulder_roll': 'z',
  'right_elbow': 'x',

  // 腰部（Y 轴扭转）
  'waist_yaw': 'y',
  'waist_pitch': 'x',
}
```

**校验流程**：
1. 加载完成后打印 `robot.joints` 所有关节名
2. 对照 URDF 内 `<axis xyz>` 逐一校准 `JOINT_AXIS_OVERRIDE`
3. 推送 mock 关节角数据，观察 3D 模型运动是否符合预期
4. 反向/错位关节在映射表中修正

### 3.4 RViz 交叉验证（可选，最高权威）

```bash
# ROS 环境
roslaunch urdf_tutorial display.launch.py model:=/path/to/g1_29dof.urdf
```

在 RViz 中确认：
- 模型尺寸与真实 G1 一致
- 各关节运动方向正确
- 坐标系 (base_link) 朝向正确

---

## 四、Step 3：场景与环境渲染升级

### 4.1 环境光照（PBR 金属质感）

```tsx
<Canvas shadows dpr={[1, 2]}>
  {/* 物理正确的环境贴图（HDRI） */}
  <Environment preset="warehouse" />

  {/* 主光源（投射阴影） */}
  <directionalLight
    position={[5, 10, 5]}
    intensity={1.5}
    castShadow
    shadow-mapSize={[2048, 2048]}
    shadow-camera-near={0.5}
    shadow-camera-far={50}
    shadow-camera-left={-10}
    shadow-camera-right={10}
    shadow-camera-top={10}
    shadow-camera-bottom={-10}
  />

  {/* 补光（柔化阴影） */}
  <directionalLight position={[-5, 5, -5]} intensity={0.5} />

  {/* 环境光（基础照明） */}
  <ambientLight intensity={0.3} />
</Canvas>
```

> `Environment preset="warehouse"` 提供基于图像的照明（IBL），是金属/塑料材质呈现真实质感的关键。

### 4.2 地面与网格

```tsx
import { Grid } from '@react-three/drei'

{/* 科技感无限网格 */}
<Grid
  args={[20, 20]}           // 尺寸
  cellSize={0.5}            // 单元格大小
  cellThickness={0.5}       // 单元格线宽
  cellColor="#1a2235"       // 单元格颜色
  sectionSize={2}           // 分节大小
  sectionThickness={1}      // 分节线宽
  sectionColor="#00f0ff"    // 分节颜色（青蓝霓虹）
  fadeDistance={25}         // 淡出距离
  fadeStrength={1}          // 淡出强度
  followCamera={false}      // 不跟随相机
  infiniteGrid             // 无限延伸
/>
```

### 4.3 模型阴影设置

```tsx
// 在 G1Model 加载完成后遍历 mesh
useEffect(() => {
  if (!robot) return
  robot.traverse((child) => {
    if ((child as THREE.Mesh).isMesh) {
      child.castShadow = true      // 投射阴影
      child.receiveShadow = true   // 接收阴影
    }
  })
}, [robot])
```

### 4.4 轨迹线升级（发光效果）

```tsx
import { useMemo } from 'react'

function GlowTrajectory({ points }: { points: THREE.Vector3[] }) {
  const geometry = useMemo(() => {
    const geo = new THREE.BufferGeometry().setFromPoints(points)
    return geo
  }, [points])

  return (
    <line>
      <primitive object={geometry} attach="geometry" />
      <lineBasicMaterial
        color="#00f0ff"
        transparent
        opacity={0.8}
        blending={THREE.AdditiveBlending}  // 加法混合（发光感）
        depthWrite={false}
      />
    </line>
  )
}
```

> `AdditiveBlending` 让轨迹线在深色背景上呈现自发光效果，契合科技感 HUD 风格。

### 4.5 HUD 样式（CSS）

```css
/* apps/web-console/src/styles/g1-hud.css */
.g1-hud {
  background: rgba(16, 23, 42, 0.75);
  backdrop-filter: blur(8px);
  border: 1px solid rgba(0, 240, 255, 0.3);
  border-radius: 8px;
  padding: 8px 12px;
  font-family: 'JetBrains Mono', monospace;
  font-size: 12px;
  color: #e2e8f0;
  pointer-events: none;
  white-space: nowrap;
  box-shadow: 0 0 12px rgba(0, 240, 255, 0.15);
}

.g1-hud__title {
  color: #00f0ff;
  font-weight: 600;
  margin-bottom: 4px;
}

.g1-hud__status {
  display: flex;
  align-items: center;
  gap: 6px;
}

.dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  display: inline-block;
}
.dot--idle { background: #00e676; }
.dot--moving { background: #00f0ff; }
.dot--working { background: #ffab00; }
.dot--charging { background: #7b61ff; }
.dot--error { background: #ff3d71; }

.g1-hud__battery,
.g1-hud__dof {
  margin-top: 2px;
  opacity: 0.85;
}
```

### 4.6 底部状态机（STATE MACHINE）

```tsx
// apps/web-console/src/components/overlays/StateMachine.tsx
const STATES = ['IDLE', 'MOVING', 'WORKING', 'CHARGING'] as const

export function StateMachine({ current }: { current: typeof STATES[number] }) {
  return (
    <div className="state-machine">
      {STATES.map((state, i) => (
        <div
          key={state}
          className={`state-step ${state === current ? 'state-step--active' : ''}`}
        >
          <div className="state-step__dot" />
          <span>{state}</span>
          {i < STATES.length - 1 && <div className="state-step__line" />}
        </div>
      ))}
    </div>
  )
}
```

```css
.state-machine {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0;
  padding: 12px 24px;
  background: rgba(10, 14, 26, 0.9);
  border-top: 1px solid rgba(0, 240, 255, 0.15);
}

.state-step {
  display: flex;
  align-items: center;
  opacity: 0.4;
  transition: opacity 0.3s, color 0.3s;
}
.state-step--active {
  opacity: 1;
  color: #00f0ff;
}
.state-step__dot {
  width: 10px; height: 10px;
  border-radius: 50%;
  border: 2px solid currentColor;
  margin-right: 6px;
}
.state-step--active .state-step__dot {
  background: #00f0ff;
  box-shadow: 0 0 8px #00f0ff;
}
.state-step__line {
  width: 40px; height: 2px;
  background: currentColor;
  margin: 0 8px;
}
```

---

## 五、分步实施清单（10 步，5-6 小时）

| 步骤 | 动作 | 验证点 | 耗时 |
|------|------|--------|------|
| **1** | 拷贝 `g1_description` 到 `public/models/g1/` | 目录结构正确 | 20min |
| **2** | 安装 `three-urdf` + 锁 `three@0.162.0` | `pnpm install` 无错 | 15min |
| **3** | 替换 `G1Dog.tsx` → `G1Humanoid.tsx`（本文 2.3 代码） | 编译通过 | 40min |
| **4** | 检查 URDF mesh `scale="0.001"` | 无放大/缩小 | 20min |
| **5** | 加载后运行 `validateScale()` | 控制台输出身高 1.30m ✅ | 20min |
| **6** | 校准 `JOINT_AXIS_OVERRIDE` | 关节运动方向正确 | 40min |
| **7** | 添加 `Environment` + `directionalLight` + `Grid` | 金属质感 + 网格地面 | 30min |
| **8** | 开启 `castShadow` / `receiveShadow` | 模型投射阴影 | 15min |
| **9** | 添加 `Html` HUD + 状态机组件 | 头部信息 + 底部状态高亮 | 40min |
| **10** | 推送 mock 关节数据，录屏 | 29 DOF 全驱动 + 轨迹线发光 | 30min |

---

## 六、验证清单（对照打勾）

### L1 几何等比例
- [ ] `Box3` 身高 = **1.30m ± 0.05m**
- [ ] 肩宽 = **0.42m ± 0.02m**
- [ ] 脚底在 Y=0 平面（原点正确）
- [ ] URDF mesh `scale="0.001 0.001 0.001"` 已设置

### L2 视觉还原
- [ ] 真实 mesh 渲染（非方块占位）
- [ ] PBR 材质 + 金属质感（Environment 生效）
- [ ] 模型投射 + 接收阴影
- [ ] 地面网格（青蓝霓虹分节）

### L3 运动学
- [ ] 29 DOF 关节可被 `setJointValues` 驱动
- [ ] `JOINT_AXIS_OVERRIDE` 已校准（无反向关节）
- [ ] 机器人站立姿态正确（非 T-Pose，非躺倒）

### 场景与 HUD
- [ ] HDRI 环境光照（warehouse preset）
- [ ] 轨迹线发光（AdditiveBlending）
- [ ] HUD 头部锚定（`Html` 跟随机器人）
- [ ] 状态机高亮当前状态

---

## 七、常见问题排查

| 现象 | 根因 | 解决方案 |
|------|------|---------|
| **机器人巨大（填满屏幕）** | STL 是 mm，URDF 未缩放 | 加 `scale="0.001 0.001 0.001"` |
| **机器人微小（如蚂蚁）** | scale 过度 | 改为 `1 1 1` 或检查 CAD 导出单位 |
| **机器人躺倒** | Z-up/Y-up 未转换 | `loadRobot(model, { upAxis: 'y' })` |
| **某些 link 错位** | CAD 坐标系与 ROS 不匹配 | 添加 `world` frame 做转换 |
| **关节不动** | 关节名不匹配 | 打印 `robot.joints` 对照 URDF |
| **mesh 全黑** | 缺少光照 / 材质未加载 | 添加 `Environment` + `directionalLight` |
| **HUD 穿透模型** | `Html occlude` 未设置 | 加 `occlude` 属性 |
| **TypeScript 报错** | `three-urdf` 类型缺失 | 安装 `@types/three` 或临时 `as any` |

---

## 八、与既有文档的关系

```
robot-ops-solo-UNITREE-SCALE.md    ← 等比例规范（L1/L2/L3 定义、规格表）
robot-ops-solo-G1-HUMANOID.md      ← 组件代码骨架（useState/useFrame 结构）
robot-ops-solo-3D-VIEW-CLEAN.md    ← 干净架构（store/Context 解耦）
robot-ops-solo-G1-FULL-RESTORE.md  ← 📍 本文（Step1/2/3 落地执行手册）
```

**职责边界**：
- `UNITREE-SCALE.md` = "为什么要等比例 + 标准是什么"
- `G1-HUMANOID.md` = "组件长什么样"
- `3D-VIEW-CLEAN.md` = "数据流怎么走（不依赖 web-console）"
- `G1-FULL-RESTORE.md` = "具体怎么改（本文）"

---

## 九、附录 A：完整目录变更

```
apps/web-console/public/models/
└── g1/
    ├── g1_29dof.urdf
    └── meshes/
        ├── base_link_visual.stl
        ├── left_hip_yaw_link_visual.stl
        ├── left_knee_link_visual.stl
        ├── left_shoulder_pitch_link_visual.stl
        ├── right_hip_yaw_link_visual.stl
        ├── right_knee_link_visual.stl
        └── ... (其余关节 mesh)

packages/digital-twin/src/
├── robots/
│   ├── G1Dog.tsx          ← 删除（占位）
│   └── G1Humanoid.tsx     ← 新建（本文 2.3 完整代码）
├── hooks/
│   └── useRobotState.ts   ← 从 store/Context 读取
└── index.ts               ← 导出 G1Humanoid

apps/web-console/src/
├── routes/
│   └── TwinPage.tsx       ← 引入 <G1Humanoid robotId="g1-001" />
├── components/
│   └── overlays/
│       └── StateMachine.tsx ← 新建（本文 4.6）
└── styles/
    └── g1-hud.css         ← 新建（本文 4.5）
```

## 附录 B：Mock 关节数据格式

`mock-ws-server.js` 推送的 `/joint_states` 消息：

```js
{
  topic: '/joint_states',
  data: {
    // key = URDF 关节名，value = 弧度（revolute）或 米（prismatic）
    'left_hip_pitch': 0.1,
    'left_hip_roll': 0.05,
    'left_hip_yaw': 0.0,
    'left_knee': 0.3,
    'left_shoulder_pitch': -0.2,
    'left_shoulder_yaw': 0.0,
    'left_shoulder_roll': 0.1,
    'left_elbow': 0.4,
    // ... 其余 21 个关节
  }
}
```

> `adapter-unitree.ts` 负责将厂商原始 WS 消息转换为上述统一格式。

---

## 十、附录 C：变更日志

| 版本 | 日期 | 变更 |
|------|------|------|
| v1.0 | 2026-03 | 初版，整合 Step1 模型替换 + Step2 等比例校验 + Step3 场景升级 |

---

**一句话定位**：本文是 `UNITREE-SCALE.md`（规范）+ `G1-HUMANOID.md`（骨架）+ `3D-VIEW-CLEAN.md`（架构）的**最终落地执行手册**——照着第五步 `validateScale()` 打勾，身高对齐 1.30m + 29 DOF 全驱动 + PBR 场景渲染，即完成 100% 等比例还原。
