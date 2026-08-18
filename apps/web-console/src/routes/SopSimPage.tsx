import { useState, useRef } from 'react'
import { createSimulator, HOTPOT_DINNER_V1, type SopGraph } from 'sop-editor'
import { Play, Square, Volume2, ClipboardList, Soup } from 'lucide-react'

export function SopSimPage() {
  const graph: SopGraph = HOTPOT_DINNER_V1
  const [logs, setLogs] = useState<string[]>([])
  const [speaking, setSpeaking] = useState('')
  const [running, setRunning] = useState(false)
  const [battery, setBattery] = useState(85)
  const [simTime, setSimTime] = useState('18:00')
  const simRef = useRef<{ stop: () => void } | null>(null)

  const addLog = (msg: string) =>
    setLogs((prev) => [...prev.slice(-80), `[${new Date().toLocaleTimeString()}] ${msg}`])

  const start = async () => {
    setRunning(true)
    setLogs([])
    setSpeaking('')
    setBattery(85)
    setSimTime('18:00')

    const sim = createSimulator(graph, {
      onLog: addLog,
      onSpeak: (text) => {
        addLog(`🔊 ${text}`)
        setSpeaking(text)
        setTimeout(() => setSpeaking(''), 2500)
      },
      onMove: (from, to) => addLog(`→ 从 ${from} 到 ${to}`),
      onAlert: (code, msg) => addLog(`⚠️ [${code}] ${msg}`),
      onState: (s) => {
        setBattery(s.batteryPct)
        setSimTime(s.simTime.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }))
      },
      onComplete: () => {
        addLog('✅ 执行完毕')
        setRunning(false)
      },
    })
    simRef.current = sim
    await sim.start()
  }

  const stop = () => {
    simRef.current?.stop()
    setRunning(false)
    addLog('⏹ 已手动停止')
  }

  const logColor = (log: string) =>
    log.includes('⚠️') ? '#f87171'
    : log.includes('🔊') ? '#fbbf24'
    : log.includes('✅') ? '#4ade80'
    : log.includes('移动') || log.includes('→') ? '#93c5fd'
    : log.includes('充电') ? '#a78bfa'
    : 'var(--text-tertiary)'

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">SOP 模拟运行</h1>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.3fr', gap: 16 }}>
        {/* 左：控制 + 状态 */}
        <div className="card">
          <h2 style={{ marginTop: 0, display: 'inline-flex', alignItems: 'center', gap: 8 }}><Soup size={18} /> {graph.name}</h2>
          <div style={{ color: 'var(--text-tertiary)', fontSize: 13, marginBottom: 12 }}>
            品牌：{graph.brand} / {graph.model} · {graph.nodes.length} 节点 · {graph.edges.length} 连线
          </div>

          {/* 状态条 */}
          <div style={{ display: 'flex', gap: 16, marginBottom: 16 }}>
            <div style={{ flex: 1, background: 'var(--bg-elev-2)', borderRadius: 8, padding: 12 }}>
              <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>电量</div>
              <div style={{ fontSize: 22, fontWeight: 700, color: battery < 30 ? 'var(--status-error)' : 'var(--status-online)' }}>
                {battery}%
              </div>
            </div>
            <div style={{ flex: 1, background: 'var(--bg-elev-2)', borderRadius: 8, padding: 12 }}>
              <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>模拟时钟</div>
              <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--status-moving)' }}>{simTime}</div>
            </div>
          </div>

          {!running ? (
            <button className="btn btn-primary" style={{ width: '100%', padding: '12px', fontSize: 16, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8 }} onClick={start}>
              <Play size={18} /> 开始模拟执行
            </button>
          ) : (
            <button className="btn" style={{ width: '100%', padding: '12px', fontSize: 16, background: 'var(--status-error)', color: '#0a0e1a', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8 }} onClick={stop}>
              <Square size={18} /> 执行中... 点击停止
            </button>
          )}

          {/* 播报气泡 */}
          {speaking && (
            <div
              style={{
                marginTop: 20,
                padding: 16,
                background: 'linear-gradient(135deg, rgba(0,240,255,0.12), rgba(123,97,255,0.12))',
                borderRadius: 12,
                border: '1px solid var(--primary-glow)',
                color: 'var(--text-primary)',
                fontSize: 18,
                fontWeight: 600,
                animation: 'pulse 1.2s ease-in-out infinite',
              }}
            >
              <Volume2 size={20} /> {speaking}
            </div>
          )}

          {/* 航点说明 */}
          <div style={{ marginTop: 20, fontSize: 12, color: 'var(--text-tertiary)' }}>
            <div style={{ fontWeight: 600, marginBottom: 6, color: 'var(--text-secondary)' }}>航点</div>
            {graph.waypoints &&
              Object.entries(graph.waypoints).map(([k, w]) => (
                <div key={k}>
                  {k} · {w.name} ({w.x},{w.y})
                </div>
              ))}
          </div>
        </div>

        {/* 右：执行日志 */}
        <div className="card" style={{ padding: 0, display: 'flex', flexDirection: 'column' }}>
          <div style={{ padding: '12px 16px', fontWeight: 600, borderBottom: '1px solid var(--border-base)', color: 'var(--text-primary)', display: 'inline-flex', alignItems: 'center', gap: 8 }}><ClipboardList size={16} /> 执行日志</div>
          <div
            style={{
              flex: 1,
              height: 540,
              overflowY: 'auto',
              background: 'var(--bg-elev-1)',
              color: 'var(--text-primary)',
              padding: 16,
              fontFamily: 'var(--font-mono)',
              fontSize: 12.5,
              lineHeight: 1.7,
            }}
          >
            {logs.length === 0 && <div style={{ color: 'var(--text-tertiary)' }}>点击「开始模拟执行」启动…</div>}
            {logs.map((log, i) => (
              <div key={i} style={{ color: logColor(log) }}>
                {log}
              </div>
            ))}
          </div>
        </div>
      </div>

      <style>{`@keyframes pulse { 0%,100% { transform: scale(1); } 50% { transform: scale(1.03); } }`}</style>
    </div>
  )
}
