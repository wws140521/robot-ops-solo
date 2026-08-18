/**
 * AI 告警摘要面板
 * 嵌入 RobotsPage 侧边栏
 * 调用 AI SaaS → 显示中文摘要 + 建议
 */
import { useState, useEffect } from 'react'
import { fetchAIInsight, type AIInsightResult } from '../../lib/aiSaaSApi'
import type { IndustrialExtension } from 'robot-adapter-kit'

interface Props {
  robotId: string
  industrial?: IndustrialExtension
}

export function AIInsightPanel({ robotId, industrial }: Props) {
  const [insight, setInsight] = useState<AIInsightResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!industrial) return
    setLoading(true)
    setError('')
    fetchAIInsight(robotId, industrial)
      .then(setInsight)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [robotId, industrial])

  if (!industrial) {
    return (
      <div style={{
        padding: 14,
        borderRadius: 'var(--radius-sm)',
        background: 'var(--bg-elev-2)',
        border: '1px solid var(--border-base)',
        fontSize: 12,
        color: 'var(--text-tertiary)',
      }}>
        AI 分析不可用（非工业机器人）
      </div>
    )
  }

  return (
    <div style={{
      padding: 14,
      borderRadius: 'var(--radius-sm)',
      background: 'linear-gradient(135deg, var(--primary-dim), var(--accent-dim))',
      border: '1px solid var(--border-hover)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <span style={{ fontSize: 16 }}>🧠</span>
        <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>
          AI 运维助手分析
        </span>
        {loading && (
          <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>分析中...</span>
        )}
      </div>

      {error && (
        <div style={{ fontSize: 12, color: 'var(--alert-error)', marginBottom: 8 }}>
          {error}
        </div>
      )}

      {insight && (
        <>
          <div style={{
            fontSize: 12,
            color: 'var(--text-primary)',
            lineHeight: 1.6,
            marginBottom: 12,
            whiteSpace: 'pre-wrap',
          }}>
            {insight.summary}
          </div>

          {insight.suggestions.length > 0 && (
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6 }}>
                排查建议：
              </div>
              <ul style={{ listStyle: 'none', padding: 0, margin: 0, fontSize: 12, color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: 4 }}>
                {insight.suggestions.map((s, i) => (
                  <li key={i} style={{ display: 'flex', gap: 6 }}>
                    <span style={{ color: 'var(--primary)' }}>•</span>
                    <span>{s}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <Metric label="健康分" value={insight.health_score} color={insight.health_score < 60 ? 'var(--alert-error)' : 'var(--status-online)'} />
            {insight.rul_days !== undefined && (
              <Metric label="剩余寿命" value={`${insight.rul_days}天`} color="var(--alert-warn)" />
            )}
            <Metric label="置信度" value={`${(insight.confidence * 100).toFixed(0)}%`} color="var(--text-secondary)" />
          </div>
        </>
      )}
    </div>
  )
}

function Metric({ label, value, color }: { label: string; value: string | number; color: string }) {
  return (
    <div style={{
      padding: '4px 10px',
      borderRadius: 'var(--radius-sm)',
      background: 'var(--bg-elev-2)',
      border: '1px solid var(--border-base)',
      fontSize: 11,
    }}>
      <span style={{ color: 'var(--text-tertiary)', marginRight: 4 }}>{label}:</span>
      <span style={{ fontWeight: 700, color }}>{value}</span>
    </div>
  )
}
