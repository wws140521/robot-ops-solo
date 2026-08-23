/**
 * Neon Glass 风格健康分仪表盘（SVG 圆环）
 * 颜色：≥80 绿（OK）、≥60 黄（WARN）、<60 红（ERROR）
 */
interface Props {
  value: number
  size?: number
  label?: string
}

function gaugeColor(v: number): string {
  if (v >= 80) return 'var(--status-online)'
  if (v >= 60) return 'var(--status-working)'
  return 'var(--status-error)'
}

export function HealthGauge({ value, size = 88, label = '健康分' }: Props) {
  const r = size / 2 - 8
  const c = 2 * Math.PI * r
  const clamped = Math.max(0, Math.min(100, value))
  const dash = (clamped / 100) * c
  const color = gaugeColor(clamped)

  return (
    <div
      style={{
        position: 'relative',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: size,
        height: size,
      }}
    >
      <svg width={size} height={size}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="rgba(255,255,255,.1)"
          strokeWidth="6"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray={`${dash} ${c}`}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          style={{
            transition: 'stroke-dasharray .4s ease, stroke .3s ease',
            filter: `drop-shadow(0 0 4px ${color}66)`,
          }}
        />
      </svg>
      <div
        style={{
          position: 'absolute',
          fontSize: size * 0.25,
          fontWeight: 700,
          color,
          fontFamily: 'var(--font-mono)',
        }}
      >
        {Math.round(clamped)}
      </div>
      <div
        style={{
          position: 'absolute',
          bottom: 6,
          fontSize: 10,
          color: 'var(--text-muted)',
        }}
      >
        {label}
      </div>
    </div>
  )
}
