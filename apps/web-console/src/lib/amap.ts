// 2026-08-29 高德地图 JS API 封装
// POI 搜索 / 地理编码 / 逆地理编码
// 注意：需要在 index.html 注入 AMap JS API + securityJsCode（见 .env VITE_AMAP_JS_KEY）

declare global {
  interface Window { AMap: any }
}

/** 等 AMap JS API 加载完成 */
export function getAMap(): Promise<any> {
  return new Promise((resolve, reject) => {
    // 已经加载
    if (typeof window !== 'undefined' && window.AMap) {
      return resolve(window.AMap)
    }
    // 没配置 key
    const key = import.meta.env.VITE_AMAP_JS_KEY
    const security = import.meta.env.VITE_AMAP_SECURITY_CODE
    if (!key) {
      return reject(new Error('AMap JS Key 未配置 (VITE_AMAP_JS_KEY)'))
    }
    // 没注入 script → 动态注入（兜底，正常应在 index.html 里注入）
    if (typeof window !== 'undefined' && !document.querySelector('script[src*="webapi.amap.com/maps"]')) {
      // 先注入 security
      if (security && !(window as any)._AMapSecurityConfig) {
        ;(window as any)._AMapSecurityConfig = { securityJsCode: security }
      }
      const s = document.createElement('script')
      s.src = `https://webapi.amap.com/maps?v=2.0&key=${key}&plugin=AMap.PlaceSearch,AMap.Walking,AMap.Geocoder,AMap.Polyline`
      s.async = true
      s.onload = () => resolve(window.AMap)
      s.onerror = () => reject(new Error('AMap JS API 加载失败（检查 Key / 网络 / CSP）'))
      document.head.appendChild(s)
    } else {
      // script 已存在但还没加载好 → 轮询
      let waited = 0
      const timer = setInterval(() => {
        waited += 100
        if (window.AMap) {
          clearInterval(timer)
          resolve(window.AMap)
        } else if (waited > 10000) {
          clearInterval(timer)
          reject(new Error('AMap 加载超时 (>10s)'))
        }
      }, 100)
    }
  })
}

export interface POI {
  id: string
  name: string
  address: string
  lng: number
  lat: number
  type?: string
}

/** 关键字搜索（JS 端，适合少量点 / 交互搜索） */
export async function searchPOI(keyword: string, city = '北京'): Promise<POI[]> {
  const AMap = await getAMap()
  return new Promise((resolve, reject) => {
    const ps = new AMap.PlaceSearch({ city, pageSize: 25, extensions: 'base' })
    ps.search(keyword, (status: string, result: any) => {
      if (status !== 'complete') return reject(new Error(`POI 搜索失败: ${status}`))
      const list: POI[] = (result.poiList?.pois ?? []).map((p: any) => ({
        id: p.id,
        name: p.name,
        address: p.address,
        lng: p.location.getLng(),
        lat: p.location.getLat(),
        type: p.type,
      }))
      resolve(list)
    })
  })
}

/** 地理编码：地址 → 经纬度 */
export async function geocode(address: string, city = '北京') {
  const AMap = await getAMap()
  return new Promise<{ lng: number; lat: number }>((resolve, reject) => {
    const g = new AMap.Geocoder({ city })
    g.getLocation(address, (status: string, result: any) => {
      if (status !== 'complete') return reject(new Error(`Geocode 失败: ${status}`))
      const loc = result.geocodes?.[0]?.location
      if (!loc) return reject(new Error('未找到地址'))
      resolve({ lng: loc.getLng(), lat: loc.getLat() })
    })
  })
}

/** 逆地理编码：经纬度 → 地址（机器人上报时用） */
export async function regeocode(lng: number, lat: number) {
  const AMap = await getAMap()
  return new Promise<any>((resolve, reject) => {
    const g = new AMap.Geocoder({ extensions: 'all' })
    g.getAddress([lng, lat], (status: string, result: any) => {
      if (status !== 'complete') return reject(new Error(`Regeocode 失败: ${status}`))
      resolve(result.regeocode)
    })
  })
}
