/**
 * 机器人类型判断工具
 * 按品牌区分工业机械臂 / 移动机器人 / 协作机器人，用于差异化 UI 渲染
 */

export type RobotCategory = 'industrial_arm' | 'mobile_robot' | 'collaborative'

const INDUSTRIAL_BRANDS = ['fanuc', 'kuka', 'estun', 'yaskawa', 'abb']
const MOBILE_BRANDS = ['keenon', 'unitree', 'pudutech', 'agibot', 'agv', 'amr']

export function getRobotCategory(brand: string): RobotCategory {
  const b = brand.toLowerCase()
  if (INDUSTRIAL_BRANDS.includes(b)) return 'industrial_arm'
  if (MOBILE_BRANDS.includes(b)) return 'mobile_robot'
  return 'collaborative'
}

/**
 * 判断是否为工业机械臂（只读监控，不显示电量）
 */
export function isIndustrialArm(brand: string): boolean {
  return getRobotCategory(brand) === 'industrial_arm'
}

/**
 * 判断是否为移动机器人（显示电量 + 位置坐标）
 */
export function isMobileRobot(brand: string): boolean {
  return getRobotCategory(brand) === 'mobile_robot'
}
