import { useParams } from 'react-router-dom'
import { useRobotStore } from '../stores/robotStore'
import { useAlertStore } from '../stores/alertStore'
import { RobotViewer, FanucArm, KukaArm, StateMachine, __danceToggle } from 'digital-twin'
import { Canvas } from '@react-three/fiber'
import { useState } from 'react'
import { Radio, Music4 } from 'lucide-react'

const INDUSTRIAL_BRANDS = new Set(['FANUC', 'KUKA', 'ESTUN', 'YASKAWA'])

export function TwinPage() {
  const { id } = useParams()
  const { robots } = useRobotStore()
  const alerts = useAlertStore((s) => s.alerts)
  const robotList = Object.values(robots)
  const selected = id ? robots[id] : robotList[0]
  const [radarOn, setRadarOn] = useState(true)
  const [dancing, setDancing] = useState(false)

  const recentAlerts = alerts.filter((a) => a.robotId === selected?.robotId).slice(0, 6)

  return (
    <div style={{
      position: 'absolute',
      inset: 0,
      overflow: 'hidden',
      background: 'var(--bg-base)',
      zIndex: 1,
    }}>
      <div style={{ position: 'absolute', inset: 0, zIndex: 1 }}>
        {selected ? (
          INDUSTRIAL_BRANDS.has(selected.brand) ? (
            <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Canvas camera={{ position: [4, 3, 4], fov: 42 }}>
                <ambientLight intensity={0.6} />
                <directionalLight position={[5, 8, 5]} intensity={1.2} />
                <pointLight position={[-3, 2, -2]} intensity={0.4} color="#4a9eff" />
                {selected.brand === 'FANUC' && (
                  <FanucArm joints={selected.industrial?.joints || []} scale={3} />
                )}
                {(selected.brand === 'KUKA' || selected.brand === 'ESTUN') && (
                  <KukaArm joints={selected.industrial?.joints || []} scale={3} />
                )}
                {selected.brand === 'YASKAWA' && (
                  <FanucArm joints={selected.industrial?.joints || []} scale={3} />
                )}
              </Canvas>
            </div>
          ) : (
            <RobotViewer robotId={selected.robotId} state={selected} showMap />
          )
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
          <select
            className="btn"
            value={selected?.robotId ?? ''}
            onChange={(e) => window.location.assign(`/twin/${e.target.value}`)}
          >
            {robotList.map((r) => (
              <option key={r.robotId} value={r.robotId}>{r.robotId} ({r.brand})</option>
            ))}
          </select>
        </div>
        <div style={{ display: 'flex', gap: 8, pointerEvents: 'auto' }}>
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
        </div>
      </div>

      <div style={{
        position: 'absolute',
        top: 64,
        left: 16,
        zIndex: 10,
        pointerEvents: 'none',
        animation: 'fadeInUp 0.6s var(--ease-out)',
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

      {radarOn && (
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