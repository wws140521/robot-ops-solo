// 2026-08-29 室外模式 GPS 适配器
// 真实机器人 GPS/WGS-84 原始报文 → UnifiedRobotState（GCJ-02 纠偏）
// 高德/腾讯/百度中国区统一用 GCJ-02，GPS 直接画会偏移 300~500m

import type { UnifiedRobotState } from '../types/unified'

/** 机器人原始 GPS 报文（WGS-84，GPS/手机/大多数模块默认坐标系） */
export interface GpsRawMsg {
  deviceId: string
  lat: number        // WGS-84 纬度
  lng: number        // WGS-84 经度
  alt?: number
  heading: number    // 0-360，正北为 0，顺时针
  speed: number      // m/s
  accuracy?: number  // 定位精度 m
  coordsys?: 'wgs84' | 'gcj02'
  ts?: number
}

// ─── WGS-84 → GCJ-02 纠偏算法（标准高斯-克吕格近似）─────────
// 误差 < 2m，够室外机器人用；若上报本身就是 GCJ-02 则跳过
const A = 6378245.0
const EE = 0.00669342162296594323
const PI = Math.PI

function transformLat(x: number, y: number): number {
  let ret = -100.0 + 2.0 * x + 3.0 * y + 0.2 * y * y + 0.1 * x * y + 0.2 * Math.sqrt(Math.abs(x))
  ret += (20.0 * Math.sin(6.0 * x * PI) + 20.0 * Math.sin(2.0 * x * PI)) * 2.0 / 3.0
  ret += (20.0 * Math.sin(y * PI) + 40.0 * Math.sin(y / 3.0 * PI)) * 2.0 / 3.0
  ret += (160.0 * Math.sin(y / 12.0 * PI) + 320 * Math.sin(y * PI / 30.0)) * 2.0 / 3.0
  return ret
}

function transformLng(x: number, y: number): number {
  let ret = 300.0 + x + 2.0 * y + 0.1 * x * x + 0.1 * x * y + 0.1 * Math.sqrt(Math.abs(x))
  ret += (20.0 * Math.sin(6.0 * x * PI) + 20.0 * Math.sin(2.0 * x * PI)) * 2.0 / 3.0
  ret += (20.0 * Math.sin(x * PI) + 40.0 * Math.sin(x / 3.0 * PI)) * 2.0 / 3.0
  ret += (150.0 * Math.sin(x / 12.0 * PI) + 300.0 * Math.sin(x / 30.0 * PI)) * 2.0 / 3.0
  return ret
}

/** WGS-84 (lng, lat) → GCJ-02 纠偏 */
export function wgs84ToGcj02(lng: number, lat: number): { lng: number; lat: number } {
  // 中国境外（如南海、海外坐标）不纠偏，直接返回
  if (lng < 72.004 || lng > 137.8347 || lat < 0.8293 || lat > 55.8271) {
    return { lng, lat }
  }
  const dLat = transformLat(lat - 35.0, lng - 105.0)
  const dLng = transformLng(lat - 35.0, lng - 105.0)
  const radLat = (lat / 180.0) * PI
  let magic = Math.sin(radLat)
  magic = 1 - EE * magic * magic
  const sqrtMagic = Math.sqrt(magic)
  let newLat = dLat * 180.0
  let newLng = dLng * 180.0
  newLat /= ((A * (1 - EE)) / (magic * sqrtMagic)) * PI
  newLng /= (A / sqrtMagic) * Math.cos(radLat) * PI
  return { lng: lng + newLng, lat: lat + newLat }
}

/** GPS 原始报文 → UnifiedRobotState（室外模式） */
export function adaptGps(raw: GpsRawMsg): UnifiedRobotState {
  const coordsys = raw.coordsys ?? 'wgs84'
  const { lng, lat } = coordsys === 'wgs84'
    ? wgs84ToGcj02(raw.lng, raw.lat)
    : { lng: raw.lng, lat: raw.lat }

  return {
    robotId: raw.deviceId,
    brand: 'unitree',
    model: 'g1',
    batteryPct: 0,            // GPS 模块不带电量，由机器人其他 topic 补充
    voltage: 0,
    online: true,
    // ★ 室外模式: position.x = 经度, .y = 纬度, theta = heading(rad)
    position: {
      x: lng,
      y: lat,
      theta: (raw.heading * PI) / 180,
    },
    status: raw.speed > 0.1 ? 'moving' : 'idle',
    lastSeen: raw.ts ?? Date.now(),
    mode: 'outdoor',
    gps: {
      lng,
      lat,
      alt: raw.alt,
      accuracy: raw.accuracy,
      coordsys: 'gcj02',
      heading: raw.heading,
      speed: raw.speed,
    },
  }
}
