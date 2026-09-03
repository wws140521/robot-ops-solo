import { useState, useRef, useEffect } from 'react'
import { runAgent, setRobotStateSource, setAlertSource, setSopMatcher } from 'robot-agent-kit'
import { useRobotStore } from '../stores/robotStore'
import { useAlertStore } from '../stores/alertStore'
import { MessageSquare, X, Send } from 'lucide-react'
import type { SopTemplate } from 'robot-agent-kit'

const DEMO_SOPS: SopTemplate[] = [
  {
    alarm_code: 'OVER_TEMP_J2',
    title: 'J2 关节过温处置',
    estimated_minutes: 20,
    steps: [
      { id: 1, title: '确认告警', detail: '在 Dashboard 查看 J2 关节温度与负载曲线。' },
      { id: 2, title: '降低负载', detail: '暂停高节拍任务，降低 J2 加速度/减速度。' },
      { id: 3, title: '检查散热', detail: '现场确认电机风扇、散热孔是否堵塞。' },
      { id: 4, title: '闭环确认', detail: '温度回落至 45℃ 以下后恢复生产。' },
    ],
  },
  {
    alarm_code: 'SRVO_023',
    title: '伺服异常复位',
    estimated_minutes: 15,
    steps: [
      { id: 1, title: '记录现场', detail: '拍照记录当前工件位置与报警界面。' },
      { id: 2, title: '断电重启', detail: '按安全规程切断伺服电源，等待 30 秒后上电。' },
      { id: 3, title: '复位报警', detail: '在示教器执行报警复位，确认无异常后回原点。' },
    ],
  },
]

export function ChatPanel({ robotId }: { robotId?: string }) {
  const [open, setOpen] = useState(false)
  const [input, setInput] = useState('')
  const [messages, setMessages] = useState<{ role: 'user' | 'agent'; text: string }[]>([
    { role: 'agent', text: '我是 Robot-Ops 运维助手，可查询状态、告警、健康分、SOP 与报告。' },
  ])
  const [loading, setLoading] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  // 注入数据源：让 agent-kit 工具能读取 web-console 的 store
  useEffect(() => {
    setRobotStateSource((id: string) => useRobotStore.getState().robots[id])
    setAlertSource((id?: string) => {
      const all = useAlertStore.getState().alerts
      return id ? all.filter((a) => a.robotId === id) : all
    })
    setSopMatcher((code: string) => DEMO_SOPS.find((s) => s.alarm_code === code) || null)
  }, [])

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages, open])

  const send = async () => {
    if (!input.trim() || loading) return
    const userText = input.trim()
    setInput('')
    setMessages((m) => [...m, { role: 'user', text: userText }])
    setLoading(true)
    try {
      const reply = await runAgent(userText, { robotIdHint: robotId, forceMock: true })
      setMessages((m) => [...m, { role: 'agent', text: reply }])
    } catch (e) {
      setMessages((m) => [...m, { role: 'agent', text: '调用 Agent 失败，请稍后重试。' }])
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 20,
        right: 20,
        zIndex: 50,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-end',
        gap: 12,
      }}
    >
      {open && (
        <div
          style={{
            width: 360,
            maxHeight: 480,
            display: 'flex',
            flexDirection: 'column',
            background: 'var(--bg-glass)',
            backdropFilter: 'blur(16px)',
            WebkitBackdropFilter: 'blur(16px)',
            border: '1px solid var(--border-base)',
            borderRadius: 16,
            boxShadow: '0 12px 32px rgba(0,0,0,0.25)',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              padding: '12px 16px',
              borderBottom: '1px solid var(--border-subtle)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <span style={{ fontWeight: 600, fontSize: 14 }}>Robot-Ops 运维助手</span>
            <button
              onClick={() => setOpen(false)}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--text-secondary)',
                cursor: 'pointer',
              }}
            >
              <X size={18} />
            </button>
          </div>

          <div
            ref={scrollRef}
            style={{
              flex: 1,
              padding: 12,
              overflowY: 'auto',
              display: 'flex',
              flexDirection: 'column',
              gap: 10,
            }}
          >
            {messages.map((msg, idx) => (
              <div
                key={idx}
                style={{
                  alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start',
                  maxWidth: '85%',
                  padding: '8px 12px',
                  borderRadius: 12,
                  fontSize: 13,
                  lineHeight: 1.5,
                  whiteSpace: 'pre-wrap',
                  background:
                    msg.role === 'user' ? 'var(--primary)' : 'var(--bg-elevated)',
                  color: msg.role === 'user' ? '#fff' : 'var(--text-primary)',
                }}
              >
                {msg.text}
              </div>
            ))}
            {loading && (
              <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>思考中...</div>
            )}
          </div>

          <div
            style={{
              padding: 12,
              borderTop: '1px solid var(--border-subtle)',
              display: 'flex',
              gap: 8,
            }}
          >
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && send()}
              placeholder="用自然语言提问..."
              style={{
                flex: 1,
                padding: '8px 12px',
                borderRadius: 8,
                border: '1px solid var(--border-base)',
                background: 'var(--bg-elevated)',
                color: 'var(--text-primary)',
                fontSize: 13,
                outline: 'none',
              }}
            />
            <button
              onClick={send}
              disabled={loading || !input.trim()}
              style={{
                padding: '8px 12px',
                borderRadius: 8,
                border: 'none',
                background: 'var(--primary)',
                color: '#fff',
                cursor: loading || !input.trim() ? 'not-allowed' : 'pointer',
                opacity: loading || !input.trim() ? 0.6 : 1,
              }}
            >
              <Send size={16} />
            </button>
          </div>
        </div>
      )}

      <button
        onClick={() => setOpen((v) => !v)}
        style={{
          width: 48,
          height: 48,
          borderRadius: '50%',
          border: 'none',
          background: 'var(--primary)',
          color: '#fff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 4px 16px rgba(0,0,0,0.2)',
          cursor: 'pointer',
        }}
      >
        <MessageSquare size={22} />
      </button>
    </div>
  )
}
