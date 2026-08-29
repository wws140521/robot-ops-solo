// 2026-08-29 高德地图 customCoords 坐标转换
// AMap.GLCustomLayer 下，customCoords 提供 lngLatsToCoords API 将经纬度 → 局部米坐标
// 局部坐标以 customCoords.setCenter([lng, lat]) 的中心为 (0, 0)

export interface MapContext {
  map: any
  customCoords: any
  center: { lng: number; lat: number }
}

/** 经纬度 → Three.js 世界坐标（X右/Y上/Z前，高度=Y） */
export function lngLatToWorld(
  ctx: MapContext,
  lng: number,
  lat: number,
  alt = 0,
): [number, number, number] {
  const [[x, y, z]] = ctx.customCoords.lngLatsToCoords([[lng, lat, alt]])
  // Three 坐标系：AMap customCoords 返回的 y 是水平距离，z 是高度
  // 标准映射: Three.X = 东, Three.Y = 海拔(向上), Three.Z = 北
  // customCoords 一般返回 [east, north, up] → Three 直接对应 [x, z, y]
  return [x, z, y]
}

/** 路线折线（经纬度）→ Three.js 世界坐标 */
export function routeToWorld(
  ctx: MapContext,
  route: { lng: number; lat: number }[],
  heightOffset = 0.5,  // 抬升避免 Z-fighting
): [number, number, number][] {
  return route.map((p) => {
    const [x, y, z] = lngLatToWorld(ctx, p.lng, p.lat)
    return [x, y + heightOffset, z]
  })
}

/** 动态更新原点 —— 避免远离中心浮点精度丢失 */
export function updateMapCenter(ctx: MapContext, lng: number, lat: number) {
  ctx.customCoords.setCenter([lng, lat])
  ctx.center = { lng, lat }
}
