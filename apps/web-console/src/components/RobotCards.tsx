/**
 * 多品牌机器人卡片墙
 * 同屏渲染 FANUC / KUKA / 埃斯顿 / 安川 工业机器人
 * 数据来源：useRobotStore（由 wsHub MQTT 接入实时刷新）
 * 适配深色/浅色主题，统一使用 CSS 变量
 */
import { useRobotStore } from '../stores/robotStore'
import type { UnifiedRobotState, JointTelemetry } from 'robot-adapter-kit'

const INDUSTRIAL_BRANDS = new Set(['FANUC', 'KUKA', 'ESTUN', 'YASKAWA'])

// 品牌强调色（在深色主题下提高亮度的近似色，保持品牌识别度）
const BRAND_ACCENT: Record<string, string> = {
  FANUC: '#2B9DFF',
  KUKA: '#FF3B5C',
  ESTUN: '#22D386',
  YASKAWA: '#FF9A1E',
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

// 由关节健康分计算整机健康分
function overallHealth(joints: JointTelemetry[]): number {
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

export function RobotCards() {
  const robots = useRobotStore((s) => s.robots)
  const list = Object.values(robots).filter((r) =>
    INDUSTRIAL_BRANDS.has(r.brand.toUpperCase())
  )

  if (list.length === 0) {
    return (
      <div
        style={{
          padding: 28,
          textAlign: 'center',
          color: 'var(--text-tertiary)',
          fontSize: 13,
        }}
      >
        等待 MQTT 工业数据接入…<br />
        <span style={{ fontSize: 11, opacity: 0.7 }}>
          请确认 mosquitto(9001) 与 fanuc_mock.py / kuka_mock.py 已启动
        </span>
      </div>
    )
  }

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))',
        gap: 14,
      }}
    >
      {list.map((r) => (
        <IndustrialCard key={r.robotId} state={r} />
      ))}
    </div>
  )
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
      {/* 头部：品牌 + 型号 + ID */}
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

      {/* 健康分 + 协议 */}
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

      {/* 关节表格 */}
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

      {/* 活跃告警条 */}
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
