import type { ReactNode } from 'react'

const BRAND_COLORS: Record<string, string> = {
  FANUC: '#e60012',
  KUKA: '#f5a623',
  ESTUN: '#39ff8b',
  YASKAWA: '#5ecbff',
  UR: '#ffd166',
  ABB: '#9b8cff',
  unitree: '#ff6b35',
  keenon: '#5ecbff',
  agibot: '#39ff8b',
  pudutech: '#ffd166',
}

export function NeonBadge({ brand, children }: { brand: string; children?: ReactNode }) {
  const color = BRAND_COLORS[brand] || 'var(--neon)'
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding: '2px 10px',
        border: `1px solid ${color}`,
        borderRadius: 999,
        fontSize: 12,
        background: 'rgba(255,255,255,0.04)',
        color,
      }}
    >
      {children || brand}
    </span>
  )
}
