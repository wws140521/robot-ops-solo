import { useState, useEffect } from 'react'
import { useTenantStore, type Tenant } from '../stores/tenantStore'
import { useThemeStore } from '../stores/themeStore'
import { listTenants, createTenant, type TenantRecord } from '../lib/tenantStorage'
import { Sun, Moon, Plus, X } from 'lucide-react'

const PLAN_LABELS: Record<string, string> = {
  free: '免费版',
  pro: '专业版',
  enterprise: '企业版',
}

const PLAN_COLORS: Record<string, string> = {
  free: 'var(--text-tertiary)',
  pro: 'var(--primary)',
  enterprise: 'var(--accent)',
}

// TenantRecord → 前端 Tenant 适配
function recordToTenant(r: TenantRecord): Tenant {
  return {
    id: r.slug,
    name: r.name,
    primaryColor: r.primary_color,
    domain: `${r.slug}.robot-ops.io`,
  }
}

export function TenantsPage() {
  const { tenant: currentTenant, setTenant } = useTenantStore()
  const [tenants, setTenants] = useState<TenantRecord[]>([])
  const [loading, setLoading] = useState(true)
  const themeMode = useThemeStore((s) => s.mode)
  const toggleTheme = useThemeStore((s) => s.toggle)
  const isLight = themeMode === 'light'

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    listTenants().then((data) => {
      if (!cancelled) {
        setTenants(data)
        setLoading(false)
      }
    })
    return () => { cancelled = true }
  }, [])

  const handleSwitch = (t: Tenant) => {
    setTenant(t)
    document.documentElement.setAttribute('data-tenant', t.id)
    window.history.replaceState(null, '', `?tenant=${t.id}`)
  }

  const [showForm, setShowForm] = useState(false)
  const [formName, setFormName] = useState('')
  const [formColor, setFormColor] = useState('#00f0ff')
  const [formPlan, setFormPlan] = useState('pro')

  const handleCreate = async () => {
    if (!formName.trim()) return
    const slug = formName.trim().toLowerCase().replace(/[^a-z0-9]/g, '-')
    await createTenant({
      slug,
      name: formName.trim(),
      logo_url: null,
      primary_color: formColor,
      contact_name: null,
      contact_phone: null,
      plan: formPlan,
    })
    const data = await listTenants()
    setTenants(data)
    setFormName('')
    setFormColor('#00f0ff')
    setFormPlan('pro')
    setShowForm(false)
  }

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">
          <span className="page-title__accent">◆</span>
          租户管理
        </h1>
        <button
          className="btn btn-primary"
          onClick={() => setShowForm((v) => !v)}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
        >
          {showForm ? <X size={14} /> : <Plus size={14} />}
          {showForm ? '取消' : '新建租户'}
        </button>
      </div>

      {showForm && (
        <div
          className="card hud-corners"
          style={{
            marginBottom: 16,
            padding: 20,
            border: '1px solid var(--border-hover)',
            boxShadow: 'var(--glow-primary)',
          }}
        >
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr auto', gap: 12, alignItems: 'end' }}>
            <div>
              <label style={{ fontSize: 11, color: 'var(--text-tertiary)', display: 'block', marginBottom: 6, fontFamily: 'var(--font-mono)' }}>
                租户名称
              </label>
              <input
                className="input"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="如 老王机器人"
                style={{ width: '100%' }}
                autoFocus
                onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
              />
            </div>
            <div>
              <label style={{ fontSize: 11, color: 'var(--text-tertiary)', display: 'block', marginBottom: 6, fontFamily: 'var(--font-mono)' }}>
                品牌色
              </label>
              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                <input
                  type="color"
                  value={formColor}
                  onChange={(e) => setFormColor(e.target.value)}
                  style={{ width: 36, height: 32, border: '1px solid var(--border-base)', borderRadius: 4, background: 'transparent', cursor: 'pointer' }}
                />
                <input
                  className="input"
                  value={formColor}
                  onChange={(e) => setFormColor(e.target.value)}
                  style={{ flex: 1 }}
                />
              </div>
            </div>
            <div>
              <label style={{ fontSize: 11, color: 'var(--text-tertiary)', display: 'block', marginBottom: 6, fontFamily: 'var(--font-mono)' }}>
                套餐
              </label>
              <select
                value={formPlan}
                onChange={(e) => setFormPlan(e.target.value)}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--border-base)',
                  background: 'var(--bg-elev-2)',
                  color: 'var(--text-primary)',
                  fontSize: 13,
                }}
              >
                <option value="free">免费版</option>
                <option value="pro">专业版</option>
                <option value="enterprise">企业版</option>
              </select>
            </div>
            <button
              className="btn btn-primary"
              onClick={handleCreate}
              style={{ whiteSpace: 'nowrap' }}
            >
              创建
            </button>
          </div>
        </div>
      )}

      <div className="tenant-grid">
        {loading ? (
          // Loading skeleton
          [0, 1, 2].map((i) => (
            <div key={i} className="tenant-card" style={{ opacity: 0.5 }}>
              <div className="tenant-card__top-bar" style={{ height: 3, background: 'var(--border-base)' }} />
              <div className="tenant-card__body">
                <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
                  <div style={{ width: 48, height: 48, borderRadius: 12, background: 'var(--bg-elev-3)' }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ height: 16, borderRadius: 4, background: 'var(--bg-elev-3)', marginBottom: 6 }} />
                    <div style={{ height: 12, width: '60%', borderRadius: 4, background: 'var(--bg-elev-3)' }} />
                  </div>
                </div>
              </div>
            </div>
          ))
        ) : tenants.length === 0 ? (
          <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: 40, color: 'var(--text-tertiary)' }}>
            暂无租户数据
          </div>
        ) : (
          tenants.map((r) => {
            const t = recordToTenant(r)
            const isActive = currentTenant?.id === t.id
            return (
              <div
                key={r.slug}
                className={`tenant-card ${isActive ? 'tenant-card--active' : ''}`}
                onClick={() => handleSwitch(t)}
                data-tenant={r.slug}
                style={{
                  borderColor: isActive ? r.primary_color : undefined,
                  boxShadow: isActive
                    ? isLight
                      ? `0 0 0 2px ${r.primary_color}33, 0 8px 24px rgba(15,23,42,0.10)`
                      : `0 0 0 2px ${r.primary_color}44, 0 8px 24px rgba(0,0,0,0.4)`
                    : undefined,
                }}
              >
                <div
                  className="tenant-card__top-bar"
                  style={{ background: `linear-gradient(90deg, ${r.primary_color}, ${r.primary_color}00)` }}
                />

                <div className="tenant-card__body">
                  <div className="tenant-card__logo">
                    <span
                      className="tenant-card__logo-circle"
                      style={{
                        background: `linear-gradient(135deg, ${r.primary_color} 0%, ${r.primary_color}99 100%)`,
                        boxShadow: isLight
                          ? `0 4px 14px ${r.primary_color}33`
                          : `0 0 16px ${r.primary_color}66`,
                      }}
                    >
                      {r.name.charAt(0)}
                    </span>
                  </div>

                  <div className="tenant-card__info">
                    <div className="tenant-card__name">{r.name}</div>
                    <div className="tenant-card__domain">{t.domain}</div>
                  </div>

                  <div className="tenant-card__tags">
                    <span
                      className="tenant-card__tag"
                      style={{
                        color: PLAN_COLORS[r.plan] ?? 'var(--text-tertiary)',
                        borderColor: `${r.primary_color}44`,
                      }}
                    >
                      {PLAN_LABELS[r.plan] ?? r.plan}
                    </span>
                    <span
                      className="tenant-card__tag"
                      style={{
                        color: r.primary_color,
                        borderColor: `${r.primary_color}44`,
                      }}
                    >
                      {r.primary_color}
                    </span>
                    {isActive && (
                      <span
                        className="tenant-card__tag tenant-card__tag--active"
                        style={{
                          background: r.primary_color,
                          color: '#fff',
                          borderColor: r.primary_color,
                        }}
                      >
                        ● 当前
                      </span>
                    )}
                  </div>

                  {/* 联系人信息 */}
                  {r.contact_name && (
                    <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 4 }}>
                      {r.contact_name}{r.contact_phone ? ` · ${r.contact_phone}` : ''}
                    </div>
                  )}
                </div>

                <div className="tenant-card__scanline" />
              </div>
            )
          })
        )}
      </div>

      {/* 主题切换入口 */}
      <div className="card" style={{ marginBottom: 20, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
        <div>
          <div style={{ fontWeight: 600, fontSize: 15, color: 'var(--text-primary)', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 18 }}>{isLight ? '☀️' : '🌙'}</span>
            界面主题
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>
            当前: <b style={{ color: 'var(--primary)' }}>{isLight ? '浅色 Daylight Lab' : '深色 HUD'}</b> · 贴牌换肤与主题独立，可自由组合
          </div>
        </div>
        <button
          onClick={toggleTheme}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            padding: '8px 18px',
            borderRadius: 'var(--radius-sm)',
            border: '1px solid var(--border-base)',
            background: 'var(--bg-elev-3)',
            color: 'var(--text-secondary)',
            fontSize: 13,
            fontWeight: 600,
            cursor: 'pointer',
            transition: 'all var(--dur-fast) var(--ease-out)',
          }}
        >
          {isLight ? <Moon size={14} /> : <Sun size={14} />}
          切换到{isLight ? '深色' : '浅色'}主题
        </button>
      </div>

      <div className="card tenant-oem">
        <div className="tenant-oem__title">
          <span className="tenant-oem__icon">🏷️</span>
          贴牌说明
        </div>
        <div className="tenant-oem__grid">
          <div className="tenant-oem__item">
            <span className="tenant-oem__num">01</span>
            <div>
              <div className="tenant-oem__item-title">独立域名</div>
              <div className="tenant-oem__item-desc">每个租户绑定独立域名，自动加载对应品牌色/Logo</div>
            </div>
          </div>
          <div className="tenant-oem__item">
            <span className="tenant-oem__num">02</span>
            <div>
              <div className="tenant-oem__item-title">数据隔离</div>
              <div className="tenant-oem__item-desc">Supabase RLS 按 tenant_id 严格隔离所有数据</div>
            </div>
          </div>
          <div className="tenant-oem__item">
            <span className="tenant-oem__num">03</span>
            <div>
              <div className="tenant-oem__item-title">换肤零代码</div>
              <div className="tenant-oem__item-desc">CSS 变量 --primary 全局生效，切换租户即换肤</div>
            </div>
          </div>
          <div className="tenant-oem__item">
            <span className="tenant-oem__num">04</span>
            <div>
              <div className="tenant-oem__item-title">分组管理</div>
              <div className="tenant-oem__item-desc">机器人按租户分组，互不干扰，权限独立</div>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        .tenant-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
          gap: 20px;
          margin-bottom: 24px;
        }

        .tenant-card {
          position: relative;
          background: var(--bg-glass);
          backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px);
          border: 1px solid var(--border-base);
          border-radius: var(--radius-lg);
          overflow: hidden;
          cursor: pointer;
          transition: all var(--dur-base) var(--ease-out);
        }

        .tenant-card:hover {
          transform: translateY(-2px);
          border-color: var(--border-hover);
        }

        .tenant-card--active {
          border-width: 2px;
        }

        .tenant-card__top-bar {
          height: 3px;
          width: 100%;
        }

        .tenant-card__body {
          padding: 20px;
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .tenant-card__logo {
          display: flex;
          align-items: center;
          gap: 14px;
        }

        .tenant-card__logo-circle {
          width: 48px;
          height: 48px;
          border-radius: 12px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 22px;
          font-weight: 700;
          color: #fff;
        }

        .tenant-card__info {
          flex: 1;
          min-width: 0;
        }

        .tenant-card__name {
          font-size: 15px;
          font-weight: 600;
          color: var(--text-primary);
        }

        .tenant-card__domain {
          font-family: var(--font-mono);
          font-size: 12px;
          color: var(--text-tertiary);
          margin-top: 2px;
        }

        .tenant-card__tags {
          display: flex;
          gap: 6px;
          flex-wrap: wrap;
        }

        .tenant-card__tag {
          font-family: var(--font-mono);
          font-size: 11px;
          padding: 2px 8px;
          border-radius: 4px;
          border: 1px solid;
          background: var(--bg-elev-2);
        }

        .tenant-card__tag--active {
          font-weight: 600;
          animation: tenant-pulse 2s ease infinite;
        }

        @keyframes tenant-pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.7; }
        }

        .tenant-card__scanline {
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          height: 1px;
          background: linear-gradient(90deg, transparent, var(--primary), transparent);
          opacity: 0;
          transition: opacity var(--dur-fast);
        }

        .tenant-card:hover .tenant-card__scanline {
          opacity: 0.6;
        }

        .tenant-oem {
          margin-top: 20px;
        }

        .tenant-oem__title {
          display: flex;
          align-items: center;
          gap: 8px;
          font-weight: 600;
          font-size: 15px;
          margin-bottom: 16px;
          color: var(--text-primary);
        }

        .tenant-oem__icon {
          font-size: 18px;
        }

        .tenant-oem__grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
          gap: 16px;
        }

        .tenant-oem__item {
          display: flex;
          gap: 12px;
          padding: 14px;
          border-radius: var(--radius-md);
          background: var(--bg-elev-1);
          border: 1px solid var(--border-subtle);
          transition: all var(--dur-fast) var(--ease-out);
        }

        .tenant-oem__item:hover {
          border-color: var(--primary-dim);
          background: var(--bg-elev-2);
        }

        .tenant-oem__num {
          font-family: var(--font-mono);
          font-size: 14px;
          font-weight: 700;
          color: var(--primary);
          opacity: 0.6;
          min-width: 28px;
        }

        .tenant-oem__item-title {
          font-size: 13px;
          font-weight: 600;
          color: var(--text-primary);
          margin-bottom: 2px;
        }

        .tenant-oem__item-desc {
          font-size: 12px;
          color: var(--text-tertiary);
          line-height: 1.5;
        }

        .page-title__accent {
          color: var(--primary);
          text-shadow: 0 0 12px var(--primary-glow);
        }
      `}</style>
    </div>
  )
}