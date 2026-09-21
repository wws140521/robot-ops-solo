import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import { useRobotStore } from '../stores/robotStore'
import { useAlertStore } from '../stores/alertStore'
import { useDemoStore, type DemoPhase } from '../stores/demoStore'
import { RobotViewer, StateMachine, FleetViewer, __danceToggle } from 'digital-twin'
import { sendDemoTrigger } from '../lib/wsHub'
import { fetchAIInsight, type AIInsightResult } from '../lib/aiSaaSApi'
import { pushWebhook } from '../lib/webhook'
import { useState, useEffect, useMemo } from 'react'
import { Radio, Music4, Play } from 'lucide-react'

// 工业机械臂品牌集合，这几个牌子用机械臂模型，不是人形
const INDUSTRIAL_BRANDS = new Set(['FANUC', 'KUKA', 'ESTUN', 'YASKAWA'])

// 2026-09-09 单机模式的稳定空表：selector 输出必须引用稳定，
// 组件内字面量 {} 每次渲染都是新引用，会让拆分订阅失效
const EMPTY_ROBOTS: Record<string, never> = {}

// 一键演示的目标机器人（mock 剧本固定用 FANUC：负载爬升 → 伺服过载 → 恢复）
const DEMO_ROBOT_ID = 'FANUC_M20iD_001'
// 一键演示剧本的故障关节（mock 端 DEMO_JOINT，SRVO-023 J2 伺服过载）
const DEMO_FAULT_JOINT = 2

// 演示阶段展示文案（横幅步骤条用）
const DEMO_STEPS: { phase: DemoPhase | 'idle', title: string }[] = [
  { phase: 'ramp', title: '监测负载' },
  { phase: 'alarm', title: '超载告警' },
  { phase: 'recover', title: '自动恢复' },
]

// 数字孪生页：无 id → 舰队全景（多机同屏），带 id → 单机聚焦
// BP 路演主叙事是「跨品牌统一运维」，全景视图撑舰队/规模化故事
export function TwinPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const alerts = useAlertStore((s) => s.alerts)
  const demo = useDemoStore()
  const fleetMode = !id
  // 2026-09-09 订阅拆分（配合 FleetRobot memo）：
  // - 舰队模式订阅全量——多台遥测真实变化，重渲染无法避免，靠 memo 挡住未更新台次的子树
  // - 单机模式只订当前台 + id 签名下拉——其他机器人的遥测不再触发本页重渲染
  const robots = useRobotStore((s) => (fleetMode ? s.robots : EMPTY_ROBOTS))
  const robotList = Object.values(robots)

  // 单机视图当前台（URL id 不存在时回退第一台，与原行为一致）
  const firstId = useRobotStore((s) => Object.keys(s.robots)[0])
  const selected = useRobotStore((s) => {
    if (fleetMode) return undefined
    if (id) return s.robots[id] ?? (firstId ? s.robots[firstId] : undefined)
    return undefined
  })

  // 单机模式下拉选项：订阅 id+brand 签名（brand 静态），设备集合不变就不重渲染
  const dropdownSig = useRobotStore((s) =>
    fleetMode ? '' : Object.entries(s.robots).map(([rid, r]) => `${rid}\u0001${r.brand}`).join('\u0000'),
  )
  const dropdownOptions = useMemo(
    () =>
      dropdownSig === ''
        ? []
        : dropdownSig.split('\u0000').map((pair) => {
            const [rid, brand] = pair.split('\u0001')
            return { rid, brand }
          }),
    [dropdownSig],
  )

  const [radarOn, setRadarOn] = useState(true)
  const [dancing, setDancing] = useState(false)
  // 演示进入告警阶段时拉一次 AI 诊断（走真实 AI 管线，本地 mock 分析）
  const [aiInsight, setAiInsight] = useState<AIInsightResult | null>(null)

  // ── 告警→3D 联动：告警中心点击条目跳转 /twin?focus=<robotId>&joint=<n>&t=<ts> ──
  // focus = 相机飞行聚焦的机器人，joint = 故障关节号（闪烁定位），t = 序号（重复点击重飞）
  const focusRobotId = searchParams.get('focus')
  const focusJointRaw = searchParams.get('joint')
  const focusJoint = focusJointRaw ? Number(focusJointRaw) : null
  const focusSeq = Number(searchParams.get('t')) || 0

  // 演示告警阶段优先走剧本故障（J2 闪烁），否则用告警中心跳转带来的 focus/joint
  const demoAlarmActive = demo.active && demo.phase === 'alarm'
  const faultInfo = demoAlarmActive
    ? { robotId: DEMO_ROBOT_ID, joint: DEMO_FAULT_JOINT as number | null }
    : focusRobotId
      ? { robotId: focusRobotId, joint: focusJoint }
      : null
  // 相机飞行目标：演示优先，其次告警跳转 focus
  const autoFocusRobotId = demo.active && demo.phase !== 'done' ? DEMO_ROBOT_ID : focusRobotId
  // 序号叠加：演示启动翻 0→1 触发飞行，告警重复点击 t 变化也触发
  const autoFocusSeq = (demo.active ? 1 : 0) + focusSeq
  // 单机视图故障关节：URL joint 参数带进来，或演示告警阶段命中演示机
  const singleFaultJoint = demoAlarmActive && id === DEMO_ROBOT_ID ? DEMO_FAULT_JOINT : focusJoint

  useEffect(() => {
    if (demo.phase !== 'alarm' && demo.phase !== 'recover') return
    if (demo.phase === 'alarm') {
      // 告警分发 webhook（真实模式推企微/钉钉/飞书；mock 模式无配置静默跳过）
      console.log('[demo] 告警分发 webhook:', DEMO_ROBOT_ID)
      pushWebhook({ level: 'error', code: 'SRVO-023', message: '伺服过载（J2 轴电机过热）', robot_id: DEMO_ROBOT_ID })
    }
    setAiInsight((prev) => {
      if (prev) return prev
      // 2026-09-09 事件驱动逻辑改 getState 快照：effect 触发时机是 phase 翻转（低频事件），
      // 不需要常驻订阅，避免单机模式下为了 DEMO_ROBOT_ID 又订阅全量 robots
      const target = useRobotStore.getState().robots[DEMO_ROBOT_ID]
      if (!target?.industrial) return prev
      fetchAIInsight(DEMO_ROBOT_ID, target.industrial).then(setAiInsight).catch(() => { /* AI 失败不阻塞演示 */ })
      return prev
    })
  }, [demo.phase])

  // 演示结束后清掉 AI 诊断卡
  useEffect(() => {
    if (!demo.active) setAiInsight(null)
  }, [demo.active])

  const startDemo = () => {
    setAiInsight(null)
    // 触发指令走工业通道（8082），mock 端收到 /demo 启动剧本
    sendDemoTrigger(DEMO_ROBOT_ID)
  }

  // 舰队模式看全舰队告警，单机模式只看当前机器人的，底部滚动用
  const recentAlerts = fleetMode
    ? alerts.slice(0, 6)
    : alerts.filter((a) => a.robotId === selected?.robotId).slice(0, 6)

  return (
    <div style={{
      position: 'absolute',
      inset: 0,
      overflow: 'hidden',
      background: 'var(--bg-base)',
      zIndex: 1,
    }}>
      <div style={{ position: 'absolute', inset: 0, zIndex: 1 }}>
        {fleetMode ? (
          robotList.length > 0 ? (
            <FleetViewer
              robots={robotList}
              // 聚焦的故障机进单机视图时保留 joint 参数，闪烁联动不断档
              onSelect={(robotId) =>
                navigate(
                  `/twin/${robotId}` +
                  (faultInfo?.robotId === robotId && faultInfo.joint != null ? `?joint=${faultInfo.joint}` : ''),
                )
              }
              autoFocusRobotId={autoFocusRobotId}
              autoFocusSeq={autoFocusSeq}
              faultInfo={faultInfo}
            />
          ) : (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              height: '100%',
              color: 'var(--text-tertiary)',
              fontSize: 16,
            }}>
              暂无机器人数据
            </div>
          )
        ) : selected ? (
          // 所有品牌统一走 RobotViewer：商用 URDF 模型 / 工业 URDF + 混凝土地面
          // 旧的 FanucArm/KukaArm 方块模型分支已移除，与舰队视图观感保持一致
          // 2026-09-09 场景统一「地面得有、其他东西不能有」，showMap 道具开关已废弃
          <RobotViewer
            robotId={selected.robotId}
            state={selected}
            faultJoint={singleFaultJoint}
          />
        ) : (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100%',
            color: 'var(--text-tertiary)',
            fontSize: 16,
          }}>
            暂无机器人数据
          </div>
        )}
      </div>

      <div style={{
        position: 'absolute',
        top: 16,
        left: 16,
        right: 16,
        zIndex: 10,
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        pointerEvents: 'none',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, pointerEvents: 'auto' }}>
          {fleetMode ? (
            <div className="card hud-corners" style={{ padding: '10px 16px' }}>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 700, color: 'var(--primary)', letterSpacing: '0.12em' }}>
                FLEET VIEW
              </span>
              <span style={{ fontSize: 12, color: 'var(--text-secondary)', marginLeft: 12 }}>
                {robotList.length} 台 · {robotList.filter((r) => r.online).length} 在线
              </span>
            </div>
          ) : (
            <>
              <button className="btn" onClick={() => navigate('/twin')}>← 舰队全景</button>
              <select
                className="btn"
                value={selected?.robotId ?? ''}
                onChange={(e) => navigate(`/twin/${e.target.value}`)}
              >
                {dropdownOptions.map((o) => (
                  <option key={o.rid} value={o.rid}>{o.rid} ({o.brand})</option>
                ))}
              </select>
            </>
          )}
        </div>
        <div style={{ display: 'flex', gap: 8, pointerEvents: 'auto' }}>
          {fleetMode ? (
            // 一键演示：触发 mock 剧本（负载爬升→超载告警→恢复），横幅显示进度
            <button
              className="btn"
              onClick={startDemo}
              disabled={demo.active && demo.phase !== 'done'}
              style={{
                borderColor: demo.active && demo.phase !== 'done' ? 'var(--alert-warn)' : 'var(--primary)',
                color: demo.active && demo.phase !== 'done' ? 'var(--alert-warn)' : 'var(--primary)',
                animation: 'fadeInUp 0.6s var(--ease-out) 0.2s both',
              }}
            >
              <Play size={14} style={{ marginRight: 4 }} />
              {demo.active && demo.phase !== 'done' ? '演示进行中…' : demo.phase === 'done' ? '演示完成 ✓' : '一键演示'}
            </button>
          ) : (
            <>
              {!INDUSTRIAL_BRANDS.has(selected?.brand ?? '') && selected?.brand === 'unitree' && (
                <button
                  className="btn"
                  onClick={() => {
                    __danceToggle.current?.()
                    setDancing(!dancing)
                  }}
                  style={{
                    borderColor: dancing ? 'var(--primary)' : 'var(--border-base)',
                    color: dancing ? 'var(--primary)' : 'var(--text-secondary)',
                  }}
                >
                  <Music4 size={14} style={{ marginRight: 4 }} /> {dancing ? '停止' : '跳科目三'}
                </button>
              )}
              <button
                className="btn"
                onClick={() => setRadarOn(!radarOn)}
                style={{
                  borderColor: radarOn ? 'var(--primary)' : 'var(--border-base)',
                  color: radarOn ? 'var(--primary)' : 'var(--text-secondary)',
                }}
              >
                <Radio size={14} style={{ marginRight: 4 }} /> 雷达 {radarOn ? 'ON' : 'OFF'}
              </button>
            </>
          )}
        </div>
      </div>

      {/* 演示进度横幅：阶段文案 + 进度条 + 步骤指示 */}
      {fleetMode && demo.active && (
        <div style={{
          position: 'absolute',
          top: 16,
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 10,
          pointerEvents: 'none',
          animation: 'fadeInUp 0.5s var(--ease-out)',
        }}>
          <div
            className="card hud-corners"
            style={{
              padding: '10px 18px',
              minWidth: 440,
              border: `1px solid ${demo.phase === 'alarm' ? 'var(--status-error)' : 'var(--border-subtle)'}`,
              boxShadow: demo.phase === 'alarm' ? 'var(--glow-error, 0 0 16px rgba(255,61,113,0.35))' : undefined,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: 11,
                  letterSpacing: '0.15em',
                  color: demo.phase === 'alarm' ? 'var(--status-error)' : 'var(--primary)',
                  fontWeight: 700,
                }}
              >
                DEMO
              </span>
              <span style={{ fontSize: 13, color: 'var(--text-primary)', flex: 1 }}>{demo.label}</span>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-tertiary)' }}>
                {Math.min(Math.round(demo.elapsed / 1000), Math.round(demo.total / 1000))}s / {Math.round(demo.total / 1000)}s
              </span>
            </div>
            <div style={{ height: 4, background: 'var(--bg-elevated)', borderRadius: 2, marginTop: 8, overflow: 'hidden' }}>
              <div
                style={{
                  height: '100%',
                  width: `${Math.min(100, (demo.elapsed / demo.total) * 100)}%`,
                  background: demo.phase === 'alarm' ? 'var(--status-error)' : 'var(--primary)',
                  transition: 'width 0.5s linear',
                  borderRadius: 2,
                }}
              />
            </div>
            <div style={{ display: 'flex', gap: 18, marginTop: 8 }}>
              {DEMO_STEPS.map((s, i) => {
                const currentIdx = DEMO_STEPS.findIndex((x) => x.phase === demo.phase)
                const isDone = currentIdx > i || demo.phase === 'done'
                const isActive = demo.phase === s.phase
                return (
                  <span
                    key={s.phase}
                    style={{
                      fontSize: 11,
                      fontFamily: 'var(--font-mono)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 5,
                      color: isActive && demo.phase === 'alarm' ? 'var(--status-error)' : isDone || isActive ? 'var(--primary)' : 'var(--text-tertiary)',
                    }}
                  >
                    {isDone ? '✓' : isActive ? '●' : '○'} {s.title}
                  </span>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {/* AI 智能诊断卡：告警阶段触发，走真实 AI 管线（本地 mock 分析） */}
      {fleetMode && aiInsight && (
        <div style={{
          position: 'absolute',
          top: 110,
          right: 16,
          zIndex: 10,
          pointerEvents: 'none',
          animation: 'fadeInUp 0.5s var(--ease-out) 0.15s both',
        }}>
          <div className="card hud-corners" style={{ padding: '14px 16px', width: 310 }}>
            <div style={{ fontSize: 10, letterSpacing: '0.15em', color: 'var(--primary)', fontFamily: 'var(--font-mono)', marginBottom: 8 }}>
              AI INSIGHT · 智能诊断
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-primary)', lineHeight: 1.6 }}>{aiInsight.summary}</div>
            <div style={{ display: 'flex', gap: 14, marginTop: 10, fontFamily: 'var(--font-mono)' }}>
              <span style={{ fontSize: 11 }}>
                <span style={{ color: 'var(--text-tertiary)' }}>健康分 </span>
                <span style={{ color: aiInsight.health_score < 60 ? 'var(--status-error)' : 'var(--status-online)' }}>{aiInsight.health_score}</span>
              </span>
              {aiInsight.rul_days !== undefined && (
                <span style={{ fontSize: 11 }}>
                  <span style={{ color: 'var(--text-tertiary)' }}>RUL </span>
                  <span style={{ color: aiInsight.rul_days < 30 ? 'var(--alert-warn)' : 'var(--status-online)' }}>{aiInsight.rul_days}天</span>
                </span>
              )}
              <span style={{ fontSize: 11 }}>
                <span style={{ color: 'var(--text-tertiary)' }}>置信度 </span>
                <span style={{ color: 'var(--text-primary)' }}>{Math.round(aiInsight.confidence * 100)}%</span>
              </span>
            </div>
            <div style={{ marginTop: 10, borderTop: '1px solid var(--border-subtle)', paddingTop: 8 }}>
              {aiInsight.suggestions.slice(0, 3).map((s, i) => (
                <div key={i} style={{ fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.7 }}>▸ {s}</div>
              ))}
            </div>
            <div style={{ marginTop: 10, fontSize: 11, color: 'var(--alert-info)' }}>
              ✓ 告警已分发 Webhook 通道（企微 / 钉钉 / 飞书）
            </div>
          </div>
        </div>
      )}

      <div style={{
        position: 'absolute',
        top: 64,
        left: 16,
        zIndex: 10,
        pointerEvents: 'none',
        animation: 'fadeInUp 0.6s var(--ease-out)',
        visibility: fleetMode ? 'hidden' : 'visible',
      }}>
        <div className="card hud-corners" style={{ padding: '12px 16px', minWidth: 220 }}>
          <div style={{ fontSize: 10, color: 'var(--text-tertiary)', letterSpacing: '0.15em', marginBottom: 6 }}>
            UNIT ID
          </div>
          <div style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 18,
            fontWeight: 700,
            color: 'var(--primary)',
            textShadow: 'var(--glow-primary)',
          }}>
            {selected?.robotId ?? '—'}
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>
            {selected?.brand ?? '—'} · {selected?.model ?? '—'}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 8 }}>
            <span className={selected?.online ? 'dot dot-online' : 'dot dot-offline'} />
            <span style={{ fontSize: 11, color: selected?.online ? 'var(--status-online)' : 'var(--status-offline)' }}>
              {selected?.online ? 'ONLINE' : 'OFFLINE'}
            </span>
          </div>
        </div>
      </div>

      <div style={{
        position: 'absolute',
        top: 64,
        right: 16,
        zIndex: 10,
        pointerEvents: 'none',
        animation: 'fadeInUp 0.6s var(--ease-out) 0.1s both',
        visibility: fleetMode ? 'hidden' : 'visible',
      }}>
        <div className="card hud-corners" style={{ padding: '12px 16px', minWidth: 210 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'auto auto', gap: '6px 16px', fontFamily: 'var(--font-mono)', fontSize: 12 }}>
            <span style={{ color: 'var(--text-tertiary)' }}>POS</span>
            <span style={{ color: 'var(--text-primary)' }}>
              ({selected?.position.x.toFixed(2) ?? '0.00'}, {selected?.position.y.toFixed(2) ?? '0.00'})
            </span>
            <span style={{ color: 'var(--text-tertiary)' }}>BAT</span>
            <span style={{ color: (selected?.batteryPct ?? 0) > 20 ? 'var(--status-online)' : 'var(--status-error)' }}>
              {(selected?.batteryPct ?? 0).toFixed(1)}%
            </span>
            <span style={{ color: 'var(--text-tertiary)' }}>YAW</span>
            <span style={{ color: 'var(--text-primary)' }}>
              {((selected?.position.theta ?? 0) * 180 / Math.PI).toFixed(1)}°
            </span>
            <span style={{ color: 'var(--text-tertiary)' }}>VOL</span>
            <span style={{ color: 'var(--text-primary)' }}>
              {(selected?.voltage ?? 0).toFixed(1)}V
            </span>
          </div>
        </div>
      </div>

      {radarOn && !fleetMode && (
        <div style={{
          position: 'absolute',
          bottom: 48,
          left: 16,
          zIndex: 10,
          pointerEvents: 'none',
          animation: 'fadeInUp 0.6s var(--ease-out) 0.2s both',
        }}>
          <div className="card hud-corners" style={{
            padding: 12,
            width: 130,
            height: 130,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            <div style={{ position: 'relative', width: 100, height: 100 }}>
              {[0, 1, 2].map((i) => (
                <div key={i} style={{
                  position: 'absolute',
                  inset: `${i * 17}%`,
                  border: '1px solid var(--primary-dim)',
                  borderRadius: '50%',
                }} />
              ))}
              <div style={{
                position: 'absolute',
                inset: 0,
                background:
                  'linear-gradient(var(--primary-dim) 1px, transparent 1px) 50% 0 / 100% 100%,' +
                  'linear-gradient(90deg, var(--primary-dim) 1px, transparent 1px) 0 50% / 100% 100%',
              }} />
              <div style={{
                position: 'absolute',
                inset: 0,
                borderRadius: '50%',
                background: 'conic-gradient(from 0deg, transparent 0deg, var(--primary-glow) 50deg, transparent 50deg)',
                animation: 'radar-spin 3s linear infinite',
                opacity: 0.7,
              }} />
              <div style={{
                position: 'absolute',
                top: '50%',
                left: '50%',
                width: 6,
                height: 6,
                background: 'var(--primary)',
                borderRadius: '50%',
                transform: 'translate(-50%, -50%)',
                boxShadow: 'var(--glow-primary)',
              }} />
              {selected && (
                <div style={{
                  position: 'absolute',
                  top: `${30 + Math.sin(Date.now() / 1000) * 20}%`,
                  left: `${30 + Math.cos(Date.now() / 1000) * 20}%`,
                  width: 4,
                  height: 4,
                  background: 'var(--alert-warn)',
                  borderRadius: '50%',
                  boxShadow: '0 0 6px var(--alert-warn)',
                }} />
              )}
            </div>
          </div>
        </div>
      )}

      <div style={{
        position: 'absolute',
        bottom: 48,
        right: 16,
        zIndex: 10,
        pointerEvents: 'none',
        animation: 'fadeInUp 0.6s var(--ease-out) 0.3s both',
        visibility: fleetMode ? 'hidden' : 'visible',
      }}>
        <StateMachine current={(selected?.status as 'idle' | 'moving' | 'working' | 'charging') ?? 'idle'} />
      </div>

      {recentAlerts.length > 0 && (
        <div style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          zIndex: 10,
          pointerEvents: 'none',
          background: 'linear-gradient(0deg, var(--bg-glass) 0%, transparent 100%)',
          padding: '10px 16px',
          overflow: 'hidden',
        }}>
          <div style={{
            display: 'flex',
            gap: 32,
            animation: 'marquee 25s linear infinite',
            fontFamily: 'var(--font-mono)',
            fontSize: 12,
            width: 'max-content',
          }}>
            {[...recentAlerts, ...recentAlerts].map((a, i) => (
              <span key={`${a.timestamp}-${i}`} style={{
                color: a.level === 'error' ? 'var(--status-error)' : a.level === 'warn' ? 'var(--alert-warn)' : 'var(--alert-info)',
                whiteSpace: 'nowrap',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
              }}>
                <span style={{
                  width: 6,
                  height: 6,
                  borderRadius: '50%',
                  background: a.level === 'error' ? 'var(--status-error)' : a.level === 'warn' ? 'var(--alert-warn)' : 'var(--alert-info)',
                  boxShadow: `0 0 6px ${a.level === 'error' ? 'var(--status-error)' : a.level === 'warn' ? 'var(--alert-warn)' : 'var(--alert-info)'}`,
                }} />
                [{a.level.toUpperCase()}] {a.robotId}: {a.message}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}