import type { ReactNode, CSSProperties } from 'react'

interface GlassCardProps {
  children: ReactNode
  highlight?: boolean
  className?: string
  style?: CSSProperties
  onClick?: () => void
}

export function GlassCard({ children, highlight = false, className = '', style, onClick }: GlassCardProps) {
  return (
    <div
      onClick={onClick}
      className={`glass-card ${highlight ? 'glass-card--highlight' : ''} ${className}`}
      style={{
        position: 'relative',
        background: 'var(--bg-glass)',
        border: '1px solid var(--border-base)',
        borderRadius: 14,
        padding: 16,
        backdropFilter: 'blur(14px)',
        WebkitBackdropFilter: 'blur(14px)',
        boxShadow: highlight
          ? 'var(--neon-glow), var(--shadow-card), var(--shadow-glass)'
          : 'var(--shadow-card), var(--shadow-glass)',
        color: 'var(--text-primary)',
        transition: 'transform .2s ease, box-shadow .2s ease, border-color .2s ease',
        cursor: onClick ? 'pointer' : 'default',
        ...style,
      }}
      onMouseEnter={(e) => {
        if (onClick) {
          e.currentTarget.style.transform = 'translateY(-2px)'
          e.currentTarget.style.borderColor = 'var(--border-strong)'
        }
      }}
      onMouseLeave={(e) => {
        if (onClick) {
          e.currentTarget.style.transform = 'translateY(0)'
          e.currentTarget.style.borderColor = highlight ? 'var(--border-strong)' : 'var(--border-base)'
        }
      }}
    >
      {children}
    </div>
  )
}
