import { useState, useMemo, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useRobotStore } from '../stores/robotStore'
import { useAlertStore } from '../stores/alertStore'
import { sendCommand } from '../lib/wsHub'
import { AlertItem } from 'ui-kit'
import { RobotViewer, FanucArm, KukaArm } from 'digital-twin'
import { AIInsightPanel } from '../components/overlays/AIInsightPanel'
import { HealthGauge } from '../components/HealthGauge'
import { ExtensionPanel } from '../components/ExtensionPanel'
import { TrendChart } from '../components/TrendChart'
import { isIndustrialArm } from '../lib/robotType'
import { getBrandConfig } from '../lib/brandRegistry'
import { Canvas } from '@react-three/fiber'

// 工业品牌集合
const INDUSTRIAL_BRANDS = new Set(['FANUC', 'KUKA', 'ESTUN', 'YASKAWA'])

// 允许下发的指令白名单（P6 安全加固：拒绝任意透传）
const COMMAND_MAP: Record<string, { topic: string; label: string; destructive: boolean }> = {
  start:  { topic: '/cmd/start',  label: '启动', destructive: false },
  stop:   { topic: '/cmd/stop',   label: '停止', destructive: true  },
  dock:   { topic: '/cmd/dock',   label: '回充', destructive: true  },
  reboot: { topic: '/cmd/reboot', label: '重启', destructive: true  },
}

const STATUS_COLORS: Record<string, string> = {
  idle: 'var(--status-online)',
  moving: 'var(--status-moving)',
  working: 'var(--status-working)',
  error: 'var(--status-error)',
  charging: 'var(--status-charging)',
}

const STATUS_LABELS: Record<string, string> = {
  idle: '空闲',
  moving: '移动中',
  working: '工作中',
  error: '故障',
  charging: '充电中',
}

export function RobotsPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { robots } = useRobotStore()
  const alerts = useAlertStore((s) => s.alerts)
  const clearAlerts = useAlertStore((s) => s.clearAlerts)
  const addAlert = useAlertStore((s) => s.addAlert)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [commandPending, setCommandPending] = useState<string | null>(null)
  const [confirmCmd, setConfirmCmd] = useState<string | null>(null)
  const [toast, setToast] = useState<{ msg: string; type: 'ok' | 'err' } | null>(null)

  const robotList = Object.values(robots)
  const selected = id ? robots[id] : robotList[0]

  const showToast = useCallback((msg: string, type: 'ok' | 'err') => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3000)
  }, [])

  const handleCommand = useCallback(
    (cmdKey: string) => {
      const cmd = COMMAND_MAP[cmdKey]
      if (!cmd || !selected) return

      // 破坏性操作需二次确认
      if (cmd.destructive && confirmCmd !== cmdKey) {
        setConfirmCmd(cmdKey)
        setTimeout(() => setConfirmCmd(null), 4000)
        return
      }

      setConfirmCmd(null)
      setCommandPending(cmdKey)
      try {
        const ok = sendCommand(selected.robotId, cmd.topic, {
          issuedAt: Date.now(),
        })
        if (ok) {
          showToast(`指令已下发：${cmd.label}`, 'ok')
          addAlert({
            robotId: selected.robotId,
            level: 'info',
            code: `CMD_${cmdKey.toUpperCase()}`,
            message: `下发指令：${cmd.label}`,
            timestamp: Date.now(),
          })
        } else {
          showToast(`指令下发失败：未找到机器人连接`, 'err')
        }
      } catch {
        showToast('指令下发失败，请检查连接', 'err')
      } finally {
        setTimeout(() => setCommandPending(null), 1000)
      }
    },
    [selected, confirmCmd, addAlert, showToast]
  )

  const filteredList = useMemo(() => {
    return robotList.filter((r) => {
      const matchSearch =
        search === '' ||
        r.robotId.toLowerCase().includes(search.toLowerCase()) ||
        r.model.toLowerCase().includes(search.toLowerCase())
      const matchStatus = statusFilter === 'all' || r.status === statusFilter
      return matchSearch && matchStatus
    })
  }, [robotList, search, statusFilter])

  const robotAlerts = selected
    ? alerts.filter((a) => a.robotId === selected.robotId)
    : []

  return (
    <div style={{ animation: 'fadeInUp 0.4s var(--ease-out)' }}>
      <div className="page-header">
        <h1 className="page-title">机器人管理</h1>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '280px 1fr 320px',
          gap: 16,
          height: 'calc(100vh - 120px)',
        }}
      >
        {/* 左：机器人列表 + 筛选 */}
        <div
          className="card hud-corners"
          style={{
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            padding: 14,
          }}
        >
          <div style={{ marginBottom: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
            <input
              type="text"
              placeholder="搜索 ID / 型号..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ width: '100%' }}
            />
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
              {['all', 'idle', 'moving', 'working', 'error', 'charging'].map((s) => (
                <button
                  key={s}
                  onClick={() => setStatusFilter(s)}
                  style={{
                    padding: '3px 10px',
                    fontSize: 11,
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--border-base)',
                    background:
                      statusFilter === s ? 'var(--primary-dim)' : 'transparent',
                    color:
                      statusFilter === s
                        ? 'var(--primary)'
                        : 'var(--text-tertiary)',
                    fontFamily: 'var(--font-mono)',
                    transition: 'all 0.2s',
                    cursor: 'pointer',
                  }}
                >
                  {s === 'all' ? '全部' : STATUS_LABELS[s] ?? s}
                </button>
              ))}
            </div>
          </div>

          <div
            style={{
              flex: 1,
              overflowY: 'auto',
              display: 'flex',
              flexDirection: 'column',
              gap: 6,
            }}
          >
            {filteredList.length === 0 && (
              <div
                style={{
                  color: 'var(--text-tertiary)',
                  fontSize: 12,
                  textAlign: 'center',
                  padding: 20,
                }}
              >
                无匹配机器人
              </div>
            )}
            {filteredList.map((r) => {
              const isSelected = selected?.robotId === r.robotId
              const color = STATUS_COLORS[r.status] ?? 'var(--text-tertiary)'
              return (
                <div
                  key={r.robotId}
                  onClick={() => navigate(`/robots/${r.robotId}`)}
                  style={{
                    cursor: 'pointer',
                    padding: '10px 12px',
                    borderRadius: 'var(--radius-sm)',
                    background: isSelected
                      ? 'var(--primary-dim)'
                      : 'var(--bg-elev-2)',
                    border: `1px solid ${
                      isSelected ? 'var(--primary)' : 'var(--border-base)'
                    }`,
                    borderLeft: `3px solid ${color}`,
                    transition: 'all 0.2s',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                  }}
                >
                  <span
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: '50%',
                      background: color,
                      boxShadow: `0 0 6px ${color}`,
                      animation: 'pulse-dot 2s ease infinite',
                      flexShrink: 0,
                    }}
                  />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        fontSize: 13,
                        fontWeight: 600,
                        color: 'var(--text-primary)',
                        fontFamily: 'var(--font-mono)',
                      }}
                    >
                      {r.robotId}
                    </div>
                    <div
                      style={{
                        fontSize: 11,
                        color: 'var(--text-tertiary)',
                      }}
                    >
                      {r.brand} · {r.model}
                    </div>
                  </div>
                  <span
                    style={{
                      fontSize: 10,
                      fontFamily: 'var(--font-mono)',
                      color: isIndustrialArm(r.brand)
                        ? 'var(--alert-warn)'
                        : r.batteryPct < 20
                        ? 'var(--status-error)'
                        : 'var(--text-tertiary)',
                    }}
                  >
                    {isIndustrialArm(r.brand)
                      ? `${r.industrial?.joints?.[0]?.load_pct ?? 0}% 负载`
                      : `${r.batteryPct}%`}
                  </span>
                </div>
              )
            })}
          </div>
        </div>

        {/* 中：3D 视图（全屏沉浸） */}
        <div
          className="card hud-corners"
          style={{ padding: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}
        >
          <div
            style={{
              padding: '14px 18px',
              borderBottom: '1px solid var(--border-subtle)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
              3D 实时视图{selected && ` · ${selected.robotId}`}
            </div>
            <span
              style={{
                fontSize: 11,
                fontFamily: 'var(--font-mono)',
                color: 'var(--text-tertiary)',
              }}
            >
              {selected?.status?.toUpperCase() ?? 'NO SIGNAL'}
            </span>
          </div>
          <div style={{ flex: 1, background: 'var(--bg-base)' }}>
            {selected ? (
              INDUSTRIAL_BRANDS.has(selected.brand) ? (
                <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Canvas camera={{ position: [3, 2.5, 3.5], fov: 42 }}>
                    <ambientLight intensity={0.6} />
                    <directionalLight position={[5, 8, 5]} intensity={1.2} />
                    <pointLight position={[-3, 2, -2]} intensity={0.4} color="#4a9eff" />
                    {selected.brand === 'FANUC' && (
                      <FanucArm joints={selected.industrial?.joints || []} scale={2} />
                    )}
                    {(selected.brand === 'KUKA' || selected.brand === 'ESTUN') && (
                      <KukaArm joints={selected.industrial?.joints || []} scale={2} />
                    )}
                    {selected.brand === 'YASKAWA' && (
                      <FanucArm joints={selected.industrial?.joints || []} scale={2} />
                    )}
                  </Canvas>
                </div>
              ) : (
                <RobotViewer robotId={selected.robotId} state={selected} />
              )
            ) : (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  height: '100%',
                  color: 'var(--text-tertiary)',
                }}
              >
                请选择一台机器人
              </div>
            )}
          </div>
        </div>

        {/* 右：详情面板（HUD 风格） */}
        <div
          className="card hud-corners"
          style={{
            display: 'flex',
            flexDirection: 'column',
            overflow: 'auto',
            padding: 18,
          }}
        >
          {selected ? (
            <>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  marginBottom: 16,
                  paddingBottom: 12,
                  borderBottom: '1px solid var(--border-subtle)',
                }}
              >
                <span
                  style={{
                    width: 10,
                    height: 10,
                    borderRadius: '50%',
                    background: STATUS_COLORS[selected.status] ?? 'var(--text-tertiary)',
                    boxShadow: `0 0 8px ${
                      STATUS_COLORS[selected.status] ?? 'var(--text-tertiary)'
                    }`,
                    animation: 'pulse-dot 1.5s ease infinite',
                    flexShrink: 0,
                  }}
                />
                <div>
                  <div
                    style={{
                      fontSize: 15,
                      fontWeight: 700,
                      color: 'var(--text-primary)',
                      fontFamily: 'var(--font-mono)',
                    }}
                  >
                    {selected.robotId}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
                    {selected.brand} · {selected.model}
                  </div>
                </div>
              </div>

              {/* 工业机器人：健康分仪表盘 */}
              {selected.industrial && (() => {
                const scores = selected.industrial.joints
                  .map((j) => j.health_score ?? 85)
                  .filter((s) => s > 0)
                const avg = scores.length > 0
                  ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
                  : 85
                return (
                  <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 16 }}>
                    <HealthGauge score={avg} size={100} />
                  </div>
                )
              })()}

              <SectionLabel>坐标 POSITION</SectionLabel>
              <div
                style={{
                  background: 'var(--bg-elev-2)',
                  borderRadius: 'var(--radius-sm)',
                  padding: '10px 12px',
                  fontFamily: 'var(--font-mono)',
                  fontSize: 12,
                  color: 'var(--text-primary)',
                  display: 'grid',
                  gridTemplateColumns: 'auto 1fr',
                  gap: '4px 12px',
                  marginBottom: 16,
                }}
              >
                <span style={{ color: 'var(--text-tertiary)' }}>X</span>
                <span>{selected.position.x.toFixed(2)}</span>
                <span style={{ color: 'var(--text-tertiary)' }}>Y</span>
                <span>{selected.position.y.toFixed(2)}</span>
                <span style={{ color: 'var(--text-tertiary)' }}>θ</span>
                <span>{selected.position.theta.toFixed(2)} rad</span>
              </div>

              <SectionLabel>电量 BATTERY</SectionLabel>
              {isIndustrialArm(selected.brand) ? (
                <div
                  style={{
                    padding: '10px 12px',
                    borderRadius: 'var(--radius-sm)',
                    background: 'var(--bg-elev-2)',
                    fontSize: 12,
                    color: 'var(--text-tertiary)',
                    marginBottom: 16,
                  }}
                >
                  工业机械臂 · 无电池（外接电源供电）
                </div>
              ) : (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    marginBottom: 16,
                  }}
                >
                  <div
                    style={{
                      flex: 1,
                      height: 8,
                      borderRadius: 4,
                      background: 'var(--bg-elev-2)',
                      overflow: 'hidden',
                    }}
                  >
                    <div
                      style={{
                        width: `${selected.batteryPct}%`,
                        height: '100%',
                        background:
                          selected.batteryPct < 20
                            ? 'var(--status-error)'
                            : selected.batteryPct < 50
                            ? 'var(--status-working)'
                            : 'var(--status-online)',
                        transition: 'width 0.3s',
                      }}
                    />
                  </div>
                  <span
                    style={{
                      fontSize: 13,
                      fontWeight: 700,
                      fontFamily: 'var(--font-mono)',
                      color:
                        selected.batteryPct < 20
                          ? 'var(--status-error)'
                          : 'var(--text-primary)',
                    }}
                  >
                    {selected.batteryPct}%
                  </span>
                </div>
              )}

              <SectionLabel>电压 VOLTAGE</SectionLabel>
              <div
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: 14,
                  color: 'var(--text-primary)',
                  marginBottom: 16,
                }}
              >
                {isIndustrialArm(selected.brand)
                  ? `${selected.industrial?.protocol || 'N/A'} 协议`
                  : `${selected.voltage.toFixed(1)} V`}
              </div>

              <SectionLabel>状态 STATUS</SectionLabel>
              <div
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '4px 12px',
                  borderRadius: 'var(--radius-sm)',
                  background:
                    (STATUS_COLORS[selected.status] ?? 'var(--text-tertiary)') +
                    '22',
                  color: STATUS_COLORS[selected.status] ?? 'var(--text-tertiary)',
                  fontSize: 12,
                  fontWeight: 600,
                  marginBottom: 16,
                }}
              >
                <span
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: '50%',
                    background: STATUS_COLORS[selected.status] ?? 'var(--text-tertiary)',
                  }}
                />
                {STATUS_LABELS[selected.status] ?? selected.status}
              </div>

              <SectionLabel>快捷操作 ACTIONS</SectionLabel>
              {INDUSTRIAL_BRANDS.has(selected.brand) ? (
                <>
                  <div
                    style={{
                      padding: 14,
                      borderRadius: 'var(--radius-sm)',
                      background: 'var(--primary-dim)',
                      border: '1px solid var(--border-hover)',
                      marginBottom: 12,
                    }}
                  >
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--primary)', marginBottom: 6 }}>
                      只读监控模式
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-tertiary)', lineHeight: 1.5 }}>
                      工业机器人采用只读接入，不下发控制指令。
                      <br />
                      协议：{selected.industrial?.protocol || 'N/A'}
                    </div>
                  </div>

                  {/* 工业遥测数据面板 */}
                  {selected.industrial && (
                    <>
                      <SectionLabel>关节负载 JOINTS</SectionLabel>
                      <div style={{ marginBottom: 12, display: 'flex', flexDirection: 'column', gap: 4 }}>
                        {selected.industrial.joints.map((j) => (
                          <div key={j.j} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11, fontFamily: 'var(--font-mono)' }}>
                            <span style={{ color: 'var(--text-tertiary)', width: 24 }}>J{j.j}</span>
                            <div style={{ flex: 1, height: 6, borderRadius: 3, background: 'var(--bg-elev-2)', overflow: 'hidden' }}>
                              <div style={{
                                width: `${Math.min(j.load_pct, 100)}%`,
                                height: '100%',
                                background: j.load_pct > 100 ? 'var(--status-error)' : j.load_pct > 80 ? 'var(--alert-warn)' : 'var(--status-online)',
                              }} />
                            </div>
                            <span style={{ color: j.load_pct > 80 ? 'var(--alert-warn)' : 'var(--text-primary)', width: 36, textAlign: 'right' }}>{j.load_pct}%</span>
                            {j.temp_c !== undefined && (
                              <span style={{ color: j.temp_c > 50 ? 'var(--status-error)' : 'var(--text-tertiary)', width: 40 }}>{j.temp_c}°C</span>
                            )}
                          </div>
                        ))}
                      </div>

                      <SectionLabel>运行统计 RUNTIME</SectionLabel>
                      <div style={{
                        display: 'grid',
                        gridTemplateColumns: 'auto auto',
                        gap: '4px 12px',
                        fontFamily: 'var(--font-mono)',
                        fontSize: 11,
                        marginBottom: 12,
                      }}>
                        <span style={{ color: 'var(--text-tertiary)' }}>通电时长</span>
                        <span>{selected.industrial.runtime.power_on_hours.toLocaleString()} h</span>
                        <span style={{ color: 'var(--text-tertiary)' }}>运行周期</span>
                        <span>{selected.industrial.runtime.cycle_count.toLocaleString()}</span>
                        {selected.industrial.runtime.payload_kg !== undefined && (
                          <>
                            <span style={{ color: 'var(--text-tertiary)' }}>当前负载</span>
                            <span>{selected.industrial.runtime.payload_kg} kg</span>
                          </>
                        )}
                      </div>
                    </>
                  )}

                  {/* 品牌特有扩展数据 */}
                  {selected.industrial && (
                    <>
                      <SectionLabel>品牌扩展 EXTENSIONS</SectionLabel>
                      <ExtensionPanel
                        extensions={selected.industrial.extensions}
                        brand={selected.brand}
                      />
                    </>
                  )}

                  {/* AI 洞察面板 */}
                  {selected.industrial && (
                    <AIInsightPanel robotId={selected.robotId} industrial={selected.industrial} />
                  )}

                  {/* 实时趋势图 */}
                  {selected.industrial && (
                    <>
                      <SectionLabel>实时趋势 TRENDS</SectionLabel>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12 }}>
                        <TrendChart robot={selected} metric="temp_c" jointIndex={1} height={100} />
                        <TrendChart robot={selected} metric="load_pct" jointIndex={1} height={100} />
                        <TrendChart robot={selected} metric="current_a" jointIndex={1} height={100} />
                        <TrendChart robot={selected} metric="health_score" height={100} />
                      </div>
                    </>
                  )}
                </>
              ) : (
                <div
                  style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: 6,
                    marginBottom: 16,
                  }}
                >
                  {Object.entries(COMMAND_MAP).map(([key, cmd]) => {
                    const isPending = commandPending === key
                    const isConfirming = confirmCmd === key
                    const isDanger = cmd.destructive
                    return (
                      <button
                        key={key}
                        onClick={() => handleCommand(key)}
                        disabled={isPending}
                        className={`btn ${isDanger ? 'btn-danger' : ''}`}
                        style={{
                          fontSize: 12,
                          padding: '6px 12px',
                          opacity: isPending ? 0.5 : 1,
                          cursor: isPending ? 'wait' : 'pointer',
                          borderColor: isConfirming ? 'var(--alert-error)' : undefined,
                          boxShadow: isConfirming ? '0 0 0 2px var(--alert-error)33' : undefined,
                        }}
                      >
                        {isPending ? '⏳ 处理中…' : isConfirming ? '⚠ 再次点击确认' : cmd.label}
                      </button>
                    )
                  })}
                </div>
              )}

              {/* Toast 提示 */}
              {toast && (
                <div
                  style={{
                    position: 'fixed',
                    bottom: 24,
                    right: 24,
                    padding: '12px 20px',
                    borderRadius: 'var(--radius-sm)',
                    background: toast.type === 'ok' ? 'var(--status-online)' : 'var(--status-error)',
                    color: '#fff',
                    fontSize: 13,
                    fontWeight: 600,
                    zIndex: 1000,
                    animation: 'slideInRight 0.24s var(--ease-spring)',
                    boxShadow: 'var(--shadow-pop)',
                  }}
                >
                  {toast.type === 'ok' ? '✓ ' : '✗ '}{toast.msg}
                </div>
              )}

              <SectionLabel>
                关联告警 ALERTS ({robotAlerts.length})
              </SectionLabel>
              {robotAlerts.length === 0 ? (
                <div
                  style={{
                    color: 'var(--text-tertiary)',
                    fontSize: 12,
                    textAlign: 'center',
                    padding: 10,
                  }}
                >
                  无告警
                </div>
              ) : (
                robotAlerts.map((a, i) => (
                  <AlertItem key={i} alert={a} onDismiss={clearAlerts} />
                ))
              )}
            </>
          ) : (
            <div
              style={{
                color: 'var(--text-tertiary)',
                textAlign: 'center',
                padding: 40,
              }}
            >
              请选择一台机器人
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        fontSize: 11,
        color: 'var(--text-tertiary)',
        textTransform: 'uppercase',
        letterSpacing: '0.08em',
        marginBottom: 8,
      }}
    >
      {children}
    </div>
  )
}