// 2026-08-29 高德地图 customCoords 坐标转换
// AMap.GLCustomLayer 下，customCoords 提供 lngLatsToCoords API 将经纬度 → 局部米坐标
// 局部坐标以 customCoords.setCenter([lng, lat]) 的中心为 (0, 0)

export interface MapContext {
  map: any
  customCoords: any
  center: { lng: number; lat: number }
}

/** 经纬度 → Three.js 世界坐标（GLCustomLayer 下 customCoords 返回值可直接喂给 Three）
 *  customCoords.lngLatsToCoords 返回 [east_meters, north_meters] — 仅 2D！
 *  Three 坐标系（GLCustomLayer 约定）：X=东, Y=上, Z=北
 *  → 映射 [east, north] → [X, altitude, Z] = [x, alt, z]
 */
export function lngLatToWorld(
  ctx: MapContext,
  lng: number,
  lat: number,
  alt = 0,
): [number, number, number] {
  const [[east, north]] = ctx.customCoords.lngLatsToCoords([[lng, lat, alt]])
  return [east, alt, north]
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
