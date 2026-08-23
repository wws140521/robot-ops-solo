import type { ReactNode } from 'react'

export interface TimelineItem {
  time: string
  title: string
  status: 'done' | 'doing' | 'todo' | 'warn' | 'error'
  desc?: string
  icon?: ReactNode
}

const STATUS_STYLES: Record<string, { dotColor: string; dotBorder: string; glow?: boolean; anim?: string }> = {
  done:  { dotColor: 'var(--neon)', dotBorder: 'var(--neon)', glow: true },
  doing: { dotColor: 'var(--bg-base)', dotBorder: 'var(--neon)', glow: true, anim: 'ng-soft-pulse 1.2s infinite' },
  todo:  { dotColor: 'var(--bg-base)', dotBorder: 'var(--border-base)' },
  warn:  { dotColor: 'var(--bg-base)', dotBorder: 'var(--status-working)', glow: true },
  error: { dotColor: 'var(--bg-base)', dotBorder: 'var(--status-error)', glow: true },
}

export function TaskTimeline({ items }: { items: TimelineItem[] }) {
  return (
    <ol
      style={{
        position: 'relative',
        margin: 0,
        padding: 0,
        listStyle: 'none',
      }}
    >
      {/* 时间轴线 */}
      <span
        style={{
          content: '',
          position: 'absolute',
          left: 7,
          top: 4,
          bottom: 4,
          width: 2,
          background: 'linear-gradient(var(--border-strong), transparent)',
          pointerEvents: 'none',
        }}
      />
      {items.map((it, i) => {
        const cfg = STATUS_STYLES[it.status] || STATUS_STYLES.todo
        return (
          <li
            key={i}
            style={{
              position: 'relative',
              padding: '0 0 14px 26px',
            }}
          >
            {/* 时间轴节点 */}
            <span
              style={{
                position: 'absolute',
                left: 0,
                top: 4,
                width: 16,
                height: 16,
                borderRadius: '50%',
                border: `2px solid ${cfg.dotBorder}`,
                background: cfg.dotColor,
                boxShadow: cfg.glow ? 'var(--neon-glow)' : 'none',
                animation: cfg.anim || 'none',
              }}
            />
            <div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{it.time}</div>
              <div style={{ fontSize: 13, color: 'var(--text-primary)', fontWeight: 500, marginTop: 2 }}>
                {it.icon && <span style={{ marginRight: 6 }}>{it.icon}</span>}
                {it.title}
              </div>
              {it.desc && (
                <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4, lineHeight: 1.5 }}>
                  {it.desc}
                </div>
              )}
            </div>
          </li>
        )
      })}
    </ol>
  )
}
