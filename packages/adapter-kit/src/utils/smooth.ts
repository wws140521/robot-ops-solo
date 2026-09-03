// 2026-08-29 低通滤波 —— GPS heading / speed / lat / lng 平滑
// GPS 原始抖动大，直接用会让机器人在地图上"跳"；alpha 越小越稳但越滞后

// 一阶低通滤波，GPS heading/speed 这种跳来跳去的字段先用它压一压
// alpha 默认 0.3，越小越平滑但也越滞后，自己看着调
export function lowPass(current: number, prev: number, alpha = 0.3): number {
  return prev + alpha * (current - prev)
}

// 角度版低通，主要处理 ±π 那个跳变，不然 heading 会鬼畜
export function lowPassAngle(current: number, prev: number, alpha = 0.3): number {
  let diff = current - prev
  while (diff > Math.PI) diff -= Math.PI * 2
  while (diff < -Math.PI) diff += Math.PI * 2
  const smoothed = prev + alpha * diff
  // 归一化到 [0, 2π)
  return ((smoothed % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2)
}
