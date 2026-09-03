// 健康分仪表盘，SVG 圆环
// 颜色分段：80以上绿，60以上黄，40以上橙，40以下红

interface Props {
  score: number
  size?: number
  label?: string
}

// 根据分数给圆环选颜色
function healthColor(score: number): string {
  if (score >= 80) return 'var(--status-online)'
  if (score >= 60) return 'var(--status-working)'
  if (score >= 40) return 'var(--alert-warn)'
  return 'var(--status-error)'
}

// SVG 圆环仪表盘，score 限制在 0-100 避免画出去
export function HealthGauge({ score, size = 120, label = '健康分' }: Props) {
  const radius = (size - 20) / 2
  const circumference = 2 * Math.PI * radius
  const clamped = Math.max(0, Math.min(100, score))
  const offset = circumference * (1 - clamped / 100)
  const color = healthColor(clamped)

  return (
    <div style={{ position: 'relative', width: size, height: size, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <svg width={size} height={size}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--bg-elev-2)"
          strokeWidth={10}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={10}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          style={{ transition: 'stroke-dashoffset 0.6s ease, stroke 0.3s' }}
        />
      </svg>
      <div style={{ position: 'absolute', textAlign: 'center' }}>
        <div style={{ fontSize: size * 0.28, fontWeight: 700, color, fontFamily: 'var(--font-mono)' }}>
          {Math.round(clamped)}
        </div>
        <div style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>{label}</div>
      </div>
    </div>
  )
}
