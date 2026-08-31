# 机器人舞蹈功能开发文档 · 科目三

> **目标**：在 `digital-twin` 包中，为 G1 人形机器人添加"点击按钮跳舞"能力——播放抖音热门"科目三"15 秒循环舞蹈，关节级驱动，可播放/停止。
>
> **定位**：本文件是 `robot-ops-solo-COMPLETE.md` 的功能扩展分册，依赖 `UNITREE-SCALE.md`（URDF 等比例）、`G1-HUMANOID.md`（组件骨架）、`ROBOT-LOCOMOTION.md`（步态/关节驱动）。
>
> **适用版本**：digital-twin 已能用 `useFrame` 驱动 29 DOF 关节（即 `G1Humanoid.tsx` 存在且可设置关节角度）。

---

## 一、功能概述

### 1.1 用户视角

```
[3D 场景]
    └── G1 机器人站立
    └── 右下角（或底部）一个按钮 "🎵 跳科目三"
          ├── 点击 → 机器人开始跳舞，按钮文字变 "⏹ 停止"
          └── 再点 → 停止，回到 idle pose
```

### 1.2 技术视角

```
按钮 onClick
    ↓
useDancePlayer.start()   ← 记录 startTime
    ↓
useFrame 每帧调用 update(now)
    ↓
update：elapsed % 15s → 二分查找相邻关键帧 → 线性插值
    ↓
onFrame(interpolatedJoints, root)
    ↓
G1Humanoid 的关节 ref map → 设置 rotation
    ↓
Canvas 渲染当前帧姿态
```

### 1.3 非目标（明确不做）

- ❌ 不在服务端计算动画（纯前端）
- ❌ 不做动作捕捉/Motion Capture（用手 K 帧）
- ❌ 不做舞蹈编辑器 UI（本期只做播放）
- ❌ 不做 Foot IK（跳舞时脚会轻微滑，可接受；如需解决见 `ROBOT-LOCOMOTION.md` 第六章）

---

## 二、关节命名约定（必读）

舞蹈数据文件里的字符串必须和**你的 URDF 里的关节名完全一致**，否则关节不生效。文档用以下约定名（参考宇树 G1 29 DOF）：

| 部位 | 关节名 | 自由度 |
|------|--------|--------|
| 腰部 | `waist_yaw` / `waist_pitch` / `waist_roll` | 3 |
| 左腿 | `left_hip_pitch` / `_roll` / `_yaw`、`left_knee`、`left_ankle_pitch` / `_roll` | 6 |
| 右腿 | `right_hip_pitch` / `_roll` / `_yaw`、`right_knee`、`right_ankle_pitch` / `_roll` | 6 |
| 左臂 | `left_shoulder_pitch` / `_roll` / `_yaw`、`left_elbow` | 4 |
| 右臂 | `right_shoulder_pitch` / `_roll` / `_yaw`、`right_elbow` | 4 |

> ⚠️ **对接要点**：你的 `g1_29dof.urdf` 里的实际关节名可能是 `LF_hip_joint`、`left_hip_pitch_joint` 等。**必须先执行 2.1 的校准步骤**，把 `G1JointName` 类型改成真实名。

### 2.1 校准步骤（先做这个）

在浏览器控制台或临时脚本里打印 URDF 加载后的所有关节名：

```ts
// 临时调试：加载 URDF 后执行一次
console.log('URDF joints:', Object.keys(urdfRobot.joints))
```

拿到真实列表后，修改 `subject3-keyframes.ts` 的 `G1JointName` 类型为字面量联合，并把每个关键帧的 key 改成真实名。例如真实名是 `left_hip_pitch_joint`，则：

```ts
// 改前
left_hip_pitch: -0.2
// 改后
left_hip_pitch_joint: -0.2
```

> 💡 **推荐**：在 `G1Humanoid.tsx` 里维护一张 `JOINT_ALIAS` 映射表，把规范名 → URDF 真名解耦，这样舞蹈文件不用改：

```ts
export const JOINT_ALIAS: Record<string, string> = {
  'left_hip_pitch': 'left_hip_pitch_joint',  // 按你的 URDF 实际值填
  'left_knee': 'left_knee_joint',
  // ... 其余同理
}
```

应用层：`urdfJointName = JOINT_ALIAS[logicalName] ?? logicalName`。

---

## 三、目录结构

在 `packages/digital-twin/src/` 下新增 `dance/` 子目录：

```
packages/digital-twin/src/
├── dance/
│   ├── subject3-keyframes.ts   # 舞蹈关键帧数据（本节 §四）
│   └── useDancePlayer.ts       # 播放器 Hook（本节 §五）
├── robots/
│   └── G1Humanoid.tsx          # 修改：收集关节 ref + 暴露 applyJoints（§六）
└── ...
```

> 不新建 `G1DanceDemo.tsx` 独立组件——本期只在现有场景里加一个按钮，保持改动最小。

---

## 四、关键帧数据：`subject3-keyframes.ts`

完整数据（**直接复制使用**）：

```ts
/**
 * 科目三舞蹈关键帧数据（抖音版 15 秒循环）
 * 时间单位：秒 | 角度单位：弧度
 * 关节命名见 §2.1，须与 URDF 实际关节名一致（可用 JOINT_ALIAS 映射）
 */
export type G1JointName =
  | 'waist_yaw' | 'waist_pitch' | 'waist_roll'
  | 'left_hip_pitch' | 'left_hip_roll' | 'left_hip_yaw'
  | 'left_knee' | 'left_ankle_pitch' | 'left_ankle_roll'
  | 'right_hip_pitch' | 'right_hip_roll' | 'right_hip_yaw'
  | 'right_knee' | 'right_ankle_pitch' | 'right_ankle_roll'
  | 'left_shoulder_pitch' | 'left_shoulder_roll' | 'left_shoulder_yaw' | 'left_elbow'
  | 'right_shoulder_pitch' | 'right_shoulder_roll' | 'right_shoulder_yaw' | 'right_elbow'

export interface DanceRoot {
  position?: [number, number, number]
  rotationY?: number
}

export interface DanceKeyframe {
  time: number
  joints: Partial<Record<G1JointName, number>>
  root?: DanceRoot
}

export const SUBJECT3_FRAMES: DanceKeyframe[] = [
  // ── 0-3s：双手交叉摇手 ──
  { time: 0,   joints: { waist_yaw: 0, waist_roll: 0, waist_pitch: 0,
    left_shoulder_roll: 0.3, left_shoulder_pitch: -0.2, left_elbow: -0.5,
    right_shoulder_roll: -0.3, right_shoulder_pitch: -0.2, right_elbow: -0.5,
    left_knee: 0.1, right_knee: 0.1 } },
  { time: 0.5, joints: { left_shoulder_roll: -0.2, left_shoulder_pitch: -0.4, left_elbow: -0.8,
    right_shoulder_roll: 0.4, right_shoulder_pitch: -0.1, right_elbow: -0.3,
    waist_yaw: 0.2, waist_roll: 0.1, left_knee: 0.15, right_knee: 0.05 } },
  { time: 1.0, joints: { left_shoulder_roll: 0.5, left_shoulder_pitch: -0.1, left_elbow: -0.3,
    right_shoulder_roll: -0.4, right_shoulder_pitch: -0.4, right_elbow: -0.8,
    waist_yaw: -0.2, waist_roll: -0.1, left_knee: 0.05, right_knee: 0.15 } },
  { time: 1.5, joints: { left_shoulder_roll: -0.1, left_shoulder_pitch: -0.3, left_elbow: -0.6,
    right_shoulder_roll: 0.3, right_shoulder_pitch: -0.3, right_elbow: -0.6,
    waist_yaw: 0.1, waist_roll: 0.05, left_knee: 0.12, right_knee: 0.12 } },
  { time: 2.0, joints: { left_shoulder_roll: 0.4, left_elbow: -0.4,
    right_shoulder_roll: -0.3, right_elbow: -0.5,
    waist_yaw: 0, waist_roll: 0, left_knee: 0.1, right_knee: 0.1 } },
  { time: 2.5, joints: { left_shoulder_roll: -0.3, left_elbow: -0.7,
    right_shoulder_roll: 0.3, right_elbow: -0.4,
    waist_yaw: 0.15, waist_roll: 0.08, left_knee: 0.18, right_knee: 0.05 } },
  { time: 3.0, joints: { left_shoulder_roll: 0.2, left_elbow: -0.5,
    right_shoulder_roll: -0.2, right_elbow: -0.5,
    waist_yaw: 0, waist_roll: 0, left_knee: 0.1, right_knee: 0.1 } },

  // ── 3-6s：扭胯踏步 ──
  { time: 3.5, joints: { waist_yaw: 0.4, waist_roll: 0.2, waist_pitch: -0.05,
    left_hip_pitch: -0.2, left_knee: 0.3, left_ankle_pitch: 0.1,
    right_hip_pitch: 0.05, right_knee: 0.05, right_ankle_pitch: 0,
    left_shoulder_roll: 0.6, right_shoulder_roll: -0.1 } },
  { time: 4.0, joints: { waist_yaw: -0.4, waist_roll: -0.2, waist_pitch: -0.05,
    left_hip_pitch: 0.05, left_knee: 0.05,
    right_hip_pitch: -0.2, right_knee: 0.3, right_ankle_pitch: 0.1,
    left_shoulder_roll: 0.1, right_shoulder_roll: -0.6 } },
  { time: 4.5, joints: { waist_yaw: 0.3, waist_roll: 0.15,
    left_knee: 0.25, right_knee: 0.1,
    left_shoulder_roll: 0.5, right_shoulder_roll: -0.2 } },
  { time: 5.0, joints: { waist_yaw: -0.3, waist_roll: -0.15,
    left_knee: 0.1, right_knee: 0.25,
    left_shoulder_roll: 0.2, right_shoulder_roll: -0.5 } },
  { time: 5.5, joints: { waist_yaw: 0.2, waist_roll: 0.1,
    left_knee: 0.2, right_knee: 0.15, left_elbow: -0.6, right_elbow: -0.6 } },
  { time: 6.0, joints: { waist_yaw: 0, waist_roll: 0,
    left_knee: 0.1, right_knee: 0.1, left_elbow: -0.5, right_elbow: -0.5 } },

  // ── 6-9s：原地转圈（双臂张开 + yaw 累加） ──
  { time: 6.5, joints: { waist_yaw: 1.0,
    left_shoulder_pitch: -1.2, left_shoulder_roll: 0.8, left_elbow: -1.0,
    right_shoulder_pitch: -1.2, right_shoulder_roll: -0.8, right_elbow: -1.0,
    left_knee: 0.2, right_knee: 0.2 } },
  { time: 7.0, joints: { waist_yaw: 2.0,
    left_shoulder_pitch: -1.0, left_shoulder_roll: 0.9,
    right_shoulder_pitch: -1.0, right_shoulder_roll: -0.9,
    left_knee: 0.25, right_knee: 0.25 } },
  { time: 7.5, joints: { waist_yaw: 3.0,
    left_shoulder_pitch: -1.3, left_shoulder_roll: 0.7,
    right_shoulder_pitch: -1.3, right_shoulder_roll: -0.7,
    left_knee: 0.2, right_knee: 0.2 } },
  { time: 8.0, joints: { waist_yaw: 4.0,
    left_shoulder_pitch: -1.1, left_shoulder_roll: 0.8,
    right_shoulder_pitch: -1.1, right_shoulder_roll: -0.8,
    left_knee: 0.22, right_knee: 0.22 } },
  { time: 8.5, joints: { waist_yaw: 5.0,
    left_shoulder_pitch: -1.2, left_elbow: -1.2,
    right_shoulder_pitch: -1.2, right_elbow: -1.2,
    left_knee: 0.15, right_knee: 0.15 } },
  { time: 9.0, joints: { waist_yaw: 6.28,
    left_shoulder_pitch: -0.5, left_shoulder_roll: 0.3, left_elbow: -0.5,
    right_shoulder_pitch: -0.5, right_shoulder_roll: -0.3, right_elbow: -0.5,
    left_knee: 0.1, right_knee: 0.1 } },

  // ── 9-12s：滑步侧移 ──
  { time: 9.5, joints: { waist_yaw: 6.28, waist_roll: 0.3,
    left_ankle_roll: 0.2, right_ankle_roll: -0.1,
    left_shoulder_roll: 0.4, right_shoulder_roll: -0.4,
    left_knee: 0.2, right_knee: 0.1 },
    root: { position: [-0.1, 0, 0] } },
  { time: 10.0, joints: { waist_yaw: 6.28, waist_roll: -0.3,
    left_ankle_roll: -0.1, right_ankle_roll: 0.2,
    left_shoulder_roll: -0.4, right_shoulder_roll: 0.4,
    left_knee: 0.1, right_knee: 0.2 },
    root: { position: [0.1, 0, 0] } },
  { time: 10.5, joints: { waist_roll: 0.25,
    left_ankle_roll: 0.15, right_ankle_roll: -0.05,
    left_knee: 0.18, right_knee: 0.12 },
    root: { position: [-0.05, 0, 0] } },
  { time: 11.0, joints: { waist_roll: -0.25,
    left_ankle_roll: -0.05, right_ankle_roll: 0.15,
    left_knee: 0.12, right_knee: 0.18 },
    root: { position: [0.05, 0, 0] } },
  { time: 11.5, joints: { waist_roll: 0.2, left_knee: 0.15, right_knee: 0.15 },
    root: { position: [0, 0, 0] } },
  { time: 12.0, joints: { waist_roll: 0, left_knee: 0.1, right_knee: 0.1 } },

  // ── 12-15s：结尾 pose（双手举起） ──
  { time: 12.5, joints: { left_shoulder_pitch: -2.5, left_shoulder_roll: 0.3, left_elbow: -0.2,
    right_shoulder_pitch: -2.5, right_shoulder_roll: -0.3, right_elbow: -0.2,
    waist_pitch: -0.15, left_knee: 0.15, right_knee: 0.15 } },
  { time: 13.0, joints: { left_shoulder_pitch: -2.8, left_elbow: 0,
    right_shoulder_pitch: -2.8, right_elbow: 0,
    waist_pitch: -0.2, left_knee: 0.2, right_knee: 0.2 } },
  { time: 14.0, joints: { left_shoulder_pitch: -2.6, left_elbow: -0.1,
    right_shoulder_pitch: -2.6, right_elbow: -0.1,
    waist_pitch: -0.18, left_knee: 0.18, right_knee: 0.18 } },
  { time: 15.0, joints: { left_shoulder_pitch: -2.5, left_elbow: -0.2,
    right_shoulder_pitch: -2.5, right_elbow: -0.2,
    waist_pitch: -0.15, left_knee: 0.15, right_knee: 0.15 } },
]

export const DANCE_DURATION = 15.0
```

### 4.1 动作段落说明

| 时间 | 段落 | 主要关节 | 视觉 |
|------|------|---------|------|
| 0-3s | 双手交叉摇手 | shoulder_roll/pitch, elbow | 双臂胸前交替摆动 |
| 3-6s | 扭胯踏步 | waist_yaw/roll, hip, knee | 左右摇摆 + 屈膝 |
| 6-9s | 原地转圈 | waist_yaw 累加至 2π | 双臂张开旋转一圈 |
| 9-12s | 滑步侧移 | ankle_roll, root.position | 整体左右平移 |
| 12-15s | 结尾 pose | shoulder_pitch ≈ -2.5 | 双手高举定格 |

---

## 五、播放器 Hook：`useDancePlayer.ts`

```ts
import { useRef, useCallback, useMemo } from 'react'
import { SUBJECT3_FRAMES, DANCE_DURATION, DanceKeyframe, G1JointName } from './subject3-keyframes'

interface PlayState {
  active: boolean
  startTime: number
}

export interface DancePlayer {
  /** 开始播放（循环） */
  start: () => void
  /** 停止，回到 idle */
  stop: () => void
  /** 每帧调用，传入当前秒（performance.now()/1000） */
  update: (nowSec: number) => void
  /** 是否正在播放 */
  isActive: () => boolean
}

/**
 * 舞蹈播放器
 * @param onFrame 插值后的关节角度 + root 变换
 * @param frames  可选，自定义关键帧序列（默认科目三）
 */
export function useDancePlayer(
  onFrame: (joints: Partial<Record<G1JointName, number>>, root?: DanceKeyframe['root']) => void,
  frames: DanceKeyframe[] = SUBJECT3_FRAMES,
): DancePlayer {
  const stateRef = useRef<PlayState>({ active: false, startTime: 0 })

  const start = useCallback(() => {
    stateRef.current = { active: true, startTime: performance.now() / 1000 }
  }, [])

  const stop = useCallback(() => {
    stateRef.current.active = false
  }, [])

  // 二分查找当前时间所在的帧区间（O(log n)）
  const findIndex = useMemo(() => {
    return (t: number): number => {
      let lo = 0, hi = frames.length - 1
      while (lo < hi) {
        const mid = (lo + hi) >> 1
        if (frames[mid + 1].time <= t) lo = mid + 1
        else hi = mid
      }
      return lo
    }
  }, [frames])

  const update = useCallback((nowSec: number) => {
    const state = stateRef.current
    if (!state.active) return

    const elapsed = nowSec - state.startTime
    const t = elapsed % DANCE_DURATION  // 15 秒循环
    const i = findIndex(t)
    const frameA = frames[i]
    const frameB = frames[Math.min(i + 1, frames.length - 1)]

    const tA = frameA.time
    const tB = frameB.time
    const alpha = tB === tA ? 0 : (t - tA) / (tB - tA)

    // 合并两帧所有关节，逐一线性插值
    const interpolated: Partial<Record<G1JointName, number>> = {}
    const keys = new Set<G1JointName>([
      ...(Object.keys(frameA.joints) as G1JointName[]),
      ...(Object.keys(frameB.joints) as G1JointName[]),
    ])
    keys.forEach((joint) => {
      const a = frameA.joints[joint] ?? 0
      const b = frameB.joints[joint] ?? 0
      interpolated[joint] = a + (b - a) * alpha
    })

    // root 插值
    let root: DanceKeyframe['root']
    if (frameA.root || frameB.root) {
      const pa = frameA.root?.position ?? [0, 0, 0]
      const pb = frameB.root?.position ?? [0, 0, 0]
      const ya = frameA.root?.rotationY ?? 0
      const yb = frameB.root?.rotationY ?? 0
      root = {
        position: [
          pa[0] + (pb[0] - pa[0]) * alpha,
          pa[1] + (pb[1] - pa[1]) * alpha,
          pa[2] + (pb[2] - pa[2]) * alpha,
        ] as [number, number, number],
        rotationY: ya + (yb - ya) * alpha,
      }
    }

    onFrame(interpolated, root)
  }, [onFrame, findIndex, frames])

  const isActive = useCallback(() => stateRef.current.active, [])

  return { start, stop, update, isActive }
}
```

### 5.1 设计要点

- **循环**：`elapsed % DANCE_DURATION`，15 秒自动循环
- **性能**：二分查找 O(log n)，每帧插值 < 30 个关节，开销可忽略
- **无依赖**：不依赖 wsHub/store，纯时间驱动（跳舞不需要网络数据）
- **可复用**：传不同 `frames` 即可支持多支舞

---

## 六、集成到 `G1Humanoid.tsx`

### 6.1 改造要点

现有 `G1Humanoid.tsx` 需要：

1. **收集关节 ref map**：URDF 加载完成后，把每个关节的 `Object3D` 存入 `Map<string, Object3D>`
2. **暴露 `applyJoints` 方法**：供外部设置关节角度
3. **接入 useFrame**：调用 player.update
4. **添加按钮 + UI 状态**

### 6.2 完整改造代码示例

> 以下假设你的 `G1Humanoid` 用 `three-urdf` 加载 URDF，`urdfRobot.joints` 是关节名 → Object3D 的映射。如结构不同，按注释调整。

```tsx
import { useEffect, useRef, useState, forwardRef, useImperativeHandle } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { loadRobot } from 'three-urdf'
import { useDancePlayer } from '../dance/useDancePlayer'
import { G1JointName, DanceKeyframe } from '../dance/subject3-keyframes'

// 规范名 → URDF 真名（按 §2.1 校准后填）
const JOINT_ALIAS: Record<string, string> = {
  // 'left_hip_pitch': 'left_hip_pitch_joint',
}

export interface G1HumanoidHandle {
  playDance: () => void
  stopDance: () => void
  isDancing: () => boolean
}

interface Props {
  robotId?: string
  url?: string
  onReady?: (handle: G1HumanoidHandle) => void
}

export const G1Humanoid = forwardRef<G1HumanoidHandle, Props>(({
  robotId = 'g1-001',
  url = '/models/g1/g1_29dof.urdf',
  onReady,
}, ref) => {
  const groupRef = useRef<THREE.Group>(null!)
  const jointsRef = useRef<Map<string, THREE.Object3D>>(new Map())
  const [dancing, setDancing] = useState(false)

  // 加载 URDF
  useEffect(() => {
    let cancelled = false
    jointsRef.current.clear()

    loadRobot(url, { upAxis: 'y' }).then((urdfRobot) => {
      if (cancelled) return
      groupRef.current.add(urdfRobot)
      // 收集所有关节 Object3D（three-urdf 把关节存为 urdfRobot.joints）
      Object.entries(urdfRobot.joints).forEach(([name, obj]) => {
        jointsRef.current.set(name, obj as THREE.Object3D)
      })
    })

    return () => { cancelled = true }
  }, [url])

  // 应用一帧关节角度
  const applyJoints = (
    joints: Partial<Record<G1JointName, number>>,
    root?: DanceKeyframe['root'],
  ) => {
    Object.entries(joints).forEach(([logicalName, angle]) => {
      if (angle === undefined) return
      const realName = JOINT_ALIAS[logicalName] ?? logicalName
      const joint = jointsRef.current.get(realName)
      if (!joint) return  // 未找到的关节静默跳过（便于调试）
      // three-urdf 关节通常直接设置 rotation.z（revolve），按需调整
      joint.rotation.z = angle
    })

    if (root && groupRef.current) {
      if (root.position) groupRef.current.position.set(...root.position)
      if (root.rotationY !== undefined) groupRef.current.rotation.y = root.rotationY
    }
  }

  const player = useDancePlayer(applyJoints)

  useImperativeHandle(ref, () => ({
    playDance: () => { setDancing(true); player.start() },
    stopDance: () => { setDancing(false); player.stop() },
    isDancing: () => player.isActive(),
  }), [player])

  useEffect(() => { onReady?.({
    playDance: () => { setDancing(true); player.start() },
    stopDance: () => { setDancing(false); player.stop() },
    isDancing: () => player.isActive(),
  }) }, [player, onReady])

  // 每帧驱动
  useFrame(() => {
    if (player.isActive()) {
      player.update(performance.now() / 1000)
    }
  })

  return (
    <group ref={groupRef}>
      {/* 跳舞按钮（Html 来自 @react-three/drei） */}
      <Html position={[0, 2.2, 0]} center distanceFactor={10}>
        <button
          onClick={() => dancing ? player.stop() || setDancing(false) : player.start() || setDancing(true)}
          style={{
            background: dancing ? '#ff3d71' : '#00f0ff',
            color: '#0a0e1a', border: 'none', borderRadius: 8,
            padding: '10px 18px', fontFamily: 'JetBrains Mono, monospace',
            fontSize: 14, fontWeight: 700, cursor: 'pointer',
            boxShadow: '0 0 16px currentColor',
          }}
        >
          {dancing ? '⏹ 停止' : '🎵 跳科目三'}
        </button>
      </Html>
    </group>
  )
})
```

> ⚠️ **rotation 轴说明**：宇树 URDF 关节旋转轴由 `<axis xyz>` 定义，three-urdf 已处理。**多数 revolve 关节映射到 `rotation.z`**，但建议按 `ROBOT-LOCOMOTION.md` 的 `JOINT_AXIS_OVERRIDE` 做逐关节轴修正，否则可能"摆错方向"。

### 6.3 外部控制（不用内置按钮时也行）

```tsx
// 父组件
const g1Ref = useRef<G1HumanoidHandle>(null)

<G1Humanoid ref={g1Ref} />
<button onClick={() => g1Ref.current?.playDance()}>开始跳舞</button>
<button onClick={() => g1Ref.current?.stopDance()}>停止</button>
```

---

## 七、角度单位换算速查

舞蹈数据用**弧度**，如果你的动画工具导出的是角度或其他单位：

| 转换 | 公式 |
|------|------|
| 度 → 弧度 | `rad = deg * Math.PI / 180` |
| 弧度 → 度 | `deg = rad * 180 / Math.PI` |
| 常见值 | `30° ≈ 0.524`、`45° ≈ 0.785`、`90° ≈ 1.571`、`180° ≈ 3.142` |

关键动作参考角度（弧度）：
- 双手举起：`shoulder_pitch = -2.5`（约 -143°）
- 手臂张开：`shoulder_pitch = -1.2`（约 -69°）
- 扭胯幅度：`waist_yaw = ±0.4`（约 ±23°）
- 转圈总角：`6.28 = 2π = 360°`

---

## 八、分步实施清单

| 步骤 | 内容 | 耗时 | 验证 |
|------|------|------|------|
| 1 | §2.1 校准关节名：打印 URDF joints，填 `JOINT_ALIAS` | 30min | 控制台看到真实关节名列表 |
| 2 | 新建 `dance/subject3-keyframes.ts`（§四） | 10min | tsc 无报错 |
| 3 | 新建 `dance/useDancePlayer.ts`（§五） | 20min | tsc 无报错 |
| 4 | 改造 `G1Humanoid.tsx`（§六）：加载后收集 jointsRef | 40min | 加载完 jointsRef.size ≈ 29 |
| 5 | 接入 useDancePlayer + useFrame | 20min | 无运行时报错 |
| 6 | 加跳舞按钮（Html 或外部按钮） | 10min | 场景出现按钮 |
| 7 | 点击播放，观察关节运动 | 20min | 机器人开始动 |
| 8 | 调优幅度/速度（§十） | 30min | 动作自然 |

**总计约 3 小时。**

---

## 九、验证清单

### 功能
- [ ] 页面加载后 G1 正常站立（idle pose）
- [ ] 出现"🎵 跳科目三"按钮
- [ ] 点击后机器人开始做动作（摇手 → 扭胯 → 转圈 → 滑步 → 举双手）
- [ ] 15 秒后自动循环回摇手
- [ ] 点击"停止"后回到 idle pose，不再动
- [ ] 连续点击多次不会叠加/错乱

### 视觉
- [ ] 手臂有明显大幅摆动（shoulder_roll 达 ±0.6）
- [ ] 转圈时双臂张开（shoulder_pitch ≈ -1.2）
- [ ] 结尾双手高举过头（shoulder_pitch ≈ -2.5）
- [ ] 滑步时整体左右移动（root.position 生效）

### 技术
- [ ] 控制台无 "joint undefined" 报错
- [ ] 所有舞蹈关节都能找到对应 URDF 关节（无大量"未找到"警告）
- [ ] FPS 保持 ≥ 55（跳舞不卡顿）

---

## 十、调优建议

| 想调整 | 怎么改 |
|--------|--------|
| 手臂幅度更大 | `shoulder_roll` 值从 ±0.6 → ±0.9 |
| 转圈更快 | 6-9s 区间 `waist_yaw` 增量从 1.0/step → 1.5/step |
| 整体速度 | `DANCE_DURATION` 不变，改播放时基：`elapsed = (nowSec - startTime) * speedFactor` |
| 脚底不滑 | 减小 `root.position` 偏移；或接入 Foot IK（见 `ROBOT-LOCOMOTION.md` 第六章）|
| 循环无缝 | 确保 `frames[0]` 与 `frames[last]` 姿态接近（当前举双手→摇手有跳变，可加过渡）|
| 支持多支舞 | 新建 `gangnam-style-keyframes.ts` 等同结构文件，传给 `useDancePlayer(_, frames)` |

---

## 十一、常见问题

| 问题 | 原因 | 解决 |
|------|------|------|
| 机器人不动 | 关节名不匹配 | 执行 §2.1 校准，`JOINT_ALIAS` 映射 |
| 某些关节不动 | URDF 关节名带后缀 | 用 `Object.keys(urdfRobot.joints)` 核对 |
| 手臂摆错方向 | rotation 轴不对 | 参考 `JOINT_AXIS_OVERRIDE`，改为 `rotation.x/y` |
| 越转越歪 | `waist_yaw` 累加未归零 | 循环归零：`frameA.joints.waist_yaw %= 2π`（或直接用 root.rotationY）|
| 脚底滑动明显 | 滑步段 root.position + 无 Foot IK | 减小位移或后续加 IK |
| 按钮点不动 | Html 被遮挡 / pointer-events | 确保 `Html` 的 `occlude` 未拦截，zIndex 足够 |
| 跳舞时其他逻辑停 | useFrame 阻塞 | 跳舞纯前端计算，不阻塞；检查是否有重渲染 |

---

## 十二、与其他文档的关系

```
COMPLETE.md              ← 总入口
  ├── UNITREE-SCALE.md    （等比例 L1/L2/L3）
  ├── G1-HUMANOID.md      （组件骨架）
  ├── ROBOT-LOCOMOTION.md （行走步态 / Foot IK）
  └── DANCE.md            ← 本文件（舞蹈动作）
```

- **依赖**：`G1-HUMANOID.md`（关节驱动）、`ROBOT-LOCOMOTION.md`（关节轴映射 `JOINT_AXIS_OVERRIDE`）
- **被依赖**：无（舞蹈是顶层功能）
- **扩展方向**：动作编辑器、Motion Capture 导入、多舞编排（见 `COMPLETE.md` 第十二章路线图 M7+）

---

## 附录 A：新增/修改文件清单

```
packages/digital-twin/
├── src/
│   ├── dance/
│   │   ├── subject3-keyframes.ts   [新增]
│   │   └── useDancePlayer.ts       [新增]
│   └── robots/
│       └── G1Humanoid.tsx           [修改：关节 ref 收集 + 播放器 + 按钮]
```

## 附录 B：未来扩展（动作编辑器预览）

后续可加 `<DanceTimeline>` 组件：
- 左侧关节树（29 DOF 勾选）
- 中间时间轴（0-15s，可拖拽关键帧点）
- 右侧参数面板（角度输入）
- 导出 JSON → 直接作为新的 `xxx-keyframes.ts`

本期不做，仅预留接口：`useDancePlayer(onFrame, frames)` 已支持任意关键帧序列。

## 附录 C：变更日志

- **v1.0**（本文件）：科目三 15s 循环 + 点击按钮播放/停止 + 关节名校准 + 调优指南。
