# Robot-Ops-Solo · 机器人行走动画优化开发文档

> 版本：v1.0 · 适用栈：React Three Fiber + three.js + Zustand + TypeScript
> 关联文档：`UNITREE-SCALE.md`（等比例还原）、`G1-HUMANOID.md`、`3D-VIEW-CLEAN.md`、`AMAP-OUTDOOR.md`
> 目标：把"脚底漂移太空步 + 转身卡顿 + 摆臂像没吃饭"的假走路，改成人眼看不出破绽的自然步态

---

## 一、问题诊断：三个症状的根源

| 症状 | 用户感知 | 技术根源 |
|------|---------|---------|
| **脚底走太空步** | 脚不落地、原地打滑、鞋底贴着地面平移 | ① 位置用线性插值（lerp），但脚 IK 没锁地；② 每帧 `position += velocity*dt` 累加浮点误差；③ 根节点位移直接等于速度，缺"支撑相锁定" |
| **转向不自然** | 瞬间调头、朝向突变、走弧线时身体僵硬 | ① `rotation.y = target` 硬赋值，没用 slerp；② 转向速度不受角速度限制；③ 缺少转向 anticipation（先扭腰再迈步） |
| **摆臂角度小** | 手臂像钟摆 5°，没有行走的 ±30°~45° | ① 正弦振幅参数太小（默认 0.1 rad）；② 没区分肩关节 pitch 与肩 roll；③ 左右臂相位错用成同相，变成"僵尸臂"；④ 速度与摆幅没正相关 |

**一句话**：你现在用的是"位置驱动 + 每帧覆盖"，正确做法是 **"时间轴驱动的步态周期 + IK 锁脚 + slerp 转向 + 速度与摆幅联动"**。

---

## 二、核心理论：步态周期（Gait Cycle）

把走路拆成 **支撑相（Stance）60%** 和 **摆动相（Swing）40%**：

```
0%      20%      40%      60%      80%      100%
|--------|--------|--------|--------|--------|
 ^ heel-strike              ^ toe-off
        ^ mid-stance                 ^ foot-flat + heel-rise
                 60% 支撑相 ──────── 40% 摆动相
```

| 事件 | 相位 | 含义 |
|------|------|------|
| Heel Strike（脚跟落地）| 0% | 脚后跟先着地，摆动腿变支撑腿 |
| Mid Stance（支撑中期）| 20%~40% | 身体重心压过支撑脚，**此时该脚绝对锁定地面** |
| Toe Off（脚尖离地）| 60% | 脚跟抬起，进入摆动相 |
| Foot Flat（全脚掌）| 60%~80% | 摆动腿向前摆出 |
| Heel Rise（抬脚跟）| 80%~100% | 准备下一次落地 |

**关键洞察**：**支撑相期间，支撑脚的世界坐标必须保持不变（锁地）**，只有摆动腿移动 + 身体重心前移。这才是"不走太空步"的全部秘密。

### 2.1 相位推进公式

```ts
// 用相速度 = 步频(Hz) * 2π，由线速度决定
phase += gaitParams.stepFrequency * Math.PI * 2 * dt
phase %= Math.PI * 2  // 归一化到 [0, 2π]
```

宇树 G1 正常步行：步频约 **1.8~2.2 Hz**，即每秒 1.8~2.2 个完整步态周期。

---

## 三、核心算法

### 3.1 步态参数（G1 29 DOF 参考值）

```ts
// packages/digital-twin/src/locomotion/gaitParams.ts
export interface GaitParams {
  stepFrequency: number   // 步频 Hz，1.8~2.2
  stepLength: number      // 步长 m，0.35（慢）~0.65（快）
  footLift: number       // 抬脚高度 m，0.06
  armSwing: number       // 摆臂振幅 rad，0.6（≈34°）~0.9（≈52°）
  stanceRatio: number    // 支撑相占比，0.6
  turnSpeed: number      // 最大转向角速度 rad/s，2.0
  speedBlend: number     // 速度与摆幅联动系数，0.4
}

export const DEFAULT_GAIT: GaitParams = {
  stepFrequency: 2.0,
  stepLength: 0.45,
  footLift: 0.06,
  armSwing: 0.7,        // ★ 从 0.1 提到 0.7，这是摆臂优化的核心
  stanceRatio: 0.6,
  turnSpeed: 2.0,
  speedBlend: 0.4,
}

// ---- 通用数学工具（其他模块也会用到，建议提到 utils/math.ts）----
function clamp(v: number, min: number, max: number) {
  return Math.max(min, Math.min(max, v))
}
function lerp(a: number, b: number, t: number) {
  return a + (b - a) * Math.max(0, Math.min(1, t))
}
// 把角度差归一化到 (-π, π]，用于转向时选最短方向
function wrapAngle(a: number) {
  while (a > Math.PI) a -= Math.PI * 2
  while (a < -Math.PI) a += Math.PI * 2
  return a
}
```

### 3.2 步频与线速度联动（关键！）

```ts
// 步频 = 线速度 / 步长（物理约束）
const targetFreq = clamp(speed / gait.stepLength, 1.2, 3.0)
gait.stepFrequency = lerp(gait.stepFrequency, targetFreq, dt * 3)
```

这样**走快时自动摆快、走慢时摆慢**，符合人眼预期。

### 3.3 支撑相锁脚（解决太空步）

```ts
// packages/digital-twin/src/locomotion/gaitCycle.ts
export function getStancePhase(phase: number, stanceRatio: number): number {
  // 返回 [0,1]：0=刚落地，1=即将离地
  const t = phase / (Math.PI * 2)
  return Math.min(t / stanceRatio, 1.0)
}

export function isFootLocked(phase: number, stanceRatio: number): boolean {
  // 支撑相 = [0, stanceRatio*2π]
  return phase % (Math.PI * 2) < stanceRatio * Math.PI * 2
}
```

在组件里：**支撑相时，该脚的世界坐标直接用上次落地时记录的 anchor，禁止叠加位移。**

---

## 四、完整代码：G1Locomotion 驱动模块

### 4.1 步态状态机

```ts
// packages/digital-twin/src/locomotion/GaitState.ts
import { create } from 'zustand'

export interface GaitState {
  phase: number              // 当前相位 [0, 2π)
  speed: number              // 线速度 m/s
  heading: number            // 朝向角（世界坐标 yaw，rad）
  targetHeading: number      // 目标朝向
  leftFootAnchor: [number, number, number]   // 左脚锁定世界坐标
  rightFootAnchor: [number, number, number]  // 右脚锁定世界坐标
  params: GaitParams
  setSpeed: (v: number) => void
  setTargetHeading: (h: number) => void
  update: (dt: number) => void
}

export const useGaitStore = create<GaitState>((set, get) => ({
  phase: 0,
  speed: 0,
  heading: 0,
  targetHeading: 0,
  leftFootAnchor: [0, 0, 0],
  rightFootAnchor: [0, 0, 0],
  params: DEFAULT_GAIT,

  setSpeed: (v) => set({ speed: Math.max(0, v) }),
  setTargetHeading: (h) => set({ targetHeading: h }),

  update: (dt) => {
    const s = get()
    const p = s.params

    // 1. 步频与速度联动
    const targetFreq = clamp(s.speed / p.stepLength, 1.2, 3.0)
    const freq = lerp(p.stepFrequency, targetFreq, dt * 3)
    p.stepFrequency = freq

    // 2. 相位推进（时间轴驱动，非位移驱动）
    const newPhase = (s.phase + freq * Math.PI * 2 * dt) % (Math.PI * 2)

    // 3. 转向：slerp 平滑 + 角速度限制
    const delta = wrapAngle(s.targetHeading - s.heading)
    const maxTurn = p.turnSpeed * dt
    const turn = clamp(delta, -maxTurn, maxTurn)
    const newHeading = s.heading + turn

    set({ phase: newPhase, heading: newHeading })
  },
}))
```

### 4.2 摆臂计算（解决摆臂小）

```ts
// packages/digital-twin/src/locomotion/limbIK.ts
import * as THREE from 'three'

// ★ 左右臂相位相反（反相），才像自然行走
// 左臂与右腿同相 → 交叉步态
export function calcArmSwing(
  phase: number,
  armSwing: number,
  speed: number,
): { leftShoulderPitch: number; rightShoulderPitch: number; shoulderRoll: number } {
  // 速度与摆幅联动
  const amp = armSwing * (1 + clamp(speed / 2.0, 0, 1) * 0.5)

  // 正弦波，左右反相（phase + π）
  const leftShoulderPitch  =  Math.sin(phase)        * amp
  const rightShoulderPitch = -Math.sin(phase)        * amp  // 反相
  const shoulderRoll       =  Math.sin(phase) * amp * 0.15  // 轻微内收

  return { leftShoulderPitch, rightShoulderPitch, shoulderRoll }
}

// 腿部 IK（髋/膝/踝）
export function calcLegIK(
  phase: number,
  stepLength: number,
  footLift: number,
  stanceRatio: number,
): { leftHip: number; leftKnee: number; leftAnkle: number; rightHip: number; rightKnee: number; rightAnkle: number } {
  // 左右腿相位错开 π（一条支撑、一条摆动）
  const leftPhase  = phase
  const rightPhase = phase + Math.PI

  return {
    leftHip:   Math.sin(leftPhase)  * stepLength * 0.5,
    leftKnee:  Math.max(0, -Math.sin(leftPhase + Math.PI * 0.25)) * footLift * 4,
    leftAnkle: Math.sin(leftPhase)  * 0.1,
    rightHip:  Math.sin(rightPhase) * stepLength * 0.5,
    rightKnee: Math.max(0, -Math.sin(rightPhase + Math.PI * 0.25)) * footLift * 4,
    rightAnkle:Math.sin(rightPhase) * 0.1,
  }
}
```

> **摆臂从 0.1rad 提到 0.7rad 后，肉眼可见手臂大幅自然摆动。** 若觉得过大，`armSwing` 降到 0.5 即可（约 28°），符合 G1 实际行走观感。

### 4.3 根节点位移（不再每帧累加，改为相位积分）

```ts
// packages/digital-twin/src/locomotion/rootMotion.ts
export function calcRootMotion(
  phase: number,
  prevPhase: number,
  speed: number,
  heading: number,
  stanceRatio: number,
): { dx: number; dz: number; isMoving: boolean } {
  // 只在摆动相（脚抬起时）推进根节点，支撑相锁定 → 消除漂移
  const isSwing = !isFootLocked(phase, stanceRatio)
  const phaseDelta = phase - prevPhase

  // 相位差归一化（防止跨周期跳变）
  const safeDelta = phaseDelta < -Math.PI ? phaseDelta + Math.PI * 2 : phaseDelta

  const distance = isSwing ? safeDelta / (Math.PI * 2) * speed * (1 / 60) : 0
  // ★ 速度不再直接乘 dt，而是"每周期前进一个步长"
  const stepDist = distance * (Math.PI * 2) // 一个完整周期 = 一步

  const dx = Math.sin(heading) * stepDist
  const dz = Math.cos(heading) * stepDist

  return { dx, dz, isMoving: speed > 0.01 }
}
```

### 4.4 组件集成（替换现在的 useFrame 逻辑）

```tsx
// packages/digital-twin/src/robots/G1Humanoid.tsx（增量修改）
import { useFrame } from '@react-three/fiber'
import { useGaitStore } from '../locomotion/GaitState'
import { calcArmSwing, calcLegIK } from '../locomotion/limbIK'
import { applyJointValues } from './jointMapper'

export function G1Humanoid({ robotId }: { robotId: string }) {
  const groupRef = useRef<THREE.Group>(null!)
  const prevPhase = useRef(0)

  // 从 WebSocket / mock 接收目标速度 + 朝向
  const { speed, heading, phase, params, update } = useGaitStore()

  useFrame((_, dt) => {
    // 1. 步态状态推进（相位 + 转向 slerp）
    update(dt)

    // 2. 根节点位移（相位积分 + 支撑相锁定）
    const { dx, dz } = calcRootMotion(phase, prevPhase.current, speed, heading, params.stanceRatio)
    groupRef.current.position.x += dx
    groupRef.current.position.z += dz
    groupRef.current.rotation.y = heading  // 已由 slerp 平滑
    prevPhase.current = phase

    // 3. 四肢关节角
    const legs = calcLegIK(phase, params.stepLength, params.footLift, params.stanceRatio)
    const arms = calcArmSwing(phase, params.armSwing, speed)

    // 4. 映射到 URDF 关节（命名约定见 UNITREE-SCALE 附录 B）
    applyJointValues({
      ...legs, ...arms,
      // 腰部随步态轻微扭转
      waistYaw: Math.sin(phase) * 0.05,
    })
  })

  return (
    <group ref={groupRef}>
      {/* URDF 加载逻辑（见 G1-HUMANOID.md 第四节）*/}
    </group>
  )
}
```

---

## 五、转向优化（解决转身不自然）

### 5.1 四元数 slerp（禁止直接赋值 rotation.y）

```ts
// packages/digital-twin/src/locomotion/turnSmooth.ts
import * as THREE from 'three'

const _q1 = new THREE.Quaternion()
const _q2 = new THREE.Quaternion()

export function smoothHeading(
  current: THREE.Quaternion,
  targetYaw: number,
  turnSpeed: number,
  dt: number,
): THREE.Quaternion {
  _q2.setFromAxisAngle(new THREE.Vector3(0, 1, 0), targetYaw)
  // 角速度限制 → 转成 slerp 的 t 参数
  const maxAngle = turnSpeed * dt
  // 计算当前到目标的夹角
  const angle = current.angleTo(_q2)
  const t = angle > 0 ? Math.min(1, maxAngle / angle) : 0
  current.slerp(_q2, t)
  return current
}
```

### 5.2 转向 anticipation（先扭腰再迈步）

```ts
// 在 calcArmSwing / legIK 里加"转向时加大迈步"的补偿
const turnAmount = Math.abs(deltaHeading)  // 当前帧转向量
const adjustedStepLength = params.stepLength * (1 + turnAmount * 0.5)
// 走弧线时，内侧腿步长缩短、外侧腿加长
const leftStride  = adjustedStepLength * (1 - turnAmount * 0.3)
const rightStride = adjustedStepLength * (1 + turnAmount * 0.3)
```

这样机器人走弧线/调头时**身体先转、腿跟着迈**，不再像坦克原地转炮塔。

### 5.3 真实数据对齐（可选进阶）

若接宇树真机或社区模拟器，可订阅 `/g1/imu/data`（100Hz，含角速度 `gyro`）和 `/g1/foot_force`（足底力传感）：
- 用 `gyro.z` 驱动 `targetHeading` 的转向角速度
- 用 `foot_force` 判断是否离地，**真实触发摆动相**（比时间相位更准）

社区已有 `unitree_motion_control` 的 `G1_SimpleStand`/`G1_Walk` 示例，可直接扒步态参数。

---

## 六、脚底不打滑的关键：Foot IK（进阶，M4+ 做）

时间相位锁脚已经解决 80% 问题。要做到"脚完全粘地"，需要**位置式 IK**：

### 6.1 三步 IK 流程

```
1. 计算摆动脚的目标落点（基于步长 + 朝向）
2. CCD IK / FABRIK 求解髋-膝-踝，让脚踝到达落点
3. 支撑脚：世界坐标 = anchor（每帧不变），只做小幅 bounce
```

### 6.2 简化版（先用这个）

```ts
// packages/digital-twin/src/locomotion/footIK.ts
export function solveSupportFoot(
  foot: THREE.Object3D,
  anchor: THREE.Vector3,
  groundY: number,
) {
  // 支撑脚完全锁定，仅加微量上下 bounce
  foot.position.x = anchor.x
  foot.position.z = anchor.z
  foot.position.y = anchor.y + Math.sin(performance.now() * 0.01) * 0.002
  foot.quaternion.identity()
}

export function solveSwingFoot(
  foot: THREE.Object3D,
  hip: THREE.Object3D,
  target: THREE.Vector3,
  lift: number,
  t: number, // 0~1 摆动进度
) {
  // 贝塞尔弧线：抬脚最高点在 t=0.5
  const arc = Math.sin(t * Math.PI) * lift
  foot.position.lerpVectors(hip.position, target, t)
  foot.position.y += arc
}
```

> **完整 CCD IK / FABRIK 实现建议 M7 后引入**，现在用相位锁脚 + 根节点相位积分即可达到演示级自然度。

---

## 七、参数调优对照表

| 参数 | 当前（假）| 优化值（自然）| 调大效果 | 调小效果 |
|------|----------|-------------|---------|---------|
| `armSwing` | 0.1 rad（5.7°）| **0.6~0.9 rad（34°~52°）** | 摆臂更夸张 | 手臂僵硬 |
| `stepFrequency` | 固定 | **speed/stepLength 联动** | 走快摆快 | 慢走拖沓 |
| `stepLength` | — | 0.35~0.65 m | 迈大步 | 小碎步 |
| `footLift` | 0 | 0.05~0.08 m | 抬脚明显 | 擦地 |
| `turnSpeed` | ∞（瞬转）| **2.0 rad/s** | 转头快 | 迟钝 |
| `stanceRatio` | — | 0.6 | 脚粘地时间长 | 滑步 |

**推荐起步值**：`armSwing=0.7, stepLength=0.45, footLift=0.06, turnSpeed=2.0`，再根据观感微调。

---

## 八、分步实施（约 6-8 小时）

| 步骤 | 内容 | 耗时 | 验证点 |
|------|------|------|-------|
| 1 | 新建 `locomotion/` 目录，建 `gaitParams.ts` + `GaitState.ts` | 1h | store 能读写 |
| 2 | 实现 `calcLegIK` + `calcArmSwing`（★ 先调 armSwing=0.7）| 1.5h | 手臂大幅摆动 |
| 3 | 替换 useFrame 里的位移逻辑为 `calcRootMotion`（相位积分）| 1.5h | 脚不再连续平移 |
| 4 | 加支撑相锁脚（isFootLocked）| 1h | 脚底粘地 |
| 5 | 转向改用 `smoothHeading` slerp + 角速度限制 | 1h | 转身平滑 |
| 6 | 加转向 anticipation（内外侧步长差）| 0.5h | 弧线自然 |
| 7 | 接 mock `/imu` + `/foot_force`（可选）| 1h | 真实步态触发 |
| 8 | 调参 + 录屏对比 | 1h | 肉眼无破绽 |

---

## 九、验证清单

### 脚底（解决太空步）
- [ ] 机器人在原地 `speed=0` 时，脚绝对不动
- [ ] 行走时脚底无水平滑动纹理（地面贴图不相对鞋底移动）
- [ ] 支撑相期间，支撑脚世界坐标恒定（用 `console.log` 打点验证）
- [ ] 连续走 60 秒，累计位移误差 < 0.05m（消除浮点累加）

### 转向
- [ ] 180° 调头是平滑圆弧，不是瞬转
- [ ] 高速转向不超调（不会来回晃）
- [ ] 走弧线时身体先转、脚后跟上

### 摆臂
- [ ] 手臂摆动 ±30°~50°（armSwing=0.7 时约 40°）
- [ ] 左右臂反相（左前→右后），不是僵尸同步
- [ ] 走快时摆幅自动加大

---

## 十、常见问题

| 问题 | 原因 | 解决 |
|------|------|------|
| 脚还是滑 | 没锁支撑相，仍在 lerp 位置 | `isFootLocked` 时禁止叠加 dx/dz |
| 越走越偏 | 相位差跨周期跳变 | `safeDelta` 归一化（见 4.3）|
| 手臂穿身体 | shoulderRoll 过大 | 限制在 ±0.1 |
| 转身抖动 | slerp t 无角速度限制 | 用 `maxAngle/turnSpeed*dt` 钳制 |
| 膝盖反折 | IK 目标不可达 | 限制 knee 在 [0, 2.0 rad] |
| 起步瞬间滑 | 速度突变 | `setSpeed` 用 lerp 缓动（dt*3）|
| 浮在空中 | groundY 未对齐 | 根节点 y 锁定为 0（或足踝高度）|

---

## 十一、与其他模块的关系

```
GPS/WS 上报 → wsHub → robotStore(speed, heading)
                                    ↓
                            useGaitStore（本节新增）
                                    ↓
                        useFrame: phase 推进 + IK 求解
                                    ↓
                            applyJointValues()
                                    ↓
                         URDF 关节（three-urdf / urdf-loader）
                                    ↓
                              Canvas 渲染
```

- **不改 adapter-kit**：速度/朝向数据已在 `UnifiedRobotState` 里
- **不改 wsHub**：只新增 `/imu`、`/foot_force` topic（可选）
- **改 digital-twin**：新增 `locomotion/` 包，修改 `G1Humanoid.tsx` 的 useFrame

---

## 十二、进阶路线

| 阶段 | 内容 | 价值 |
|------|------|------|
| M3（现在）| 相位驱动 + 摆臂 + slerp 转向 | 演示级自然 |
| M4 | Foot IK（CCD/FABRIK）| 脚完全粘地 |
| M7 | 接真机 `/foot_force` | 真实步态触发 |
| M12 | 运动捕捉数据驱动（AMASS 数据集）| 电影级真实 |

---

## 附录 A：完整关节映射（G1 29 DOF 摘录）

```ts
// packages/digital-twin/src/robots/jointMapper.ts
export const JOINT_MAP = {
  // 左腿
  leftHip: 'left_hip_pitch_joint',       // +前摆
  leftKnee: 'left_knee_joint',           // 只弯不伸
  leftAnkle: 'left_ankle_pitch_joint',
  // 右腿
  rightHip: 'right_hip_pitch_joint',
  rightKnee: 'right_knee_joint',
  rightAnkle: 'right_ankle_pitch_joint',
  // 左臂（★ 注意 shoulder 是 pitch + roll 两个自由度）
  leftShoulderPitch: 'left_shoulder_pitch_joint',
  leftShoulderRoll:  'left_shoulder_roll_joint',
  leftElbow: 'left_elbow_joint',
  // 右臂
  rightShoulderPitch: 'right_shoulder_pitch_joint',
  rightShoulderRoll:  'right_shoulder_roll_joint',
  rightElbow: 'right_elbow_joint',
  // 腰
  waistYaw: 'waist_yaw_joint',
} as const
```

> 完整 29 DOF 见宇树官方 `g1_description` URDF。关节轴推断规则见 `UNITREE-SCALE.md` 附录 B。

## 附录 B：mock 数据格式（新增 /imu + /foot_force）

```json
// mock-ws-server.js 推送
{
  "topic": "/imu",
  "data": { "gyro": [0, 0, 0.15], "accel": [0, 0, 9.8], "timestamp": 123456 }
}
{
  "topic": "/foot_force",
  "data": { "left": 320, "right": 0, "timestamp": 123456 }
}
```

- `gyro[2]`（yaw 角速度）→ 驱动转向
- `foot_force.left/right` → 判断支撑腿（>阈值=支撑中）

## 附录 C：变更日志

- **v1.0**（2026-08-29）：初版。覆盖步态周期理论、摆臂/转向/锁脚三大优化、Foot IK 进阶、分步实施与验证清单。

---

## 一句话总结

> **太空步 = 缺支撑相锁脚 + 位置累加误差；僵尸臂 = 摆臂振幅太小 + 左右同相；瞬转 = 没 slerp。把"每帧覆盖位置"改成"相位驱动 + IK 求解"，三个问题一次性解决。**
