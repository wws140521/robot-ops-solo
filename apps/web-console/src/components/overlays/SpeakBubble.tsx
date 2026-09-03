import { useSpeakStore } from '../../stores/speakStore'
import { useEffect, useState } from 'react'
import './SpeakBubble.css'

// 全局播报气泡：WS 收到 /speak 后弹出，4 秒后自动消失
export function SpeakBubble() {
  const lastSpeak = useSpeakStore((s) => s.lastSpeak)
  const history = useSpeakStore((s) => s.history)
  const [visible, setVisible] = useState(false)
  const [text, setText] = useState('')
  const [bubbleKey, setBubbleKey] = useState(0)
  const [showHistory, setShowHistory] = useState(false)

  // 来了新播报就显示，4 秒后自动关掉
  useEffect(() => {
    if (lastSpeak) {
      setText(lastSpeak.text)
      setBubbleKey((k) => k + 1)
      setVisible(true)
      const timer = setTimeout(() => setVisible(false), 4000)
      return () => clearTimeout(timer)
    }
  }, [lastSpeak])

  // 把时间戳格式化成 HH:MM:SS
  const formatTime = (ts: number) => {
    const d = new Date(ts)
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`
  }

  return (
    <div className="speak-bubble-container">
      {visible && (
        <div key={bubbleKey} className="speak-bubble" role="status" aria-live="polite">
          <div className="speak-bubble__scanline" />
          <span className="speak-bubble__icon">🔊</span>
          <span className="speak-bubble__text">{text}</span>
          <span className="speak-bubble__robot-id">{lastSpeak?.robotId}</span>
        </div>
      )}

      {history.length > 0 && (
        <div className="speak-bubble-history">
          <button
            className="speak-bubble-history__toggle"
            onClick={() => setShowHistory((v) => !v)}
          >
            <span>📋 播报历史</span>
            <span className="speak-bubble-history__count">{history.length}</span>
            <span className={`speak-bubble-history__arrow ${showHistory ? 'open' : ''}`}>▸</span>
          </button>

          {showHistory && (
            <div className="speak-bubble-history__list">
              {[...history].reverse().slice(0, 10).map((h, i) => (
                <div key={i} className="speak-bubble-history__item">
                  <span className="speak-bubble-history__time">{formatTime(h.timestamp)}</span>
                  <span className="speak-bubble-history__robot">{h.robotId}</span>
                  <span className="speak-bubble-history__text">{h.text}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}