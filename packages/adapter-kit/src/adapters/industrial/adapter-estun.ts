/**
 * 埃斯顿 Modbus-TCP → UnifiedRobotState 适配器
 */
import type { UnifiedRobotState, UnifiedAlert } from '../../types/unified';
import type {
  JointTelemetry,
  IndustrialAlarm,
  IndustrialRuntime,
  IndustrialExtension,
} from '../../types/industrial';
import type { AlarmSeverity } from '../../types/industrial';

const ESTUN_ALARM_MAP: Record<string, { udm_code: string; severity: AlarmSeverity; zh_desc: string }> = {
  'EST-3001': { udm_code: 'OVER_LOAD', severity: 'warn', zh_desc: '关节过载' },
  'EST-3002': { udm_code: 'ENCODER_ERR', severity: 'error', zh_desc: '编码器错误' },
  'EST-3003': { udm_code: 'OVER_TEMP', severity: 'warn', zh_desc: '驱动器过热' },
  'EST-3004': { udm_code: 'COMM_ERR', severity: 'error', zh_desc: '通信异常' },
};

export function adaptEstun(
  raw: any
): { state: UnifiedRobotState; alerts: UnifiedAlert[] } {
  const joints: JointTelemetry[] = (raw.joints || []).map((j: any) => ({
    j: j.j,
    angle_rad: j.angle_rad,
    load_pct: j.load_pct ?? 0,
    temp_c: j.temp_c,
    current_a: j.current_a,
    speed_rpm: j.speed_rpm,
    health_score: j.health_score ?? 100,
    rul_days: j.rul_days,
  }));

  const alarms: IndustrialAlarm[] = (raw.alarms || []).map((a: any) => {
    const mapped = ESTUN_ALARM_MAP[a.raw_code] || {
      udm_code: 'UNKNOWN',
      severity: 'warn' as AlarmSeverity,
      zh_desc: a.zh_desc || '未知告警',
    };
    return {
      raw_code: a.raw_code,
      udm_code: mapped.udm_code,
      severity: mapped.severity,
      zh_desc: mapped.zh_desc,
      occurred_at: a.occurred_at || new Date().toISOString(),
      cleared: a.cleared ?? false,
    };
  });

  const runtime: IndustrialRuntime = {
    power_on_hours: raw.runtime?.power_on_hours ?? 0,
    cycle_count: raw.runtime?.cycle_count ?? 0,
    last_maintenance_at: raw.runtime?.last_maintenance_at,
  };

  const industrial: IndustrialExtension = {
    joints,
    alarms,
    runtime,
    protocol: 'MODBUS_TCP',
    extensions: raw.extensions,
  };

  const state: UnifiedRobotState = {
    robotId: raw.robot_id || `estun-${Date.now()}`,
    brand: 'ESTUN',
    model: raw.model || 'Unknown',
    batteryPct: 0,
    voltage: 0,
    online: true,
    position: raw.pose
      ? { x: raw.pose.x, y: raw.pose.y, theta: (raw.pose.rz ?? 0) * Math.PI / 180 }
      : { x: 0, y: 0, theta: 0 },
    status: 'working',
    lastSeen: Date.now(),
    industrial,
  };

  const unifiedAlerts: UnifiedAlert[] = alarms.map((a) => ({
    robotId: state.robotId,
    level: a.severity === 'critical' ? 'error' : (a.severity as 'info' | 'warn' | 'error'),
    code: a.raw_code,
    message: `[${a.raw_code}] ${a.zh_desc}`,
    timestamp: Date.now(),
  }));

  return { state, alerts: unifiedAlerts };
}
