// robot-adapter-kit 公共入口
export type { UnifiedRobotState, UnifiedAlert, UnifiedCommand } from './types/unified'
export type {
  JointTelemetry,
  AlarmSeverity,
  IndustrialAlarm,
  IndustrialRuntime,
  IndustrialExtension,
  ProtocolConfig,
} from './types/industrial'
export {
  adaptIncoming,
  adaptIncomingAlert,
  adaptByBrandEnhanced,
  adaptCommercial,
  adaptIndustrial,
  getRegisteredIndustrialBrands,
  registry,
  SUPPORTED_BRANDS,
  INDUSTRIAL_BRAND_LIST,
} from './adapters'
export { RobotWSClient } from './protocol/ws-client'
export { connectMqtt, disconnectMqtt } from './protocol/mqtt-client'
// 2026-08-29 室外模式 GPS 适配器
export { adaptGps, wgs84ToGcj02 } from './adapters/adapter-gps'
export type { GpsRawMsg } from './adapters/adapter-gps'
export { lowPass, lowPassAngle } from './utils/smooth'
