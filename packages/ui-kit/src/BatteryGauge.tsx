interface Props {
  pct: number
  size?: number
}

const COLOR = {
  low: 'var(--status-error)',
  mid: 'var(--status-working)',
  hi: 'var(--status-online)',
}

export function BatteryGauge({ pct, size = 80 }: Props) {
  const center = size / 2
  const outerR = size / 2 - 2
  const progressR = outerR - 6
  const tickR = outerR - 1
  const circ = 2 * Math.PI * progressR
  const dash = (pct / 100) * circ

  const color =
    pct < 20 ? COLOR.low : pct < 50 ? COLOR.mid : COLOR.hi

  return (
    <div
      style={{
        position: 'relative',
        width: size,
        height: size,
      }}
    >
      <svg width={size} height={size}>
        <defs>
          <filter id={`battery-glow-${size}`}>
            <feGaussianBlur stdDeviation="2.5" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        <circle
          cx={center}
          cy={center}
          r={outerR}
          fill="none"
          stroke="var(--border-base)"
          strokeWidth={1}
          opacity={0.4}
        />

        {Array.from({ length: 12 }).map((_, i) => {
          const angle = (i / 12) * Math.PI * 2 - Math.PI / 2
          const x1 = center + Math.cos(angle) * tickR
          const y1 = center + Math.sin(angle) * tickR
          const tickLen = 3
          const x2 = center + Math.cos(angle) * (tickR - tickLen)
          const y2 = center + Math.sin(angle) * (tickR - tickLen)
          const active = i < Math.round((pct / 100) * 12)
          return (
            <line
              key={i}
              x1={x1}
              y1={y1}
              x2={x2}
              y2={y2}
              stroke={active ? color : 'var(--border-base)'}
              strokeWidth={1.5}
              opacity={active ? 1 : 0.3}
            />
          )
        })}

        <circle
          cx={center}
          cy={center}
          r={progressR}
          fill="none"
          stroke="var(--bg-elev-3)"
          strokeWidth={5}
        />

        <circle
          cx={center}
          cy={center}
          r={progressR}
          fill="none"
          stroke={color}
          strokeWidth={5}
          strokeDasharray={`${dash} ${circ - dash}`}
          strokeLinecap="round"
          transform={`rotate(-90 ${center} ${center})`}
          style={{ transition: 'stroke-dasharray 0.5s ease, stroke 0.3s ease' }}
          filter={`url(#battery-glow-${size})`}
        />

        <circle
          cx={center}
          cy={center}
          r={progressR - 4}
          fill="none"
          stroke={color}
          strokeWidth={0.5}
          opacity={0.3}
        />
      </svg>

      <div
        style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          textAlign: 'center',
        }}
      >
        <div
          style={{
            fontSize: size * 0.22,
            fontWeight: 700,
            color,
            fontFamily: 'var(--font-mono)',
            lineHeight: 1,
            textShadow: `0 0 8px ${color}66`,
          }}
        >
          {pct}%
        </div>
      </div>
    </div>
  )
}