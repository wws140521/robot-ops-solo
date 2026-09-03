/**
 * 异构设备卡片墙
 * 同屏渲染地面机器人 / 无人机机巢 / eVTOL 起降场
 * 数据来源：useRobotStore（由 wsHub MQTT 接入实时刷新）
 */
import { useState, useMemo } from 'react'
import { useRobotStore } from '../stores/robotStore'
import type { UnifiedRobotState, DeviceClass } from 'robot-adapter-kit'
import { DockCard } from './DockCard'
import { VertiportCard } from './VertiportCard'

const INDUSTRIAL_BRANDS = new Set(['FANUC', 'KUKA', 'ESTUN', 'YASKAWA'])
const COMMERCIAL_BRANDS = new Set(['UNITREE', 'KEENON', 'AGIBOT', 'PUDUTECH'])

const TABS: { key: DeviceClass | 'all'; label: string }[] = [
  { key: 'all', label: '全部' },
  { key: 'ground_robot', label: '地面机器人' },
  { key: 'uav_dock', label: '无人机机巢' },
  { key: 'vertiport', label: '起降场' },
  { key: 'gateway', label: '边缘网关' },
]

function deviceClassOf(state: UnifiedRobotState): DeviceClass {
  if (state.deviceClass) return state.deviceClass
  if (INDUSTRIAL_BRANDS.has(state.brand.toUpperCase())) return 'ground_robot'
  if (COMMERCIAL_BRANDS.has(state.brand.toUpperCase())) return 'ground_robot'
  return 'ground_robot'
}

function DeviceCard({ device }: { device: UnifiedRobotState }) {
  const cls = deviceClassOf(device)
  switch (cls) {
    case 'uav_dock':
      return <DockCard device={device} />
    case 'vertiport':
      return <VertiportCard device={device} />
    case 'ground_robot':
    default:
      return <IndustrialCard state={device} />
  }
}

export function RobotCards() {
  const robots = useRobotStore((s) => s.robots)
  const [tab, setTab] = useState<DeviceClass | 'all'>('all')

  const list = useMemo(() => {
    return Object.values(robots).filter((r) => {
      return tab === 'all' || deviceClassOf(r) === tab
    })
  }, [robots, tab])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* 设备类 Tab 过滤 */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            style={{
              padding: '6px 14px',
              fontSize: 12,
              borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--border-base)',
              background: tab === t.key ? 'var(--primary-dim)' : 'transparent',
              color: tab === t.key ? 'var(--primary)' : 'var(--text-secondary)',
              fontFamily: 'var(--font-mono)',
              transition: 'all 0.2s',
              cursor: 'pointer',
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {list.length === 0 && (
        <div
          style={{
            padding: 28,
            textAlign: 'center',
            color: 'var(--text-tertiary)',
            fontSize: 13,
          }}
        >
          等待设备数据接入…<br />
          <span style={{ fontSize: 11, opacity: 0.7 }}>
            请确认 MQTT 与对应采集器已启动
          </span>
        </div>
      )}

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))',
          gap: 14,
        }}
      >
        {list.map((r) => (
          <DeviceCard key={r.robotId} device={r} />
        ))}
      </div>
    </div>
  )
}

// ─── 原有工业/地面机器人卡片（保留，作为 ground_robot 默认渲染） ─────────

const BRAND_ACCENT: Record<string, string> = {
  FANUC: '#2B9DFF',
  KUKA: '#FF3B5C',
  ESTUN: '#22D386',
  YASKAWA: '#FF9A1E',
  UNITREE: '#F5A623',
  KEENON: '#00C2A8',
  AGIBOT: '#9B59B6',
  PUDUTECH: '#E74C3C',
}

function brandAccent(brand: string): string {
  return BRAND_ACCENT[brand.toUpperCase()] ?? 'var(--primary)'
}

function healthColor(score: number): string {
  if (score >= 80) return 'var(--status-online)'
  if (score >= 60) return 'var(--alert-warn)'
  return 'var(--status-error)'
}

function loadColor(loadPct: number): string {
  if (loadPct > 100) return 'var(--status-error)'
  if (loadPct > 80) return 'var(--alert-warn)'
  return 'var(--status-online)'
}

function overallHealth(joints: any[]): number {
  if (joints.length === 0) return 0
  return Math.round(
    joints.reduce((s, j) => s + (j.health_score ?? 100), 0) / joints.length
  )
}

const th: React.CSSProperties = {
  padding: '5px 6px',
  textAlign: 'left',
  fontSize: 10,
  color: 'var(--text-tertiary)',
  fontFamily: 'var(--font-mono)',
  textTransform: 'uppercase',
  letterSpacing: '0.04em',
  borderBottom: '1px solid var(--border-subtle)',
}

const td: React.CSSProperties = {
  padding: '4px 6px',
  fontSize: 11,
  fontFamily: 'var(--font-mono)',
  color: 'var(--text-primary)',
  borderBottom: '1px solid var(--border-subtle)',
}

function IndustrialCard({ state }: { state: UnifiedRobotState }) {
  const ind = state.industrial
  const accent = brandAccent(state.brand)
  const joints = ind?.joints ?? []
  const score = overallHealth(joints)
  const alarms = ind?.alarms ?? []
  const activeAlarms = alarms.filter((a) => !a.cleared)
  const runtime = ind?.runtime

  return (
    <div
      className="card hud-corners"
      style={{
        padding: 14,
        borderTop: `2px solid ${accent}`,
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 8,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
          <span
            style={{
              background: accent,
              color: '#fff',
              padding: '2px 8px',
              borderRadius: 4,
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: '0.04em',
              flexShrink: 0,
            }}
          >
            {state.brand}
          </span>
          <span style={{ fontSize: 13, color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {state.model}
          </span>
        </div>
        <span
          style={{
            fontSize: 10,
            fontFamily: 'var(--font-mono)',
            color: 'var(--text-tertiary)',
            flexShrink: 0,
          }}
          title={state.robotId}
        >
          {state.robotId}
        </span>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div
          style={{
            width: 54,
            height: 54,
            borderRadius: '50%',
            border: `2px solid ${healthColor(score)}`,
            color: healthColor(score),
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 18,
            fontWeight: 700,
            fontFamily: 'var(--font-mono)',
            flexShrink: 0,
            boxShadow: `0 0 10px ${healthColor(score)}33`,
          }}
        >
          {score}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>健康分</span>
          <span style={{ fontSize: 11, color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)' }}>
            {ind?.protocol ?? state.brand} · {state.online ? '在线' : '离线'}
          </span>
          {runtime && (
            <span style={{ fontSize: 11, color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)' }}>
              {runtime.power_on_hours.toLocaleString()}h · {runtime.cycle_count.toLocaleString()} cyc
            </span>
          )}
        </div>
      </div>

      {joints.length > 0 && (
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={th}>轴</th>
              <th style={th}>负载%</th>
              <th style={th}>温度℃</th>
              <th style={th}>电流A</th>
              <th style={th}>健康</th>
            </tr>
          </thead>
          <tbody>
            {joints.map((j) => (
              <tr key={j.j}>
                <td style={td}>J{j.j}</td>
                <td style={{ ...td, color: loadColor(j.load_pct) }}>
                  {(j.load_pct ?? 0).toFixed(1)}
                </td>
                <td style={{ ...td, color: (j.temp_c ?? 0) > 50 ? 'var(--status-error)' : 'var(--text-primary)' }}>
                  {(j.temp_c ?? 0).toFixed(1)}
                </td>
                <td style={td}>{(j.current_a ?? 0).toFixed(1)}</td>
                <td style={{ ...td, color: healthColor(j.health_score ?? 100) }}>
                  {j.health_score ?? 100}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {activeAlarms.length > 0 && (
        <div
          style={{
            padding: '6px 8px',
            borderRadius: 'var(--radius-sm)',
            background: 'var(--bg-elev-2)',
            borderLeft: `3px solid var(--alert-error)`,
            fontSize: 11,
            color: 'var(--text-secondary)',
            display: 'flex',
            flexDirection: 'column',
            gap: 2,
          }}
        >
          {activeAlarms.slice(0, 3).map((a, i) => (
            <span key={i}>
              <span style={{ color: 'var(--alert-error)', fontFamily: 'var(--font-mono)' }}>{a.raw_code}</span>
              {' '}
              {a.zh_desc}
            </span>
          ))}
          {activeAlarms.length > 3 && (
            <span style={{ color: 'var(--text-tertiary)' }}>+{activeAlarms.length - 3} 条告警</span>
          )}
        </div>
      )}
    </div>
  )
}
