// 2026-08-29 低通滤波 —— GPS heading / speed / lat / lng 平滑
// GPS 原始抖动大，直接用会让机器人在地图上"跳"；alpha 越小越稳但越滞后

/** 一阶低通滤波器：平滑 heading 时要用 unwrap 处理 ±π 跳变 */
export function lowPass(current: number, prev: number, alpha = 0.3): number {
  return prev + alpha * (current - prev)
}

/** 角度低通：处理 ±π 跳变 */
export function lowPassAngle(current: number, prev: number, alpha = 0.3): number {
  let diff = current - prev
  while (diff > Math.PI) diff -= Math.PI * 2
  while (diff < -Math.PI) diff += Math.PI * 2
  const smoothed = prev + alpha * diff
  // 归一化到 [0, 2π)
  return ((smoothed % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2)
}
