/**
 * 品牌特有数据扩展面板
 * 显示工业机器人品牌专有字段（R 寄存器、安全门状态等）
 */

import { getBrandConfig } from '../lib/brandRegistry'

interface Props {
  extensions?: Record<string, string | number | boolean>
  brand: string
}

// 不同品牌的扩展字段中文名映射
const FIELD_LABELS: Record<string, Record<string, string>> = {
  fanuc: {
    r_register_200: 'R 寄存器 #200',
    d_parameter_101: 'D 参数 #101',
    tool_life_remaining: '刀具剩余寿命',
    macro_status: '宏指令状态',
    servo_alarm_history: '伺服告警历史',
  },
  kuka: {
    safety_gate_open: '安全门状态',
    robroot_offset_x: '基坐标偏移 X',
    robroot_offset_y: '基坐标偏移 Y',
    safety_controller_state: '安全控制器',
    axis_soft_limit: '轴软限位',
  },
  estun: {
    energy_consumption: '能耗监测',
    plc_extension: 'PLC 扩展区',
    custom_alarm_word: '自定义告警字',
  },
  yaskawa: {
    servo_torque_limit: '伺服扭矩上限',
    conveyor_sync_status: '输送带同步',
  },
}

export function ExtensionPanel({ extensions, brand }: Props) {
  const brandKey = brand.toLowerCase()
  const labels = FIELD_LABELS[brandKey] || {}
  const brandCfg = getBrandConfig(brand)

  if (!extensions || Object.keys(extensions).length === 0) {
    return (
      <div style={{ fontSize: 12, color: 'var(--text-tertiary)', textAlign: 'center', padding: '12px 0' }}>
        暂无 {brandCfg.name} 特有数据
      </div>
    )
  }

  return (
    <div
      style={{
        background: 'var(--bg-elev-2)',
        borderRadius: 'var(--radius-sm)',
        padding: 12,
      }}
    >
      <div
        style={{
          fontSize: 12,
          fontWeight: 600,
          color: brandCfg.color,
          marginBottom: 8,
          display: 'flex',
          alignItems: 'center',
          gap: 4,
        }}
      >
        {brandCfg.icon} {brandCfg.name} 特有数据
      </div>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: 6,
        }}
      >
        {Object.entries(extensions).map(([key, value]) => (
          <div
            key={key}
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '4px 8px',
              background: 'var(--bg-elev-1)',
              borderRadius: 'var(--radius-sm)',
              fontSize: 11,
            }}
          >
            <span style={{ color: 'var(--text-tertiary)' }}>{labels[key] || key}</span>
            <span
              style={{
                fontWeight: 600,
                color: typeof value === 'boolean'
                  ? value ? 'var(--status-error)' : 'var(--status-online)'
                  : 'var(--text-primary)',
                fontFamily: 'var(--font-mono)',
              }}
            >
              {typeof value === 'boolean'
                ? value ? '⛔ 开' : '✅ 关'
                : String(value)}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
