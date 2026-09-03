// 2026-08-29 高德步行/驾车路径规划

import { getAMap } from './amap'

export interface RoutePoint { lng: number; lat: number; floor?: number }

// 高德步行路径规划，室外机器人首选，走人行道
export async function planWalking(from: RoutePoint, to: RoutePoint): Promise<RoutePoint[]> {
  const AMap = await getAMap()
  return new Promise((resolve, reject) => {
    const walking = new AMap.Walking({ map: null, hideMarkers: true })
    walking.search(
      [from.lng, from.lat],
      [to.lng, to.lat],
      (status: string, result: any) => {
        if (status !== 'complete') return reject(new Error(`Walking 规划失败: ${status}`))
        const path = result.routes?.[0]?.steps ?? []
        const points: RoutePoint[] = []
        path.forEach((step: any) => {
          step.path?.forEach((p: any) => points.push({ lng: p.getLng(), lat: p.getLat() }))
        })
        resolve(points)
      }
    )
  })
}

// 多点串联路线，A→B→C 一段段拼起来
export async function planMultiWaypoints(waypoints: RoutePoint[]): Promise<RoutePoint[]> {
  const all: RoutePoint[] = []
  for (let i = 0; i < waypoints.length - 1; i++) {
    const seg = await planWalking(waypoints[i], waypoints[i + 1])
    all.push(...seg)
  }
  return all
}

// 简化路径点，默认 0.0001° 约 10m，减少 WS 发送频率
export function simplifyRoute(points: RoutePoint[], minDist = 0.0001): RoutePoint[] {
  if (points.length <= 2) return points
  const out: RoutePoint[] = [points[0]]
  for (let i = 1; i < points.length - 1; i++) {
    const prev = out[out.length - 1]
    const p = points[i]
    const d = Math.hypot(p.lng - prev.lng, p.lat - prev.lat)
    if (d > minDist) out.push(p)
  }
  out.push(points[points.length - 1])
  return out
}
