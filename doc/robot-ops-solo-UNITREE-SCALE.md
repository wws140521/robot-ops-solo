# 宇树机器人等比例还原 · 终极优化开发文档

> **适用项目**：robot-ops-solo（跨品牌机器人运维中台）
> **适用机型**：Unitree G1（29 DOF 旗舰人形）、Go2（四足）、H1（全尺寸人形）、B2（工业四足）
> **版本**：v1.0 | **更新日期**：2026-08-28
> **前置文档**：`DEV-GUIDE.md`、`3D-VIEW.md`、`G1-HUMANOID.md`

---

## 文档定位

这份文档是所有"宇树机型等比例还原"的**单一事实来源（Single Source of Truth）**。它解决一个核心问题：

> **如何让一个数字孪生模型在尺寸、外观、运动学三个维度上，与真实宇树机器人 100% 吻合。**

无论你后续接的是 G1、Go2、H1 还是 B2，都遵循本文档的流程、校验清单和代码规范。

---

## 一、等比例的三层含义（必须先厘清）

"等比例"不是一句模糊的话，它精确对应三层，缺一层都不算还原：

| 层级 | 含义 | 判据 | 失败表现 |
|------|------|------|---------|
| **L1 几何等比例** | 模型尺寸 = 真实尺寸（米制） | 身高、臂展、轮/足间距与官方规格一致 | 机器人巨大/微小、比例失调 |
| **L2 视觉等比例** | 外观 = 真实外观 | mesh 几何、材质、配色与真机一致 | 看起来"不像" |
| **L3 运动学等比例** | 关节运动 = 真实运动 | DOF 数、轴方向、限位、连杆长度一致 | 关节反向/超限/肢体错位 |

> 🎯 **目标**：L1 是基础（必过），L2 决定演示效果，L3 决定能否用于真实运维。

---

## 二、宇树机型规格速查表（L1 校验基准）

**所有等比例校验必须以官方规格为准**。以下是宇树公开参数（务必在项目 Wiki 里维护最新值）：

| 机型 | 类型 | 身高 (m) | 体重 (kg) | DOF | 连杆/关节要点 | URDF 可得性 |
|------|------|---------|----------|-----|-------------|-----------|
| **G1 29 DOF** | 人形 | 1.27-1.32 | 35 | 29 | 双腿12 + 双臂14 + 腰2 + 颈1 | ✅ 官方公开 |
| **G1 23 DOF** | 人形 | 1.27 | 35 | 23 | 固定腰部版本 | ✅ 官方公开 |
| **H1** | 全尺寸人形 | 1.80 | 47 | 19 | 腿部 6×2、手臂 5×2（含夹爪）| ✅ unitree_ros |
| **Go2** | 四足 | 0.69 | 15 | 12 | 每条腿 3 关节（hip/hip2/knee）| ⚠️ DAE 为主 |
| **B2** | 工业四足 | 1.09 | 60 | 12 | Go2 结构 + 强化 | ⚠️ 需申请 |

**校验锚点（以 G1 为例）**：
- 站立身高 ≈ **1.30 m**
- 肩宽 ≈ **0.42 m**
- 大腿长度 ≈ **0.28 m**，小腿 ≈ **0.28 m**
- 单臂展开 ≈ **0.65 m**

> 这些值在 RViz/Blender/R3F 三处都必须吻合，才算 L1 通过。

---

## 三、资源获取权威渠道

### 3.1 官方渠道（首选）

| 渠道 | 内容 | 地址 |
|------|------|------|
| **Unitree GitHub** | ROS/ROS2 包、URDF、IDL、SDK | `github.com/unitreerobotics` |
| **unitree_ros** | G1/H1 URDF + meshes + launch | `unitreerobotics/unitree_ros` |
| **unitree_ros2** | ROS2（Humble）版本 | `unitreerobotics/unitree_ros2` |
| **unitree_mujoco** | MuJoCo 高精度模型（含 G1 37 DOF）| `unitreerobotics/unitree_mujoco` |
| **orikuma/g1_description** | 社区维护的 G1 23/29 DOF 干净版 | `github.com/orikuma/g1_description` |

### 3.2 获取步骤（以 G1 29 DOF 为例）

```bash
# 1. 克隆资源库
git clone https://github.com/orikuma/g1_description.git /tmp/g1_desc
cd /tmp/g1_desc

# 2. 确认变体文件
ls urdf/
# → g1_23dof.urdf  g1_29dof.urdf  g1_29dof_with_hand.urdf

# 3. 拷贝到项目
mkdir -p apps/web-console/public/models/g1
cp urdf/g1_29dof.urdf        apps/web-console/public/models/g1/
cp -r meshes                 apps/web-console/public/models/g1/

# 4. 目录结构应如下
# public/models/g1/
# ├── g1_29dof.urdf
# └── meshes/
#     ├── base_link.STL
#     ├── left_hip_pitch_link.STL
#     └── ...（每个 link 一个 STL）
```

### 3.3 许可注意

- 宇树官方资源多为 **BSD / Apache 2.0**，可商用但需保留版权声明
- **必须在仓库 `LICENSE` 中注明宇树原始模型来源**，遵守 attribution 条款

---

## 四、URDF 路线（运动学真源 · 推荐）

### 4.1 为什么 URDF 是等比例还原的"真源"

URDF 不只是 mesh 容器，它**显式定义了运动学链**：
- `<link>`：每个刚体 + 其视觉/碰撞几何（含 `scale`）
- `<joint>`：父子 link 连接 + `origin`（位置/姿态）+ `axis`（旋转轴）+ `limit`（弧度限位）
- `<inertial>`：质量/惯量（仿真用）

只要 URDF 的数值单位是米、mesh 缩放正确，**three-urdf 加载后自动就是等比例的**。

### 4.2 URDF 关键结构（等比例相关字段标注）

```xml
<robot name="g1_29dof">
  <!-- 基座 link -->
  <link name="base_link">
    <visual>
      <origin xyz="0 0 0" rpy="0 0 0"/>
      <geometry>
        <!-- ⚠️ scale 是等比例头号开关：CAD 为 mm 时填 0.001 -->
        <mesh filename="package://g1/meshes/base_link.STL"
              scale="0.001 0.001 0.001"/>
      </geometry>
      <material name="body_dark">
        <color rgba="0.13 0.13 0.15 1.0"/>
      </material>
    </visual>
    <collision>
      <geometry>
        <mesh filename="package://g1/meshes/base_link_collision.STL"
              scale="0.001 0.001 0.001"/>
      </geometry>
    </collision>
    <inertial>
      <mass value="2.5"/>
      <inertia ixx="0.05" ixy="0" ixz="0" iyy="0.05" iyz="0" izz="0.03"/>
    </inertial>
  </link>

  <!-- 旋转关节示例 -->
  <joint name="left_hip_pitch_joint" type="revolute">
    <parent link="base_link"/>
    <child link="left_hip_pitch_link"/>
    <!-- origin 决定连杆相对位置（米制）-->
    <origin xyz="0.05 0.12 0.0" rpy="0 0 0"/>
    <!-- axis 决定旋转轴（关节驱动的关键）-->
    <axis xyz="0 1 0"/>
    <limit lower="-2.356" upper="2.356" effort="45" velocity="3.14"/>
  </joint>
</robot>
```

### 4.3 六类关节类型速查

| type | 运动 | 典型用途 | 是否有 `limit` |
|------|------|---------|--------------|
| `fixed` | 无 | 传感器、外壳 | 否 |
| `revolute` | 旋转（有限）| 肘、膝、肩俯仰 | ✅ |
| `continuous` | 无限旋转 | 轮毂、转盘 | 否（无上下限）|
| `prismatic` | 线性滑动 | 升降、夹爪 | ✅ |
| `floating` | 6 DOF 自由 | 完整漂浮基座（罕见）| 否 |
| `planar` | 平面内 3 DOF | 移动基座 | 否 |

### 4.4 前端加载（three-urdf，自动坐标系转换）

```tsx
// packages/digital-twin/src/robots/G1Humanoid.tsx
import { Canvas, useFrame } from '@react-three/fiber'
import { OrbitControls, Environment, Grid } from '@react-three/drei'
import { useEffect, useRef, useState } from 'react'
import { parseURDF, loadRobot } from 'three-urdf'
import { useRobotState } from '../../store/RobotStateContext'

const URDF_TEXT = '/models/g1/g1_29dof.urdf'
const PACKAGE_MAP = { g1: '/models/g1' }  // package://g1 → /models/g1

function G1Model({ joints }: { joints?: Record<string, number> }) {
  const [robot, setRobot] = useState<any>(null)
  const meshRef = useRef<any>()

  useEffect(() => {
    let cancelled = false
    fetch(URDF_TEXT)
      .then(r => r.text())
      .then(text => {
        const model = parseURDF(text, { packageMap: PACKAGE_MAP })
        // loadRobot 自动处理 Z-up → Y-up + mesh 变换
        return loadRobot(model, { upAxis: 'y' })
      })
      .then(obj => { if (!cancelled) setRobot(obj) })
    return () => { cancelled = true }
  }, [])

  useFrame(() => {
    if (robot && joints) robot.setJointValues(joints)
  })

  if (!robot) return <PlaceholderRobot />  // 降级占位
  return <primitive object={robot} ref={meshRef} />
}

export function G1Humanoid({ robotId }: { robotId: string }) {
  const robot = useRobotState(robotId)
  return (
    <Canvas shadows dpr={[1, 2]} camera={{ position: [1.5, 1, 1.5], fov: 50 }}>
      <color attach="background" args={['#0a0e1a']} />
      <Environment preset="warehouse" />
      <Grid args={[10, 10]} cellColor="#1a2235" sectionColor="#00f0ff" fadeDistance={20} infiniteGrid />
      <G1Model joints={robot?.joints} />
      <OrbitControls enablePan enableDamping autoRotate={false} />
    </Canvas>
  )
}
```

### 4.5 等比例校验（L1 必须过）

在浏览器控制台打印尺寸，与**第二节规格表**比对：

```ts
// 校验脚本：挂载到 window 便于调试
useEffect(() => {
  if (robot) {
    const box = new THREE.Box3().setFromObject(robot)
    const size = box.getSize(new THREE.Vector3())
    console.table({
      '身高(m)': size.y.toFixed(3),
      '宽度(m)': size.x.toFixed(3),
      '深度(m)': size.z.toFixed(3),
    })
    // G1 期望：身高 ≈ 1.30, 宽度 ≈ 0.42
  }
}, [robot])
```

**同时通过三处校验**：
1. ✅ R3F 里 `Box3` 量身高 ≈ 1.30 m
2. ✅ RViz 里 `urdf_tutorial display` 量身高 ≈ 1.30 m
3. ✅ Blender 里打开 GLB/STL 量身高 ≈ 1.30 m

三处一致 → L1 通过。

---

## 五、GLB 路线（视觉还原 · 照片级）

### 5.1 何时走 GLB

- 数字孪生大屏追求**照片级外观**（PBR 材质、纹理、自发光）
- 仅需整体位姿/简单动画，不需要完整运动学链
- 作为 URDF 的**视觉表现层**（混合架构，见第七节）

### 5.2 CAD → GLB 标准管线

```
SolidWorks / Fusion 360 / FreeCAD（参数化 CAD）
        ↓ ① 导出 STEP（保留 B-Rep，精度最高）
robot.step
        ↓ ② FreeCAD 转 glTF 2.0
robot.glb
        ↓ ③ Blender 校验 + 优化
robot_opt.glb（Draco/KTX2 压缩）
```

**Step 2 FreeCAD 操作**：
```
File → Open → robot.step
（确认装配层级/坐标系正确）
File → Export → glTF 2.0 (*.glb)  ← 选单文件 .glb
```

**Step 3 Blender 校验清单**（按 N 看尺寸面板）：
- [ ] **单位 = 米**（Scene → Units → Unit Scale = 1.0, Unit = Meters）
- [ ] **轴向 = Y-up**（glTF 标准）
- [ ] **原点 = 脚底/底座**（机器人"站立在地面"，非漂浮）
- [ ] **Scale = 1.0** + `Ctrl+A → Apply All Transforms`（防引擎爆炸）
- [ ] **材质分区**：外壳/内骨架/自发光分不同材质槽（便于换色）
- [ ] **三角面 < 500K**（移动端预算）

### 5.3 压缩优化（必做）

```bash
# Draco 压缩顶点（体积 ↓ 60%+）
npx gltf-pipeline -i robot.glb -o robot_compressed.glb -d

# 全套优化（推荐）
npx @gltf-transform/cli optimize robot.glb robot_opt.glb \
  --texture-compress ktx2 \
  --mesh-quantize \
  --prune \
  --simplify 0.5   # 可选：减少 50% 三角面
```

| 手段 | 效果 |
|------|------|
| Draco | 顶点压缩，文件 ↓ 5-10× |
| KTX2/Basis | GPU 原生纹理，显存 ↓ 70% |
| Mesh Quantize | 精度量化，体积 ↓ |
| Prune | 删除未用节点/纹理 |
| Simplify | 降面（视觉代价）|

### 5.4 R3F 加载

```tsx
import { useGLTF } from '@react-three/drei'

function RobotGLB() {
  const { scene } = useGLTF('/models/g1/g1_visual.glb')
  return <primitive object={scene} />
}
useGLTF.preload('/models/g1/g1_visual.glb')
```

---

## 六、等比例头号坑：单位与坐标系

> **90% 的"不等比例"问题来自这两点。** 务必理解透彻。

### 6.1 单位转换速查

URDF 生态**统一使用米制**。但 CAD/网格导出时常为其他单位，需在 URDF `<mesh scale>` 补偿：

| 源单位 | scale 值 | 典型来源 |
|--------|---------|---------|
| 米 (m) | `1 1 1` | 规范的 ROS URDF |
| 毫米 (mm) | `0.001 0.001 0.001` | OpenSCAD、SolidWorks 默认、大多数 STL |
| 厘米 (cm) | `0.01 0.01 0.01` | 部分 Blender 导出 |
| 英寸 (in) | `0.0254 0.0254 0.0254` | SketchUp、老 DAE |

**G1 的 STL 几乎都是 mm → 必须 `scale="0.001 0.001 0.001"`。**

### 6.2 坐标系：Z-up vs Y-up

| 系统 | Up 轴 | 前轴 |
|------|-------|------|
| ROS / URDF / MuJoCo | **+Z** | +X |
| Three.js / glTF / Unity | **+Y** | +Z |

**转换方式**：
- `three-urdf`：`loadRobot(model, { upAxis: 'y' })` **自动转换** ✅
- `urdf-loader`：需手动 `robot.rotateX(-Math.PI / 2)` ⚠️
- GLB 路线：Blender 导出时直接选 Y-up ✅

### 6.3 排查流程（机器人"躺倒/巨大/错位"时）

```
现象 → 检查项
─────────────────────────────────
巨大无比 → mesh scale 是否漏设（mm 需 0.001）
小如蚂蚁 → scale 是否过度（改回 1 1 1）
躺倒     → Z-up/Y-up 是否转换
某些错位 → CAD 导出坐标系 ≠ ROS，加 world frame
关节不动 → 关节名不匹配，打印 robot.joints
引擎爆炸 → Blender 未 Apply Transform
```

---

## 七、混合架构（终极方案 · 推荐生产用）

> **URDF 做运动学真源 + GLB 做视觉表现层** —— 这是机器人数字孪生的最高阶做法。

### 7.1 数据流

```
真实机器人
    ↓ WebSocket: /joint_states
wsHub → Zustand robotStore（joints: Record<string, number>）
    ↓
┌────────────────────┬────────────────────┐
↓                    ↓                    ↓
URDF (three-urdf)    GLB (useGLTF)        HUD (Drei Html)
关节变换矩阵 ──→ 驱动 GLB 骨骼      状态标签锚定
    ↓                    ↓
  统一渲染到 R3F Canvas
```

### 7.2 关节 → GLB 骨骼映射

URDF 的 joint name 与 GLB 的 bone name 需建立映射表：

```ts
// packages/digital-twin/src/robots/g1BoneMap.ts
export const G1_BONE_MAP: Record<string, string> = {
  // urdf joint name → glb bone name
  'left_hip_pitch_joint': 'L_hip_pitch',
  'left_knee_joint':      'L_knee',
  'left_ankle_pitch_joint':'L_ankle_pitch',
  'right_shoulder_pitch_joint': 'R_shoulder_pitch',
  // ... 完整 29 项
}
```

每帧同步：
```ts
useFrame(() => {
  const joints = useRobotStore.getState().robots[id]?.joints
  glb.scene.traverse(obj => {
    if ((obj as THREE.Bone).isBone) {
      const jointName = reverseBoneMap[obj.name]
      if (jointName && joints?.[jointName] != null) {
        // 按 axis 应用旋转（参考 G1-HUMANOID 文档的 getJointAxis）
        applyJointRotation(obj, jointName, joints[jointName])
      }
    }
  })
})
```

> 💡 **优势**：URDF 保证运动学精确（L3），GLB 保证视觉精度（L2），各司其职。

---

## 八、性能优化（复杂机器人必备）

| 策略 | 做法 | 收益 |
|------|------|------|
| **LOD** | `Detailed` 分近/中/远三级细节 | 远处自动降面 |
| **Instancing** | `Instances` 渲染多机 fleet | 百台同屏不卡 |
| **Draco/KTX2** | 压缩几何/纹理 | 首帧 ↓ 70% |
| **Frustum Culling** | Three 默认开启，勿关 | 屏外不渲染 |
| **useFrame 优化** | 仅 mutate，不 new 对象 | 避免 GC 卡顿 |
| **Dpr 限制** | `dpr={[1, 2]}` | 4K 屏不过度渲染 |
| **Suspense 懒加载** | 模型异步加载不阻塞 | 首屏快 |
| **共享材质** | 同色零件共用 Material | 减少 draw call |

### 性能预算表（达标线）

| 指标 | 目标 | 警戒线 |
|------|------|--------|
| 帧率 | ≥ 60 fps | < 30 |
| Draw call | < 200 | > 500 |
| 三角面 | < 500K | > 1M |
| 首帧时间 | < 3 s | > 8 s |
| 内存 | < 500 MB | > 1 GB |

---

## 九、完整校验清单（L1 + L2 + L3）

### L1 几何等比例
- [ ] URDF 所有 `xyz` 单位为米
- [ ] 每个 mesh 的 `scale` 与源单位匹配（mm→0.001）
- [ ] `Box3` 量身高 ≈ 官方值（G1: 1.30 m）
- [ ] 肩宽、臂展、腿长与官方一致
- [ ] RViz / Blender / R3F 三处尺寸一致

### L2 视觉等比例
- [ ] Blender 单位 = 米，Scale = 1.0（已 Apply）
- [ ] Y-up，原点在脚底
- [ ] 材质分区正确（外壳/骨架/自发光）
- [ ] 三角面 < 500K
- [ ] Draco/KTX2 已压缩

### L3 运动学等比例
- [ ] DOF 数 = 官方（G1: 29）
- [ ] 每个关节 `axis` 方向正确（参考 `JOINT_AXIS_OVERRIDE`）
- [ ] 每个关节 `limit` 弧度值与官方一致
- [ ] mock `/joint_states` 驱动后，姿态与真机一致
- [ ] 无关节反向/超限

### 合规
- [ ] LICENSE 注明宇树模型来源 + 遵守 attribution
- [ ] 未使用未授权的商业 mesh

---

## 十、分步实施（以 G1 29 DOF 为例）

| 步骤 | 动作 | 耗时 | 验证点 |
|------|------|------|--------|
| 1 | `git clone orikuma/g1_description` | 5 min | urdf + meshes 存在 |
| 2 | 拷贝到 `public/models/g1/` | 5 min | 目录结构正确 |
| 3 | 打开 `g1_29dof.urdf`，核对所有 `scale` | 15 min | mm→0.001 全部到位 |
| 4 | `pnpm add three-urdf urdf-loader three@0.162.0` | 10 min | 依赖装齐 |
| 5 | 实现 `G1Humanoid.tsx`（第四节代码） | 1 h | 无 TS 报错 |
| 6 | mock 推 `/joint_states` | 15 min | wsHub 收到 |
| 7 | **运行 L1 校验**（Box3 量身高）| 15 min | ≈ 1.30 m ✅ |
| 8 | 校准 `JOINT_AXIS_OVERRIDE` | 30 min | 关节方向正确 |
| 9 | 接 GLB 视觉层（混合架构，可选）| 2 h | 视觉升级 |
| 10 | 跑完整校验清单（第九节）| 30 min | 全绿 |

**总计约 5-6 小时**，即可从零得到一个 100% 等比例的 G1 数字孪生。

---

## 十一、常见问题 FAQ

**Q1：身高量出来是 1300 m 而不是 1.3 m？**
→ mesh scale 漏设，STL 是 mm，需 `scale="0.001 0.001 0.001"`。

**Q2：身高量出来是 0.0013 m？**
→ scale 过度，改回 `1 1 1`。

**Q3：机器人躺倒/侧翻？**
→ Z-up/Y-up 未转换。`three-urdf` 用 `loadRobot(model, { upAxis: 'y' })`；`urdf-loader` 手动 `rotateX(-PI/2)`。

**Q4：某些 link 明显错位？**
→ CAD 导出坐标系与 ROS 约定不同，需在 URDF 加 `world` link 做坐标转换。

**Q5：关节完全不动？**
→ 打印 `robot.joints` 看实际关节名，与 mock 推送的 key 对齐。

**Q6：Go2 加载后 mesh 变形？**
→ Go2 多为 DAE 格式，Three 0.162+ 有兼容问题；优先转 GLB 或用指定版本。

**Q7：three-urdf vs urdf-loader 怎么选？**
→ 要省心（自动坐标系转换+TypeScript）→ `three-urdf`；要贴近 ROS 原生 → `urdf-loader`。推荐 `three-urdf`。

---

## 十二、与其他文档的关系

```
DEV-GUIDE.md          ← 项目总纲、monorepo 架构
  ├── 3D-VIEW.md             ← 3D 视图通用优化（R3F/Drei/性能）
  ├── G1-HUMANOID.md         ← G1 组件代码 + 关节驱动
  ├── UI-OPTIMIZATION.md     ← 科技感 UI（含 3D HUD 叠加层）
  └── UNITREE-SCALE.md       ← 【本文】宇树等比例还原终极规范
```

**职责边界**：
- `3D-VIEW.md`：所有机器人通用的 3D 技术（渲染、光照、HUD、性能）
- `G1-HUMANOID.md`：G1 这一个组件的代码实现
- `UNITREE-SCALE.md`：**所有宇树机型**的等比例还原规范、校验清单、混合架构

> 新增机型（Go2/H1/B2）时，**只扩展本文档**（加规格行 + 资源地址 + 校验锚点），不改其他文档。

---

## 附录 A：机型扩展模板（以 H1 为例）

```yaml
# 在第二节规格表新增一行
H1:
  type: humanoid
  height_m: 1.80
  weight_kg: 47
  dof: 19
  urdf_source: unitree_ros/urdf/h1.urdf
  mesh_unit: mm          # → scale 0.001
  up_axis: z             # three-urdf 自动转
  notes: 腿部 6×2 + 手臂 5×2（含夹爪）
```

```ts
// 在 G1Humanoid.tsx 基础上参数化
export function UnitreeRobot({ model, robotId }: {
  model: 'g1_29' | 'h1' | 'go2' | 'b2'
  robotId: string
}) {
  const URDF_MAP = {
    g1_29: { url: '/models/g1/g1_29dof.urdf', pkg: { g1: '/models/g1' }, dof: 29 },
    h1:    { url: '/models/h1/h1.urdf',       pkg: { h1: '/models/h1' }, dof: 19 },
    go2:   { url: '/models/go2/go2.urdf',     pkg: { go2: '/models/go2' }, dof: 12 },
    b2:    { url: '/models/b2/b2.urdf',       pkg: { b2: '/models/b2' }, dof: 12 },
  }
  const cfg = URDF_MAP[model]
  // ... 其余逻辑复用（加载、驱动、校验）
}
```

---

## 附录 B：权威参数核对（务必定期更新）

| 机型 | 官方身高 | 官方体重 | DOF | 来源 |
|------|---------|---------|-----|------|
| G1 29 DOF | 1.27-1.32 m | 35 kg | 29 | unitree_ros / orikuma |
| G1 23 DOF | 1.27 m | 35 kg | 23 | orikuma/g1_description |
| H1 | 1.80 m | 47 kg | 19 | unitree_ros |
| Go2 | 0.69 m | 15 kg | 12 | unitree_ros2 |
| B2 | 1.09 m | 60 kg | 12 | 宇树官网 |

> ⚠️ 宇树会更新规格，本文数据基于 2026-08 公开信息。**接入新机型前务必去 `unitreerobotics` GitHub 核对最新 URDF**。

---

## 附录 C：版本与变更

| 版本 | 日期 | 变更 |
|------|------|------|
| v1.0 | 2026-08-28 | 首版：三层等比例、双路线、混合架构、完整校验清单、机型扩展模板 |

---

> **一句话总结**：宇树机器人等比例还原 = **URDF 保运动学（L3）+ GLB 保视觉（L2）+ 米制单位/坐标系保几何（L1）**。用 `three-urdf` 自动处理坐标系，用 `Box3` 三处校验几何，用 `JOINT_AXIS_OVERRIDE` 校准关节——这是 2026 年机器人数字孪生的事实标准栈。
