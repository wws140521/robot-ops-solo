import { useState } from 'react'
import { useRobotStore } from '../stores/robotStore'
import { useAlertStore } from '../stores/alertStore'
import { useThemeStore } from '../stores/themeStore'
import { RobotStatusCard, BatteryGauge, AlertItem } from 'ui-kit'
import type { UnifiedRobotState } from 'robot-adapter-kit'
import { Download, Plus, Bot, BatteryCharging, Bell, LayoutGrid, CheckCircle2, X } from 'lucide-react'

export function Dashboard() {
  const { robots, onlineCount, addRobot } = useRobotStore()
  const alerts = useAlertStore((s) => s.alerts)
  const clearAlerts = useAlertStore((s) => s.clearAlerts)
  const robotList = Object.values(robots)
  const totalPower = robotList.reduce((sum, r) => sum + r.batteryPct, 0)
  const avgPower = robotList.length ? Math.round(totalPower / robotList.length) : 0

  const todayAlerts = alerts.filter(
    (a) => new Date(a.timestamp).toDateString() === new Date().toDateString()
  ).length

  const [showAdd, setShowAdd] = useState(false)
  const [newId, setNewId] = useState('')
  const [newBrand, setNewBrand] = useState<'unitree' | 'keenon' | 'agibot' | 'pudutech'>('unitree')

  const handleExport = () => {
    const ts = new Date().toISOString().replace(/[:.]/g, '-')
    const rows = [
      ['Robot ID', 'Brand', 'Model', 'Battery %', 'Status', 'Position X', 'Position Y', 'Online'],
      ...robotList.map((r) => [
        r.robotId, r.brand, r.model,
        String(r.batteryPct), r.status,
        r.position.x.toFixed(2), r.position.y.toFixed(2),
        r.online ? 'yes' : 'no',
      ]),
    ]
    const csv = rows.map((row) => row.join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `robot-ops-report-${ts}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleAdd = () => {
    if (!newId.trim()) return
    const state: UnifiedRobotState = {
      robotId: newId.trim(),
      brand: newBrand,
      model: 'unknown',
      batteryPct: 100,
      voltage: 0,
      online: true,
      position: { x: 0, y: 0, theta: 0 },
      status: 'idle',
      lastSeen: Date.now(),
    }
    addRobot(state)
    setNewId('')
    setShowAdd(false)
  }

  return (
    <div style={{ animation: 'fadeInUp 0.4s var(--ease-out)' }}>
      <div className="page-header">
        <h1 className="page-title">运维总览</h1>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn" onClick={handleExport} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><Download size={14} /> 导出报告</button>
          <button className="btn btn-primary" onClick={() => setShowAdd(true)} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><Plus size={14} /> 添加机器人</button>
        </div>
      </div>

      {showAdd && (
        <div
          className="card hud-corners"
          style={{
            marginBottom: 16,
            padding: 20,
            border: '1px solid var(--border-hover)',
            boxShadow: 'var(--glow-primary)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontFamily: 'var(--font-display)' }}>添加机器人</div>
            <button className="btn" style={{ padding: '2px 8px' }} onClick={() => setShowAdd(false)}>
              <X size={14} />
            </button>
          </div>
          <div style={{ display: 'flex', gap: 12, alignItems: 'end' }}>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: 11, color: 'var(--text-tertiary)', display: 'block', marginBottom: 6, fontFamily: 'var(--font-mono)' }}>
                ROBOT ID
              </label>
              <input
                className="input"
                value={newId}
                onChange={(e) => setNewId(e.target.value)}
                placeholder="如 g1-002"
                style={{ width: '100%' }}
                onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
                autoFocus
              />
            </div>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: 11, color: 'var(--text-tertiary)', display: 'block', marginBottom: 6, fontFamily: 'var(--font-mono)' }}>
                品牌
              </label>
              <select
                value={newBrand}
                onChange={(e) => setNewBrand(e.target.value as any)}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--border-base)',
                  background: 'var(--bg-elev-2)',
                  color: 'var(--text-primary)',
                  fontSize: 13,
                }}
              >
                <option value="unitree">宇树 (unitree)</option>
                <option value="keenon">擎朗 (keenon)</option>
                <option value="agibot">智元 (agibot)</option>
                <option value="pudutech">普渡 (pudutech)</option>
              </select>
            </div>
            <button
              className="btn btn-primary"
              onClick={handleAdd}
              style={{ whiteSpace: 'nowrap' }}
            >
              确认添加
            </button>
          </div>
        </div>
      )}

      <div className="grid grid-4" style={{ marginBottom: 20 }}>
        <KpiCard
          label="在线机器人"
          value={onlineCount}
          total={robotList.length}
          color="var(--status-online)"
          trend="+2"
          trendUp
          icon={<Bot size={20} />}
          sparkData={[3, 4, 4, 5, 5, 6, 6, 5, 6, 6]}
        />
        <KpiCard
          label="平均电量"
          value={`${avgPower}%`}
          color="var(--primary)"
          trend={avgPower > 50 ? '+5%' : '-3%'}
          trendUp={avgPower > 50}
          icon={<BatteryCharging size={20} />}
          gauge={<BatteryGauge pct={avgPower} size={52} />}
        />
        <KpiCard
          label="活跃告警"
          value={alerts.length}
          color="var(--alert-error)"
          trend={alerts.length > 0 ? `${alerts.length} 新增` : '0 新增'}
          trendUp={alerts.length === 0}
          icon={<Bell size={20} />}
          blink={alerts.length > 0}
          sparkData={[1, 2, 1, 3, 2, 3, 3, 2, 3, 3]}
        />
        <KpiCard
          label="今日任务"
          value={todayAlerts}
          color="var(--accent)"
          trend="+12%"
          trendUp
          icon={<LayoutGrid size={20} />}
          sparkData={[12, 15, 14, 18, 16, 20, 19, 22, 21, 24]}
        />
      </div>

      <div className="grid grid-2">
        <div className="card hud-corners">
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: 14,
            }}
          >
            <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
              机器人状态
            </div>
            <span
              style={{
                fontSize: 11,
                color: 'var(--text-tertiary)',
                fontFamily: 'var(--font-mono)',
              }}
            >
              {robotList.length} UNITS
            </span>
          </div>
          {robotList.length === 0 && (
            <div
              style={{
                color: 'var(--text-tertiary)',
                fontSize: 13,
                textAlign: 'center',
                padding: 28,
              }}
            >
              暂无机器人数据<br />请检查 WS 连接或添加机器人
            </div>
          )}
          {robotList.map((r) => (
            <div key={r.robotId} style={{ marginBottom: 8 }}>
              <RobotStatusCard state={r} />
            </div>
          ))}
        </div>

        <div className="card hud-corners">
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: 14,
            }}
          >
            <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
              告警流
            </div>
            <span
              style={{
                fontSize: 11,
                color: 'var(--text-tertiary)',
                fontFamily: 'var(--font-mono)',
              }}
            >
              {alerts.length} ALERTS
            </span>
          </div>
          {alerts.length === 0 ? (
            <div
              style={{
                color: 'var(--text-tertiary)',
                fontSize: 13,
                textAlign: 'center',
                padding: 28,
              }}
            >
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><CheckCircle2 size={16} /> 无告警，一切正常</span>
            </div>
          ) : (
            alerts.slice(0, 8).map((a, i) => (
              <AlertItem key={i} alert={a} onDismiss={clearAlerts} />
            ))
          )}
        </div>
      </div>
    </div>
  )
}

function KpiCard({
  label,
  value,
  total,
  color,
  trend,
  trendUp,
  icon,
  gauge,
  blink,
  sparkData,
}: {
  label: string
  value: number | string
  total?: number
  color: string
  trend: string
  trendUp: boolean
  icon: React.ReactNode
  gauge?: React.ReactNode
  blink?: boolean
  sparkData?: number[]
}) {
  const themeMode = useThemeStore((s) => s.mode)
  const isLight = themeMode === 'light'

  return (
    <div
      className="card hud-corners"
      style={{
        padding: 18,
        position: 'relative',
        animation: blink ? 'pulse-dot 2s ease infinite' : undefined,
      }}
    >
      {/* KPI 卡顶部色条 */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 18,
          right: 18,
          height: 2,
          background: `linear-gradient(90deg, transparent, ${color}, transparent)`,
          borderRadius: '0 0 2px 2px',
        }}
      />
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <span
          style={{
            fontSize: 11,
            color: 'var(--text-tertiary)',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
          }}
        >
          {label}
        </span>
        <span
          style={{
            fontSize: 11,
            fontWeight: 600,
            color: trendUp ? 'var(--status-online)' : 'var(--alert-error)',
            fontFamily: 'var(--font-mono)',
          }}
        >
          {trendUp ? '↑' : '↓'} {trend}
        </span>
      </div>

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginTop: 10,
        }}
      >
        <div>
          <span
            style={{
              fontSize: 28,
              fontWeight: 700,
              color,
              fontFamily: 'var(--font-mono)',
              fontVariantNumeric: 'tabular-nums',
              textShadow: isLight ? 'none' : `0 0 12px ${color}33`,
            }}
          >
            {value}
          </span>
          {total !== undefined && (
            <span
              style={{
                fontSize: 13,
                color: 'var(--text-tertiary)',
                marginLeft: 4,
                fontFamily: 'var(--font-mono)',
              }}
            >
              / {total}
            </span>
          )}
        </div>
        {gauge ? (
          gauge
        ) : (
          <span style={{ color, opacity: 0.7, display: 'flex', alignItems: 'center' }}>{icon}</span>
        )}
      </div>

      {/* 迷你趋势图 sparkline */}
      {sparkData && sparkData.length > 1 && (
        <Sparkline data={sparkData} color={color} />
      )}

      <div
        style={{
          position: 'absolute',
          bottom: 0,
          left: 18,
          right: 18,
          height: 1,
          background: `linear-gradient(90deg, transparent, ${color}44, transparent)`,
        }}
      />
    </div>
  )
}

/* 纯 SVG sparkline，零新增依赖 */
function Sparkline({ data, color }: { data: number[]; color: string }) {
  const w = 64
  const h = 24
  const min = Math.min(...data)
  const max = Math.max(...data)
  const range = max - min || 1
  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1)) * w
    const y = h - ((v - min) / range) * h
    return `${x.toFixed(1)},${y.toFixed(1)}`
  })
  return (
    <svg
      width={w}
      height={h}
      viewBox={`0 0 ${w} ${h}`}
      style={{
        position: 'absolute',
        right: 14,
        bottom: 14,
        opacity: 0.85,
      }}
    >
      <polyline
        points={pts.join(' ')}
        fill="none"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}