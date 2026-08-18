import { NavLink } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { TenantLogo } from 'ui-kit'
import {
  LayoutDashboard,
  Bot,
  Workflow,
  Play,
  Box,
  Bell,
  Building2,
  Sun,
  Moon,
  type LucideIcon,
} from 'lucide-react'
import { useTenantStore } from '../../stores/tenantStore'
import { useRobotStore } from '../../stores/robotStore'
import { useThemeStore } from '../../stores/themeStore'
import { getOverallConnState, subscribeConnState } from '../../lib/wsHub'

const navItems: { to: string; label: string; icon: LucideIcon; end: boolean }[] = [
  { to: '/',        label: '仪表盘',    icon: LayoutDashboard, end: true  },
  { to: '/robots',  label: '机器人',    icon: Bot,             end: false },
  { to: '/sop',     label: 'SOP 编排', icon: Workflow,        end: false },
  { to: '/sop-sim', label: 'SOP 模拟',  icon: Play,            end: false },
  { to: '/twin',    label: '数字孪生',  icon: Box,             end: false },
  { to: '/alerts',  label: '告警中心',  icon: Bell,            end: false },
  { to: '/tenants', label: '租户管理',  icon: Building2,       end: false },
]

export function Sidebar() {
  const { tenant } = useTenantStore()
  const onlineCount = useRobotStore((s) => s.onlineCount)
  const themeMode = useThemeStore((s) => s.mode)
  const toggleTheme = useThemeStore((s) => s.toggle)
  const isLight = themeMode === 'light'

  // P7: 细致连接状态（绿/黄/红）
  const [connState, setConnState] = useState(getOverallConnState())
  useEffect(() => {
    const unsub = subscribeConnState(() => setConnState(getOverallConnState()))
    return unsub
  }, [])

  const wsConnected = connState === 'connected'
  const wsReconnecting = connState === 'reconnecting'
  const wsColor = wsConnected
    ? 'var(--status-online)'
    : wsReconnecting
    ? 'var(--status-working)'
    : 'var(--status-error)'
  const wsLabel = wsConnected ? 'CONNECTED' : wsReconnecting ? 'RECONNECTING' : 'OFFLINE'

  return (
    <aside
      style={{
        width: 200,
        background: 'var(--bg-glass)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        borderRight: '1px solid var(--border-base)',
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
        zIndex: 10,
      }}
    >
      <div
        style={{
          padding: '24px 20px 20px',
          borderBottom: '1px solid var(--border-subtle)',
          position: 'relative',
        }}
      >
        <div
          style={{
            position: 'absolute',
            bottom: -1, left: 20, right: 20,
            height: 1,
            background: 'linear-gradient(90deg, transparent, var(--primary), transparent)',
          }}
        />
        {tenant && (
          <TenantLogo
            logoUrl={tenant.logoUrl}
            tenantName={tenant.name}
            primaryColor={tenant.primaryColor}
          />
        )}
      </div>

      <nav
        style={{
          flex: 1,
          padding: '12px 10px',
          display: 'flex',
          flexDirection: 'column',
          gap: '2px',
        }}
      >
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
            style={({ isActive }) => ({
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              padding: '10px 14px',
              borderRadius: 'var(--radius-sm)',
              fontSize: 13,
              fontWeight: 500,
              color: isActive ? 'var(--primary)' : 'var(--text-secondary)',
              background: isActive ? 'linear-gradient(90deg, var(--primary-dim), transparent)' : 'transparent',
              borderLeft: `3px solid ${isActive ? 'var(--primary)' : 'transparent'}`,
              transition: 'all 0.2s var(--ease-out)',
              position: 'relative',
              cursor: 'pointer',
              textDecoration: 'none',
            })}
          >
            {({ isActive }) => (
              <>
                <span style={{ fontSize: 16, width: 20, textAlign: 'center', flexShrink: 0 }}>
                  <item.icon size={16} />
                </span>
                <span style={{ flex: 1 }}>{item.label}</span>
                {isActive && (
                  <span
                    style={{
                      width: 6,
                      height: 6,
                      borderRadius: '50%',
                      background: 'var(--primary)',
                      boxShadow: '0 0 8px var(--primary)',
                      animation: 'pulse-dot 1.5s ease infinite',
                      flexShrink: 0,
                    }}
                  />
                )}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      <div
        style={{
          padding: '14px 20px',
          borderTop: '1px solid var(--border-subtle)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          fontSize: 11,
          color: 'var(--text-tertiary)',
        }}
      >
        <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span
            style={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              background: wsColor,
              boxShadow: wsConnected ? `0 0 8px ${wsColor}` : 'none',
              animation: wsConnected
                ? 'pulse-dot 2s ease infinite'
                : wsReconnecting
                ? 'pulse-dot 1s ease infinite'
                : 'none',
            }}
          />
          WS {wsLabel}
        </span>
        <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-disabled)' }}>
          v0.1.0
        </span>
      </div>

      {/* 深 / 浅主题切换 */}
      <div
        style={{
          padding: '8px 12px 14px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <button
          onClick={toggleTheme}
          aria-label={isLight ? '切换到深色主题' : '切换到浅色主题'}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '8px 16px',
            borderRadius: 'var(--radius-sm)',
            border: '1px solid var(--border-base)',
            background: 'var(--bg-elev-3)',
            color: 'var(--text-secondary)',
            fontSize: 12,
            fontWeight: 500,
            cursor: 'pointer',
            transition: 'all var(--dur-fast) var(--ease-out)',
            minWidth: 140,
            justifyContent: 'center',
          }}
        >
          {isLight ? <Moon size={14} /> : <Sun size={14} />}
          {isLight ? '深色主题' : '浅色主题'}
        </button>
      </div>
    </aside>
  )
}