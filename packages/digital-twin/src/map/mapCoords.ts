// 2026-08-29 高德地图 customCoords 坐标转换
// AMap.GLCustomLayer 下，customCoords 提供 lngLatsToCoords API 将经纬度 → 局部米坐标
// 局部坐标以 customCoords.setCenter([lng, lat]) 的中心为 (0, 0)

export interface MapContext {
  map: any
  customCoords: any
  center: { lng: number; lat: number }
}

// 经纬度 → Three.js 世界坐标
// customCoords.lngLatsToCoords 只返回 [east, north] 二维
// Three 里约定 X 朝东、Y 朝上、Z 朝北，所以映射成 [x, 高度, z]
export function lngLatToWorld(
  ctx: MapContext,
  lng: number,
  lat: number,
  alt = 0,
): [number, number, number] {
  const [[east, north]] = ctx.customCoords.lngLatsToCoords([[lng, lat, alt]])
  return [east, alt, north]
}

// 路线折线（经纬度数组）→ Three.js 世界坐标
// 默认抬高 0.5 米，避免贴地跟地图面片打架（z-fighting）
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

// 动态更新 customCoords 原点
// 机器人跑远了就切中心，不然浮点精度不够会抖
export function updateMapCenter(ctx: MapContext, lng: number, lat: number) {
  ctx.customCoords.setCenter([lng, lat])
  ctx.center = { lng, lat }
}
