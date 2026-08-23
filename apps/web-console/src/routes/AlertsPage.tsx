import { useAlertStore } from '../stores/alertStore'
import { useSpeakStore } from '../stores/speakStore'
import { useState, useMemo } from 'react'
import { AlertOctagon, AlertTriangle, Info, CheckCheck, Trash2, RadioTower } from 'lucide-react'
import { GlassCard, TaskTimeline, type TimelineItem, StatusDot } from 'ui-kit'
import './AlertsPage.css'

type FilterLevel = 'all' | 'error' | 'warn' | 'info'

// 工业告警识别：消息格式为 "[raw_code] zh_desc"（如 "[SRVO-023] 2轴伺服过热"）
function parseIndustrialAlert(message: string): { rawCode: string; zhDesc: string } | null {
  const match = message.match(/^\[([^\]]+)\]\s*(.+)$/)
  if (!match) return null
  const rawCode = match[1]
  // 工业品牌报警码前缀：FANUC(SRVO-) / KUKA(KSS) / 埃斯顿(EST-) / 安川(纯数字)
  const isIndustrial = /^(SRVO-|KSS|EST-|\d{3,})/.test(rawCode)
  if (!isIndustrial) return null
  return { rawCode, zhDesc: match[2] }
}

export function AlertsPage() {
  const alerts = useAlertStore((s) => s.alerts)
  const unreadCount = useAlertStore((s) => s.unreadCount)
  const markAllRead = useAlertStore((s) => s.markAllRead)
  const clearAlerts = useAlertStore((s) => s.clearAlerts)
  const speakHistory = useSpeakStore((s) => s.history)

  const [filter, setFilter] = useState<FilterLevel>('all')
  const [search, setSearch] = useState('')
  const [readIds, setReadIds] = useState<Set<number>>(new Set())

  const handleMarkAllRead = () => {
    markAllRead()
    setReadIds(new Set(alerts.map((a) => a.timestamp)))
  }

  const filteredAlerts = useMemo(() => {
    let list = alerts
    if (filter !== 'all') list = list.filter((a) => a.level === filter)
    if (search.trim()) {
      const q = search.trim().toLowerCase()
      list = list.filter((a) =>
        a.message.toLowerCase().includes(q) ||
        a.robotId.toLowerCase().includes(q) ||
        a.code.toLowerCase().includes(q)
      )
    }
    return list
  }, [alerts, filter, search])

  const counts = useMemo(() => ({
    error: alerts.filter((a) => a.level === 'error').length,
    warn: alerts.filter((a) => a.level === 'warn').length,
    info: alerts.filter((a) => a.level === 'info').length,
  }), [alerts])

  // 生成时间轴数据
  const timelineItems: TimelineItem[] = filteredAlerts.map((a) => {
    const industrial = parseIndustrialAlert(a.message)
    return {
      time: new Date(a.timestamp).toLocaleTimeString(),
      title: `${a.robotId} · ${industrial ? industrial.zhDesc : a.message}`,
      status: a.level === 'error' ? 'error' : a.level === 'warn' ? 'warn' : 'doing',
      desc: industrial
        ? `[${industrial.rawCode}] ${a.code}`
        : `[${a.code}] ${a.robotId}`,
      icon: a.level === 'error' ? <AlertOctagon size={14} /> : a.level === 'warn' ? <AlertTriangle size={14} /> : <Info size={14} />,
    }
  })

  return (
    <div className="alerts-page">
      <div className="alerts-header">
        <div className="alerts-title-area">
          <h1 className="page-title">
            告警中心
            {unreadCount > 0 && (
              <span className="alerts-unread-badge">{unreadCount}</span>
            )}
          </h1>
        </div>
        <div className="alerts-header-actions">
          <input
            type="text"
            placeholder="搜索告警..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="alerts-search"
          />
          <button className="btn" onClick={handleMarkAllRead} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><CheckCheck size={14} /> 全部已读</button>
          <button className="btn btn-danger" onClick={() => clearAlerts()} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><Trash2 size={14} /> 清空告警</button>
        </div>
      </div>

      <div className="alerts-stats">
        {(['error', 'warn', 'info'] as const).map((level) => (
          <button
            key={level}
            className={`alerts-stat-card alerts-stat-${level} ${filter === level ? 'active' : ''}`}
            onClick={() => setFilter(filter === level ? 'all' : level)}
          >
            <div className="alerts-stat-icon">
              {level === 'error' && <AlertOctagon size={16} />}
              {level === 'warn' && <AlertTriangle size={16} />}
              {level === 'info' && <Info size={16} />}
            </div>
            <div className="alerts-stat-info">
              <div className="alerts-stat-label">
                {level === 'error' ? '错误' : level === 'warn' ? '警告' : '信息'}
              </div>
              <div className="alerts-stat-count">{counts[level]}</div>
            </div>
          </button>
        ))}
      </div>

      {/* 告警时间轴 —— Neon Glass TaskTimeline 风格 */}
      <GlassCard style={{ padding: 20 }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 16,
          }}
        >
          <div style={{ fontWeight: 600, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{
              width: 4,
              height: 14,
              background: 'linear-gradient(180deg, var(--neon), var(--accent))',
              borderRadius: 2,
              boxShadow: 'var(--neon-glow)',
            }} />
            告警列表
          </div>
          <span
            style={{
              fontSize: 11,
              color: 'var(--text-muted)',
              fontFamily: 'var(--font-mono)',
            }}
          >
            {filteredAlerts.length} RECORDS
          </span>
        </div>

        {timelineItems.length === 0 ? (
          <div className="alerts-empty">
            <div className="alerts-empty-icon"><RadioTower size={16} /></div>
            <div className="alerts-empty-text">
              {alerts.length === 0 ? '暂无告警' : '没有符合条件的告警'}
            </div>
          </div>
        ) : (
          <div style={{ maxHeight: 'calc(100vh - 420px)', overflowY: 'auto', paddingRight: 8 }}>
            {filteredAlerts.map((alert) => {
              const isRead = readIds.has(alert.timestamp)
              const industrial = parseIndustrialAlert(alert.message)
              return (
                <div
                  key={`${alert.timestamp}-${alert.robotId}`}
                  className={`alerts-card alerts-card-${alert.level} ${!isRead ? 'alerts-card-unread' : ''}`}
                  onClick={() => {
                    if (!isRead) {
                      setReadIds((prev) => new Set(prev).add(alert.timestamp))
                    }
                  }}
                >
                  <div className="alerts-card-level-bar" />
                  <div className="alerts-card-body">
                    <div className="alerts-card-header">
                      <div className="alerts-card-meta">
                        <StatusDot
                          status={alert.level === 'error' ? 'error' : alert.level === 'warn' ? 'warn' : 'online'}
                        />
                        <span className="alerts-card-robot">{alert.robotId}</span>
                        <span className="alerts-card-code">[{alert.code}]</span>
                      </div>
                      <div className="alerts-card-time">
                        {new Date(alert.timestamp).toLocaleTimeString()}
                      </div>
                    </div>
                    {industrial ? (
                      <div className="alerts-card-message">
                        <span
                          className="alerts-card-raw-code"
                          style={{
                            display: 'inline-block',
                            fontFamily: 'var(--font-mono)',
                            fontSize: 11,
                            fontWeight: 700,
                            color: alert.level === 'error' ? 'var(--status-error)' : alert.level === 'warn' ? 'var(--alert-warn)' : 'var(--alert-info)',
                            padding: '1px 6px',
                            borderRadius: 'var(--radius-sm)',
                            border: `1px solid ${alert.level === 'error' ? 'var(--status-error)' : alert.level === 'warn' ? 'var(--alert-warn)' : 'var(--alert-info)'}`,
                            marginRight: 6,
                          }}
                        >
                          {industrial.rawCode}
                        </span>
                        <span className="alerts-card-zh-desc">{industrial.zhDesc}</span>
                      </div>
                    ) : (
                      <div className="alerts-card-message">{alert.message}</div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </GlassCard>

      {speakHistory.length > 0 && (
        <GlassCard style={{ padding: 18 }}>
          <div className="alerts-speak-header">
            <span style={{
              width: 4,
              height: 14,
              background: 'linear-gradient(180deg, var(--accent), var(--neon))',
              borderRadius: 2,
              boxShadow: 'var(--glow-primary)',
            }} />
            <span className="alerts-speak-title">🔊 播报历史</span>
            <span className="alerts-speak-count">({speakHistory.length})</span>
          </div>
          <div className="alerts-speak-list">
            {speakHistory
              .slice()
              .reverse()
              .map((s, i) => (
                <div
                  key={`${s.timestamp}-${i}`}
                  className="alerts-speak-item"
                >
                  <span className="alerts-speak-icon">🔊</span>
                  <span className="alerts-speak-text">{s.text}</span>
                  <span className="alerts-speak-time">
                    {new Date(s.timestamp).toLocaleTimeString()}
                  </span>
                </div>
              ))}
          </div>
        </GlassCard>
      )}
    </div>
  )
}
