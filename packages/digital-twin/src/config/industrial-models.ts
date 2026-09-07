// 工业机器人真实模型配置
// 当 public/models/<brand>/robot.urdf 存在时，IndustrialRobotModel 会加载它
// 否则降级到程序化机械臂（FanucArm / KukaArm）

import type { JointTelemetry } from 'robot-adapter-kit'

// 支持真实 URDF 加载的工业品牌
export type IndustrialBrand = 'FANUC' | 'KUKA' | 'ESTUN' | 'YASKAWA'

// 每个品牌的模型配置：URDF 路径、资源包映射、关节名映射
export interface IndustrialModelConfig {
  brand: IndustrialBrand
  displayName: string
  urdfPath: string
  // three-urdf 的 package:// 映射，例如 { 'fanuc_support': '/models/fanuc' }
  packageMap: Record<string, string>
  // 遥测 joint index → URDF 关节名
  // 索引从 1 开始，和 JointTelemetry.j 对应
  jointMap: Record<number, string>
  // 模型默认缩放
  scale: number
  // 模型底座离地高度修正（部分 URDF 原点不在地面）
  liftY: number
}

export const INDUSTRIAL_MODELS: Record<IndustrialBrand, IndustrialModelConfig> = {
  FANUC: {
    brand: 'FANUC',
    displayName: 'FANUC M-20iA',
    urdfPath: '/models/fanuc/robot.urdf',
    packageMap: { fanuc_support: '/models/fanuc' },
    // 官方 M-20iA URDF 关节名，索引从 1 开始对应 JointTelemetry.j
    jointMap: {
      1: 'joint_1',
      2: 'joint_2',
      3: 'joint_3',
      4: 'joint_4',
      5: 'joint_5',
      6: 'joint_6',
    },
    // 真实尺寸约 2m+，稍微压一点让它在场景里和 G1 协调
    scale: 0.85,
    liftY: 0,
  },
  KUKA: {
    brand: 'KUKA',
    displayName: 'KUKA KR 6 R900 sixx',
    urdfPath: '/models/kuka/robot.urdf',
    packageMap: { kuka_kr10_support: '/models/kuka' },
    // KUKA 官方命名是 joint_a1..joint_a6，别和 FANUC 的搞混
    jointMap: {
      1: 'joint_a1',
      2: 'joint_a2',
      3: 'joint_a3',
      4: 'joint_a4',
      5: 'joint_a5',
      6: 'joint_a6',
    },
    // KR6 是小个子（站高不到 1m），放大一点保持视觉均衡
    scale: 1.3,
    liftY: 0,
  },
  ESTUN: {
    brand: 'ESTUN',
    displayName: 'ESTUN iER7-910',
    urdfPath: '/models/estun/robot.urdf',
    packageMap: { estun_support: '/models/estun' },
    jointMap: {
      1: 'joint_1',
      2: 'joint_2',
      3: 'joint_3',
      4: 'joint_4',
      5: 'joint_5',
      6: 'joint_6',
    },
    scale: 1.0,
    liftY: 0,
  },
  YASKAWA: {
    brand: 'YASKAWA',
    displayName: 'YASKAWA GP7',
    urdfPath: '/models/yaskawa/robot.urdf',
    packageMap: { yaskawa_support: '/models/yaskawa' },
    // 安川官方命名带轴后缀：s/l/u/r/b/t 分别对应 S/L/U/R/B/T 轴
    jointMap: {
      1: 'joint_1_s',
      2: 'joint_2_l',
      3: 'joint_3_u',
      4: 'joint_4_r',
      5: 'joint_5_b',
      6: 'joint_6_t',
    },
    scale: 1.0,
    liftY: 0,
  },
}

// 判断品牌是否属于工业机械臂
export function isIndustrialBrand(brand?: string): brand is IndustrialBrand {
  if (!brand) return false
  return Object.prototype.hasOwnProperty.call(INDUSTRIAL_MODELS, brand)
}

// 将遥测关节数组转换为 URDF 关节值映射
export function telemetryToUrdfJoints(
  joints: JointTelemetry[],
  config: IndustrialModelConfig
): Record<string, number> {
  const result: Record<string, number> = {}
  joints.forEach((jt) => {
    const name = config.jointMap[jt.j]
    if (name) {
      result[name] = jt.angle_rad ?? 0
    }
  })
  return result
}
