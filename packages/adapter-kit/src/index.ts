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
