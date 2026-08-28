/**
 * FANUC FOCAS → UnifiedRobotState 适配器
 */
import type { UnifiedRobotState, UnifiedAlert } from '../../types/unified';
import type {
  JointTelemetry,
  IndustrialAlarm,
  IndustrialRuntime,
  IndustrialExtension,
} from '../../types/industrial';

export function adaptFanuc(
  raw: any
): { state: UnifiedRobotState; alerts: UnifiedAlert[] } {
  const joints: JointTelemetry[] = (raw.joints || []).map((j: any) => ({
    j: j.j,
    angle_rad: j.angle_rad,
    load_pct: typeof j.load_pct === 'number' ? j.load_pct : 0,
    temp_c: j.temp_c,
    current_a: j.current_a,
    speed_rpm: j.speed_rpm,
    health_score: j.health_score ?? 100,
    rul_days: j.rul_days,
  }));

  const alarms: IndustrialAlarm[] = (raw.alarms || []).map((a: any) => ({
    raw_code: a.raw_code || 'UNKNOWN',
    udm_code: a.udm_code || 'UNKNOWN',
    severity: a.severity || 'warn',
    zh_desc: a.zh_desc || '',
    occurred_at: a.occurred_at || new Date().toISOString(),
    cleared: a.cleared ?? false,
  }));

  const runtime: IndustrialRuntime = {
    power_on_hours: raw.runtime?.power_on_hours ?? 0,
    operating_hours: raw.runtime?.operating_hours,
    cycle_count: raw.runtime?.cycle_count ?? 0,
    last_maintenance_at: raw.runtime?.last_maintenance_at,
    payload_kg: raw.runtime?.payload_kg,
  };

  const industrial: IndustrialExtension = {
    joints,
    alarms,
    runtime,
    protocol: 'FOCAS',
    extensions: raw.extensions,
  };

  const state: UnifiedRobotState = {
    robotId: raw.robot_id || `fanuc-${Date.now()}`,
    brand: 'FANUC',
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
