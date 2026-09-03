import { memo } from 'react'

// StateMachine - 底部状态机步进指示器
// 显示机器人当前状态在状态流里的位置：IDLE → MOVING → WORKING → CHARGING
// 当前状态高亮 + 发光，其余半透明

const STATES = ['idle', 'moving', 'working', 'charging'] as const
export type RobotState = typeof STATES[number]

const STATE_LABELS: Record<RobotState, string> = {
  idle: 'IDLE',
  moving: 'MOVING',
  working: 'WORKING',
  charging: 'CHARGING',
}

const STATE_COLORS: Record<RobotState, string> = {
  idle: '#00e676',
  moving: '#00f0ff',
  working: '#ffab00',
  charging: '#7b61ff',
}

interface StateMachineProps {
  current: RobotState
  size?: 'sm' | 'md' | 'lg'
}

export const StateMachine = memo(function StateMachine({
  current,
  size = 'md',
}: StateMachineProps) {
  const currentIndex = STATES.indexOf(current)

  const fontSize = size === 'sm' ? 10 : size === 'lg' ? 13 : 11
  const padding = size === 'sm' ? '2px 6px' : size === 'lg' ? '5px 12px' : '3px 8px'
  const dotSize = size === 'sm' ? 6 : size === 'lg' ? 12 : 10
  const lineWidth = size === 'sm' ? 1 : 2
  const gap = size === 'sm' ? 4 : 8

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 0,
        padding: size === 'lg' ? '14px 28px' : '10px 16px',
        background: 'rgba(10, 14, 26, 0.9)',
        borderTop: '1px solid rgba(0, 240, 255, 0.15)',
        fontFamily: 'JetBrains Mono, ui-monospace, monospace',
        fontSize,
        color: '#e2e8f0',
        whiteSpace: 'nowrap',
        letterSpacing: '0.05em',
      }}
    >
      {STATES.map((state, i) => {
        const isActive = i === currentIndex
        const color = STATE_COLORS[state]

        return (
          <div
            key={state}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap,
              opacity: isActive ? 1 : 0.4,
              transition: 'opacity 0.3s, color 0.3s',
              color: isActive ? color : '#64748b',
            }}
          >
            {/* 状态点 */}
            <div
              style={{
                width: dotSize,
                height: dotSize,
                borderRadius: '50%',
                border: `${lineWidth}px solid ${isActive ? color : 'currentColor'}`,
                background: isActive ? color : 'transparent',
                boxShadow: isActive ? `0 0 ${dotSize}px ${color}` : 'none',
                transition: 'all 0.3s ease',
              }}
            />
            {/* 状态标签 */}
            <span
              style={{
                padding,
                borderRadius: 4,
                fontWeight: isActive ? 700 : 400,
                fontSize,
                color: isActive ? color : 'currentColor',
                background: isActive ? `${color}18` : 'transparent',
                textShadow: isActive ? `0 0 8px ${color}80` : 'none',
              }}
            >
              {STATE_LABELS[state]}
            </span>
            {/* 连接线 */}
            {i < STATES.length - 1 && (
              <div
                style={{
                  width: size === 'sm' ? 24 : size === 'lg' ? 48 : 36,
                  height: lineWidth,
                  background: i < currentIndex ? color : '#334155',
                  margin: `0 ${gap}px`,
                  transition: 'background 0.3s ease',
                }}
              />
            )}
          </div>
        )
      })}
    </div>
  )
})