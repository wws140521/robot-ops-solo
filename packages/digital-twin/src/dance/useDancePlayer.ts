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