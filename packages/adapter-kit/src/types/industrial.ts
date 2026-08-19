/**
 * 工业机器人专有类型定义
 * 所有字段对应 UDM（Unified Data Model）JSON Schema v1.0
 */

// ─── 单关节遥测 ─────────────────────────────────
export interface JointTelemetry {
  j: number;              // 关节号 1-6
  load_pct: number;       // 转矩负载率 %（0-200）
  temp_c?: number;        // 电机温度 ℃
  current_a?: number;     // 伺服电流 A
  speed_rpm?: number;     // 转速
  health_score?: number;  // 健康分 0-100
  rul_days?: number;      // 剩余使用寿命预测（天）
}

// ─── 告警严重级别 ───────────────────────────────
export type AlarmSeverity = 'info' | 'warn' | 'error' | 'critical';

// ─── 工业告警 ───────────────────────────────────
export interface IndustrialAlarm {
  raw_code: string;       // 原厂报警号，如 "SRVO-023"
  udm_code: string;       // 统一编码，如 "OVER_TEMP_J2"
  severity: AlarmSeverity;
  zh_desc: string;        // 中文描述
  occurred_at: string;    // ISO 8601 时间戳
  cleared: boolean;       // 是否已清除
}

// ─── 运行时统计 ─────────────────────────────────
export interface IndustrialRuntime {
  power_on_hours: number;     // 通电总时长
  operating_hours?: number;   // 实际运行时长
  cycle_count: number;        // 运行周期计数
  last_maintenance_at?: string; // 末次保养时间 ISO 8601
  payload_kg?: number;        // 当前负载重量
}

// ─── 工业扩展（嵌入 UnifiedRobotState） ──────────
export interface IndustrialExtension {
  joints: JointTelemetry[];
  alarms: IndustrialAlarm[];
  runtime: IndustrialRuntime;
  protocol: string;       // "FOCAS" | "OPC_UA" | "MODBUS_TCP" | "ETHERNET_KRL"
  /** 品牌特有扩展数据（R 寄存器/安全门状态等） */
  extensions?: Record<string, string | number | boolean>;
}

// ─── 协议适配配置（YAML 映射源） ────────────────
export interface ProtocolConfig {
  brand: string;
  model: string;
  host: string;
  port: number;
  protocol: string;
  sample_interval_sec: number;
  r_map?: Record<string, number>;
  alarm_dict?: Record<string, {
    udm_code: string;
    severity: AlarmSeverity;
    zh_desc: string;
  }>;
}
