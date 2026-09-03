// 机器人类型判断，按品牌分工业臂/移动机器人/协作机器人
// 决定 UI 上要不要显示电量、3D 模型、控制按钮这些

export type RobotCategory = 'industrial_arm' | 'mobile_robot' | 'collaborative'

const INDUSTRIAL_BRANDS = ['fanuc', 'kuka', 'estun', 'yaskawa', 'abb']
const MOBILE_BRANDS = ['keenon', 'unitree', 'pudutech', 'agibot', 'agv', 'amr']

export function getRobotCategory(brand: string): RobotCategory {
  const b = brand.toLowerCase()
  if (INDUSTRIAL_BRANDS.includes(b)) return 'industrial_arm'
  if (MOBILE_BRANDS.includes(b)) return 'mobile_robot'
  // 未识别品牌按协作机器人处理：既不给它下发移动指令，也不按工业只读限制
  return 'collaborative'
}

// 是不是工业机械臂，是的话只读监控，不下控制指令也不显示电量
export function isIndustrialArm(brand: string): boolean {
  return getRobotCategory(brand) === 'industrial_arm'
}

// 是不是移动机器人，是的话显示电量坐标并开放控制指令
export function isMobileRobot(brand: string): boolean {
  return getRobotCategory(brand) === 'mobile_robot'
}
