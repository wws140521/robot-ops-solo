# Robot-Ops-Solo UI 科技感优化完整方案

> 版本：v1.0 | 适用版本：robot-ops-solo 当前 MVP
> 目标：将现有"后台管理风格"升级为**深色科技感数据可视化中台**，对标 Linear / Vercel / Raycast 视觉语言
> 整体风格定位：**Fluent Glass（毛玻璃框架）+ HUD（数据展示层）+ Cyberpunk 微光（3D 大屏）** 三合一

---

## 目录

1. [设计语言总纲](#一设计语言总纲)
2. [全局样式改造（globals.css 完整版）](#二全局样式改造globalscss-完整版)
3. [Tailwind 配置（tailwind.config.js）](#三tailwind-配置)
4. [Sidebar 侧边导航优化](#四sidebar-侧边导航优化)
5. [Dashboard 仪表盘优化](#五dashboard-仪表盘优化)
6. [RobotsPage 机器人管理页优化](#六robotspage-机器人管理页优化)
7. [TwinPage 数字孪生页优化](#七twinpage-数字孪生页优化)
8. [SopPage SOP 编排页优化](#八soppage-sop-编排页优化)
9. [AlertsPage 告警中心优化](#九alertspage-告警中心优化)
10. [TenantsPage 租户管理页优化](#十tenantspage-租户管理页优化)
11. [RobotStatusCard 组件升级](#十一robotstatuscard-组件升级)
12. [BatteryGauge 电池仪表升级](#十二batterygauge-电池仪表升级)
13. [AlertItem / AlertCard 升级](#十三alertitem--alertcard-升级)
14. [SOP 节点视觉升级（5 类节点）](#十四sop-节点视觉升级)
15. [数字孪生 3D 场景氛围升级](#十五数字孪生-3d-场景氛围升级)
16. [SpeakBubble 播报气泡升级](#十六speakbubble-播报气泡升级)
17. [Login 登录页（新增）](#十七login-登录页新增)
18. [动画规范与动效库](#十八动画规范与动效库)
19. [字体与图标方案](#十九字体与图标方案)
20. [依赖安装清单](#二十依赖安装清单)
21. [分步实施顺序](#二十一分步实施顺序)
22. [Prompt 模板（喂给 AI 用）](#二十二prompt-模板喂给-ai-用)
23. [避坑指南](#二十三避坑指南)

---

## 一、设计语言总纲

### 1.1 设计原则

| 原则 | 说明 |
|------|------|
| **信息密度优先** | 科技感 ≠ 花哨，核心是让数据一眼可读 |
| **克制的光效** | 发光只在 hover/选中/告警时触发，默认状态低饱和度 |
| **等宽字体承载数字** | 所有状态码、坐标、电量用 JetBrains Mono，强化"数据感" |
| **统一间距节奏** | 间距遵循 4px 基准（4/8/12/16/24/32），不随意取值 |
| **暗色为底、亮色为信号** | 背景深、文字灰白，只有"告警/在线/选中"用饱和色 |

### 1.2 色板（CSS 变量）

```css
:root {
  /* ── 背景层级（从深到浅）── */
  --bg-base:      #0a0e1a;   /* 页面最底层 */
  --bg-elev-1:    #0f1424;   /* Sidebar */
  --bg-elev-2:    #131a2e;   /* Card 底 */
  --bg-elev-3:    #182140;   /* Hover/弹出层 */
  --bg-glass:     rgba(19, 26, 46, 0.65);  /* 毛玻璃 */

  /* ── 边框 ── */
  --border-subtle: rgba(255,255,255,0.06);
  --border-base:   rgba(255,255,255,0.10);
  --border-hover:  rgba(0, 240, 255, 0.30);
  --border-focus:  rgba(0, 240, 255, 0.60);

  /* ── 文字 ── */
  --text-primary:   #e2e8f0;
  --text-secondary: #94a3b8;
  --text-tertiary:  #64748b;
  --text-disabled:  #475569;

  /* ── 品牌色 ── */
  --primary:        #00f0ff;   /* 青蓝霓虹（默认） */
  --primary-dim:    rgba(0, 240, 255, 0.15);
  --primary-glow:   rgba(0, 240, 255, 0.45);
  --accent:         #7b61ff;   /* 紫 */
  --accent-dim:     rgba(123, 97, 255, 0.15);

  /* ── 状态色 ── */
  --status-online:   #00e676;   /* 在线/正常 */
  --status-moving:   #2196f3;   /* 移动中 */
  --status-working:  #ff9800;   /* 工作中 */
  --status-error:    #ff3d71;   /* 故障 */
  --status-charging: #ab47bc;   /* 充电中 */
  --status-offline:  #546e7a;   /* 离线 */

  /* ── 告警级别 ── */
  --alert-info:     #3b82f6;
  --alert-warn:     #f59e0b;
  --alert-error:    #ef4444;

  /* ── 阴影/发光 ── */
  --glow-primary:   0 0 12px rgba(0, 240, 255, 0.35);
  --glow-primary-lg:0 0 24px rgba(0, 240, 255, 0.25);
  --glow-error:     0 0 12px rgba(239, 68, 68, 0.40);
  --shadow-card:    0 2px 8px rgba(0, 0, 0, 0.30);
  --shadow-pop:     0 8px 24px rgba(0, 0, 0, 0.45);

  /* ── 圆角 ── */
  --radius-sm: 6px;
  --radius-md: 10px;
  --radius-lg: 14px;
  --radius-xl: 20px;

  /* ── 字体 ── */
  --font-sans: 'Inter', 'PingFang SC', 'Microsoft YaHei', sans-serif;
  --font-mono: 'JetBrains Mono', 'Fira Code', 'Consolas', monospace;

  /* ── 动效 ── */
  --ease-out: cubic-bezier(0.16, 1, 0.3, 1);
  --ease-spring: cubic-bezier(0.34, 1.56, 0.64, 1);
  --dur-fast: 150ms;
  --dur-base: 250ms;
  --dur-slow: 400ms;
}
```

### 1.3 贴牌换肤（覆盖 CSS 变量）

```css
/* 老王机器人运营中心 */
[data-tenant="laowang"] {
  --primary: #ff6b35;
  --primary-dim: rgba(255, 107, 53, 0.15);
  --primary-glow: rgba(255, 107, 53, 0.45);
  --glow-primary: 0 0 12px rgba(255, 107, 53, 0.35);
}

/* 蜀大侠火锅 */
[data-tenant="hotpot01"] {
  --primary: #ef4444;
  --primary-dim: rgba(239, 68, 68, 0.15);
  --primary-glow: rgba(239, 68, 68, 0.45);
  --glow-primary: 0 0 12px rgba(239, 68, 68, 0.35);
}

/* 药房机器人 */
[data-tenant="pharma01"] {
  --primary: #22c55e;
  --primary-dim: rgba(34, 197, 94, 0.15);
  --primary-glow: rgba(34, 197, 94, 0.45);
  --glow-primary: 0 0 12px rgba(34, 197, 94, 0.35);
}
```

---

## 二、全局样式改造（globals.css 完整版）

> **替换** `apps/web-console/src/styles/globals.css` 为以下内容

```css
/* ============================================================
   Robot-Ops-Solo · 全局样式 · 深色科技感主题
   ============================================================ */

/* ─── Reset ─── */
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
html, body, #root { height: 100%; }
body {
  background: var(--bg-base);
  color: var(--text-primary);
  font-family: var(--font-sans);
  font-size: 14px;
  line-height: 1.5;
  -webkit-font-smoothing: antialiased;
  overflow: hidden;  /* 防止全局滚动，各区域自行管理 */
}

/* ─── 全局背景纹理（极淡网格 + 径向渐变）── */
body::before {
  content: '';
  position: fixed;
  inset: 0;
  background:
    radial-gradient(ellipse 80% 60% at 50% 0%, var(--primary-dim) 0%, transparent 60%),
    linear-gradient(rgba(255,255,255,0.015) 1px, transparent 1px),
    linear-gradient(90deg, rgba(255,255,255,0.015) 1px, transparent 1px);
  background-size: 100% 100%, 48px 48px, 48px 48px;
  pointer-events: none;
  z-index: 0;
}

/* ─── 链接 ─── */
a { color: var(--primary); text-decoration: none; }
a:hover { color: var(--primary); filter: brightness(1.15); }

/* ─── 按钮系统 ─── */
button { font-family: inherit; cursor: pointer; border: none; background: none; color: inherit; }

.btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 7px 16px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--border-base);
  background: var(--bg-elev-2);
  color: var(--text-secondary);
  font-size: 13px;
  font-weight: 500;
  transition: all var(--dur-fast) var(--ease-out);
}
.btn:hover {
  border-color: var(--border-hover);
  color: var(--text-primary);
  background: var(--bg-elev-3);
}
.btn-primary {
  background: linear-gradient(135deg, var(--primary) 0%, var(--accent) 100%);
  color: #0a0e1a;
  border-color: transparent;
  font-weight: 600;
  box-shadow: var(--glow-primary);
}
.btn-primary:hover {
  filter: brightness(1.1);
  box-shadow: var(--glow-primary-lg);
  transform: translateY(-1px);
}
.btn-danger {
  background: rgba(239, 68, 68, 0.10);
  color: var(--alert-error);
  border: 1px solid rgba(239, 68, 68, 0.25);
}
.btn-danger:hover { background: rgba(239, 68, 68, 0.18); }

/* ─── 卡片（毛玻璃基础）── */
.card {
  background: var(--bg-glass);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border: 1px solid var(--border-base);
  border-radius: var(--radius-md);
  padding: 18px;
  box-shadow: var(--shadow-card);
  position: relative;
  overflow: hidden;
}
/* 卡片顶部微光线 */
.card::before {
  content: '';
  position: absolute;
  top: 0; left: 0; right: 0;
  height: 1px;
  background: linear-gradient(90deg, transparent, var(--primary-dim), transparent);
}
.card:hover {
  border-color: var(--border-hover);
  box-shadow: var(--shadow-pop);
}

/* ─── 布局 ─── */
.app-layout {
  display: flex;
  height: 100vh;
  position: relative;
  z-index: 1;
}
.main-content {
  flex: 1;
  overflow: auto;
  padding: 24px 28px;
  scrollbar-width: thin;
  scrollbar-color: var(--border-base) transparent;
}
.main-content::-webkit-scrollbar { width: 6px; }
.main-content::-webkit-scrollbar-thumb { background: var(--border-base); border-radius: 3px; }

/* ─── 页面头 ─── */
.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
}
.page-title {
  font-size: 22px;
  font-weight: 700;
  letter-spacing: -0.02em;
  color: var(--text-primary);
  display: flex;
  align-items: center;
  gap: 10px;
}
.page-title::before {
  content: '';
  display: inline-block;
  width: 4px;
  height: 22px;
  background: linear-gradient(180deg, var(--primary), var(--accent));
  border-radius: 2px;
  box-shadow: var(--glow-primary);
}

/* ─── 网格 ─── */
.grid { display: grid; gap: 16px; }
.grid-2 { grid-template-columns: repeat(2, 1fr); }
.grid-3 { grid-template-columns: repeat(3, 1fr); }
.grid-4 { grid-template-columns: repeat(4, 1fr); }

/* ─── 状态点（HUD 脉冲）── */
.dot {
  display: inline-block;
  width: 8px; height: 8px;
  border-radius: 50%;
  position: relative;
}
.dot-online {
  background: var(--status-online);
  box-shadow: 0 0 6px var(--status-online);
  animation: pulse-dot 2s ease infinite;
}
.dot-offline {
  background: var(--status-offline);
}
.dot-error {
  background: var(--status-error);
  box-shadow: 0 0 6px var(--status-error);
  animation: pulse-dot 1s ease infinite;
}

@keyframes pulse-dot {
  0%, 100% { opacity: 1; transform: scale(1); }
  50%      { opacity: 0.5; transform: scale(0.85); }
}

/* ─── 角标框（HUD 风格装饰）── */
.hud-corners {
  position: relative;
}
.hud-corners::before,
.hud-corners::after {
  content: '';
  position: absolute;
  width: 12px; height: 12px;
  border-color: var(--primary);
  border-style: solid;
  border-width: 0;
}
.hud-corners::before {
  top: -1px; left: -1px;
  border-top-width: 2px; border-left-width: 2px;
}
.hud-corners::after {
  bottom: -1px; right: -1px;
  border-bottom-width: 2px; border-right-width: 2px;
}

/* ─── 扫描线动画 ─── */
@keyframes scanline {
  0%   { transform: translateY(-100%); }
  100% { transform: translateY(100vh); }
}
.scanline-overlay {
  position: fixed;
  top: 0; left: 0; right: 0;
  height: 2px;
  background: linear-gradient(90deg, transparent, var(--primary-glow), transparent);
  animation: scanline 8s linear infinite;
  pointer-events: none;
  z-index: 9998;
  opacity: 0.3;
}

/* ─── 数字跳动动画 ─── */
@keyframes countUp {
  from { opacity: 0; transform: translateY(8px); }
  to   { opacity: 1; transform: translateY(0); }
}
.count-anim {
  animation: countUp 0.4s var(--ease-out);
}

/* ─── 数据刷新闪烁 ─── */
@keyframes data-flash {
  0%   { color: var(--primary); text-shadow: var(--glow-primary); }
  100% { color: inherit; text-shadow: none; }
}
.data-flash {
  animation: data-flash 0.6s ease;
}

/* ─── 选中/聚焦状态 ─── */
:focus-visible {
  outline: 2px solid var(--primary);
  outline-offset: 2px;
}

/* ─── 输入框 ─── */
input, select, textarea {
  font-family: inherit;
  font-size: 13px;
  background: var(--bg-elev-2);
  border: 1px solid var(--border-base);
  border-radius: var(--radius-sm);
  padding: 7px 12px;
  color: var(--text-primary);
  transition: border-color var(--dur-fast);
}
input:focus, select:focus, textarea:focus {
  border-color: var(--primary);
  box-shadow: 0 0 0 3px var(--primary-dim);
  outline: none;
}

/* ─── 滚动条美化 ─── */
::-webkit-scrollbar { width: 6px; height: 6px; }
::-webkit-scrollbar-track { background: transparent; }
::-webkit-scrollbar-thumb { background: var(--border-base); border-radius: 3px; }
::-webkit-scrollbar-thumb:hover { background: var(--border-hover); }

/* ─── 减少动画偏好 ─── */
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
```

---

## 三、Tailwind 配置

> **修改** `apps/web-console/tailwind.config.js`（如没有则新建）

```js
/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './src/**/*.{ts,tsx}',
    '../../packages/**/src/**/*.{ts,tsx}',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        bg: {
          base: 'var(--bg-base)',
          'elev-1': 'var(--bg-elev-1)',
          'elev-2': 'var(--bg-elev-2)',
          'elev-3': 'var(--bg-elev-3)',
        },
        primary: {
          DEFAULT: 'var(--primary)',
          dim: 'var(--primary-dim)',
          glow: 'var(--primary-glow)',
        },
        accent: {
          DEFAULT: 'var(--accent)',
          dim: 'var(--accent-dim)',
        },
        text: {
          primary: 'var(--text-primary)',
          secondary: 'var(--text-secondary)',
          tertiary: 'var(--text-tertiary)',
        },
        status: {
          online: 'var(--status-online)',
          moving: 'var(--status-moving)',
          working: 'var(--status-working)',
          error: 'var(--status-error)',
          charging: 'var(--status-charging)',
          offline: 'var(--status-offline)',
        },
      },
      fontFamily: {
        sans: ['var(--font-sans)'],
        mono: ['var(--font-mono)'],
      },
      borderRadius: {
        sm: 'var(--radius-sm)',
        md: 'var(--radius-md)',
        lg: 'var(--radius-lg)',
      },
      boxShadow: {
        'glow-primary': 'var(--glow-primary)',
        'glow-primary-lg': 'var(--glow-primary-lg)',
        'glow-error': 'var(--glow-error)',
        'card': 'var(--shadow-card)',
        'pop': 'var(--shadow-pop)',
      },
      animation: {
        'pulse-dot': 'pulse-dot 2s ease infinite',
        'count-up': 'countUp 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
        'data-flash': 'data-flash 0.6s ease',
        'scanline': 'scanline 8s linear infinite',
        'fade-in-up': 'fadeInUp 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
        'slide-in-right': 'slideInRight 0.35s cubic-bezier(0.16, 1, 0.3, 1)',
      },
      keyframes: {
        fadeInUp: {
          '0%': { opacity: '0', transform: 'translateY(12px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        slideInRight: {
          '0%': { opacity: '0', transform: 'translateX(20px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
      },
    },
  },
  plugins: [],
}
```

---

## 四、Sidebar 侧边导航优化

> **替换** `apps/web-console/src/components/layout/Sidebar.tsx`

### 设计要点
- 更窄（200px），半透明毛玻璃
- Logo 区域加品牌色发光
- 导航项用 HUD 角标风格，选中时左侧光条 + 背景渐变
- 底部版本号带"信号强度"动画

```tsx
import { NavLink } from 'react-router-dom'
import { TenantLogo } from 'ui-kit'
import { useTenantStore } from '../../stores/tenantStore'

const navItems = [
  { to: '/',        label: '仪表盘',     icon: '◎',  end: true  },
  { to: '/robots',  label: '机器人',    icon: '◉',  end: false },
  { to: '/sop',     label: 'SOP 编排', icon: '⊞',  end: false },
  { to: '/twin',    label: '数字孪生',  icon: '◇',  end: false },
  { to: '/alerts',  label: '告警中心',  icon: '⚑',  end: false },
  { to: '/tenants', label: '租户管理',  icon: '▣',  end: false },
]

export function Sidebar() {
  const { tenant } = useTenantStore()

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
      {/* Logo 区 */}
      <div
        style={{
          padding: '24px 20px 20px',
          borderBottom: '1px solid var(--border-subtle)',
          position: 'relative',
        }}
      >
        {/* 装饰线 */}
        <div
          style={{
            position: 'absolute',
            bottom: -1, left: 20, right: 20,
            height: 1,
            background: 'linear-gradient(90deg, transparent, var(--primary), transparent)',
          }}
        />
        {tenant && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div
              style={{
                width: 36, height: 36,
                borderRadius: 10,
                background: 'linear-gradient(135deg, var(--primary), var(--accent))',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: '#0a0e1a', fontWeight: 800, fontSize: 16,
                boxShadow: 'var(--glow-primary)',
              }}
            >
              {tenant.name.charAt(0)}
            </div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', lineHeight: 1.3 }}>
                {tenant.name}
              </div>
              <div style={{ fontSize: 10, color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)' }}>
                CONSOLE v0.2
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 导航 */}
      <nav style={{ flex: 1, padding: '12px 10px', display: 'flex', flexDirection: 'column', gap: 2 }}>
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) => `sidebar-nav-item ${isActive ? 'active' : ''}`}
            style={({ isActive }) => ({
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              padding: '10px 14px',
              borderRadius: 'var(--radius-sm)',
              fontSize: 13,
              fontWeight: 500,
              color: isActive ? 'var(--primary)' : 'var(--text-secondary)',
              background: isActive
                ? 'linear-gradient(90deg, var(--primary-dim), transparent)'
                : 'transparent',
              borderLeft: `3px solid ${isActive ? 'var(--primary)' : 'transparent'}`,
              transition: 'all 0.2s var(--ease-out)',
              position: 'relative',
            })}
          >
            <span style={{ fontSize: 16, width: 20, textAlign: 'center', opacity: 0.9 }}>
              {item.icon}
            </span>
            <span>{item.label}</span>
            {/* 选中时的右侧角标 */}
            {({ isActive }) => isActive && (
              <span
                style={{
                  position: 'absolute',
                  right: 10,
                  width: 6, height: 6,
                  borderRadius: '50%',
                  background: 'var(--primary)',
                  boxShadow: 'var(--glow-primary)',
                  animation: 'pulse-dot 2s ease infinite',
                }}
              />
            )}
          </NavLink>
        ))}
      </nav>

      {/* 底部状态 */}
      <div
        style={{
          padding: '14px 20px',
          borderTop: '1px solid var(--border-subtle)',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
        }}
      >
        <div
          style={{
            width: 8, height: 8,
            borderRadius: '50%',
            background: 'var(--status-online)',
            boxShadow: '0 0 6px var(--status-online)',
            animation: 'pulse-dot 2s ease infinite',
          }}
        />
        <span style={{ fontSize: 11, color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)' }}>
          WS CONNECTED
        </span>
      </div>
    </aside>
  )
}
```

### 配套 CSS（追加到 globals.css）

```css
/* Sidebar 导航项 hover */
.sidebar-nav-item:hover {
  color: var(--text-primary) !important;
  background: rgba(255,255,255,0.04) !important;
}

/* 导航项右侧角标（active 时） */
.sidebar-nav-item.active::after {
  content: '';
  position: absolute;
  right: 10px;
  width: 6px; height: 6px;
  border-radius: 50%;
  background: var(--primary);
  box-shadow: var(--glow-primary);
  animation: pulse-dot 2s ease infinite;
}
```

---

## 五、Dashboard 仪表盘优化

> **替换** `apps/web-console/src/routes/Dashboard.tsx`

### 设计要点
- 顶部 4 个 KPI 卡片（在线数/平均电量/活跃告警/今日任务），每个卡片有**迷你趋势图**
- 中间左侧：机器人状态列表（HUD 卡片）
- 中间右侧：告警流（带等级色条 + 实时滚动）
- 底部：活动轨迹地图缩略图

```tsx
import { useRobotStore } from '../stores/robotStore'
import { RobotStatusCard, BatteryGauge, AlertItem } from 'ui-kit'

export function Dashboard() {
  const { robots, alerts, onlineCount, clearAlert } = useRobotStore()
  const robotList = Object.values(robots)
  const totalPower = robotList.reduce((sum, r) => sum + r.batteryPct, 0)
  const avgPower = robotList.length ? Math.round(totalPower / robotList.length) : 0

  return (
    <div style={{ animation: 'fadeInUp 0.4s var(--ease-out)' }}>
      {/* 页面头 */}
      <div className="page-header">
        <h1 className="page-title">运维总览</h1>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn">📤 导出报告</button>
          <button className="btn btn-primary">＋ 添加机器人</button>
        </div>
      </div>

      {/* KPI 卡片行 */}
      <div className="grid grid-4" style={{ marginBottom: 20 }}>
        <KpiCard
          label="在线机器人"
          value={onlineCount}
          total={robotList.length}
          color="var(--status-online)"
          trend="+2"
          trendUp
          icon="◉"
        />
        <KpiCard
          label="平均电量"
          value={`${avgPower}%`}
          color="var(--primary)"
          trend={avgPower > 50 ? '+5%' : '-3%'}
          trendUp={avgPower > 50}
          icon="🔋"
          gauge={<BatteryGauge pct={avgPower} size={52} />}
        />
        <KpiCard
          label="活跃告警"
          value={alerts.length}
          color="var(--alert-error)"
          trend={alerts.length > 0 ? '需处理' : '正常'}
          trendUp={false}
          icon="⚑"
          blink={alerts.length > 0}
        />
        <KpiCard
          label="今日任务"
          value={12}
          color="var(--accent)"
          trend="+3"
          trendUp
          icon="▶"
        />
      </div>

      {/* 主体双栏 */}
      <div className="grid grid-2">
        {/* 左：机器人状态列表 */}
        <div className="card hud-corners" style={{ padding: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
              ◇ 机器人实时状态
            </span>
            <span style={{ fontSize: 11, color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)' }}>
              LIVE · {robotList.length} UNITS
            </span>
          </div>
          {robotList.length === 0 && (
            <div style={{ color: 'var(--text-tertiary)', fontSize: 13, textAlign: 'center', padding: 32 }}>
              ── 暂无机器人数据 ──<br />
              <span style={{ fontSize: 12 }}>请检查 WS 连接或添加机器人</span>
            </div>
          )}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {robotList.map((r) => (
              <RobotStatusCard key={r.robotId} state={r} />
            ))}
          </div>
        </div>

        {/* 右：告警流 */}
        <div className="card hud-corners" style={{ padding: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
              ⚑ 实时告警流
            </span>
            {alerts.length > 0 && (
              <span
                style={{
                  fontSize: 11, padding: '2px 8px',
                  background: 'rgba(239,68,68,0.15)', color: 'var(--alert-error)',
                  borderRadius: 10, fontWeight: 600,
                }}
              >
                {alerts.length} 条未处理
              </span>
            )}
          </div>
          {alerts.length === 0 ? (
            <div style={{ color: 'var(--status-online)', fontSize: 13, textAlign: 'center', padding: 32 }}>
              ✅ ALL SYSTEMS NOMINAL
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 400, overflow: 'auto' }}>
              {alerts.slice(0, 10).map((a, i) => (
                <AlertItem key={i} alert={a} onDismiss={clearAlert} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

/* ─── KPI 卡片子组件 ─── */
function KpiCard({
  label, value, total, color, trend, trendUp, icon, gauge, blink,
}: {
  label: string; value: number | string; total?: number;
  color: string; trend: string; trendUp: boolean;
  icon: string; gauge?: React.ReactNode; blink?: boolean;
}) {
  return (
    <div
      className="card hud-corners"
      style={{
        padding: 18,
        position: 'relative',
        animation: blink ? 'pulse-dot 2s ease infinite' : undefined,
      }}
    >
      {/* 顶部：标签 + 趋势 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: 11, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          {label}
        </span>
        <span
          style={{
            fontSize: 11, fontWeight: 600,
            color: trendUp ? 'var(--status-online)' : 'var(--alert-error)',
            fontFamily: 'var(--font-mono)',
          }}
        >
          {trendUp ? '↑' : '↓'} {trend}
        </span>
      </div>

      {/* 主体：值 + 图标/仪表 */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 10 }}>
        <div>
          <span
            style={{
              fontSize: 28, fontWeight: 700,
              color, fontFamily: 'var(--font-mono)',
              textShadow: `0 0 12px ${color}33`,
            }}
          >
            {value}
          </span>
          {total !== undefined && (
            <span style={{ fontSize: 14, color: 'var(--text-tertiary)', marginLeft: 4, fontFamily: 'var(--font-mono)' }}>
              / {total}
            </span>
          )}
        </div>
        {gauge ?? (
          <span style={{ fontSize: 24, opacity: 0.6 }}>{icon}</span>
        )}
      </div>

      {/* 底部微光线 */}
      <div
        style={{
          position: 'absolute', bottom: 0, left: 18, right: 18, height: 2,
          background: `linear-gradient(90deg, transparent, ${color}66, transparent)`,
          borderRadius: 1,
        }}
      />
    </div>
  )
}
```

---

## 六、RobotsPage 机器人管理页优化

> **替换** `apps/web-console/src/routes/RobotsPage.tsx`

### 设计要点
- 三栏布局：左=机器人列表（带筛选/搜索）、中=3D 视图（全屏沉浸）、右=详情面板（HUD 风格）
- 列表项带**状态色条 + 脉冲动画**
- 详情面板显示：品牌型号、坐标（等宽字体实时刷新）、快捷操作按钮组

```tsx
import { useParams } from 'react-router-dom'
import { useRobotStore } from '../stores/robotStore'
import { RobotStatusCard, AlertItem } from 'ui-kit'
import { RobotViewer } from 'digital-twin'
import { useState } from 'react'

export function RobotsPage() {
  const { id } = useParams()
  const { robots, alerts, clearAlert } = useRobotStore()
  const robotList = Object.values(robots)
  const selected = id ? robots[id] : robotList[0]
  const [filter, setFilter] = useState('all')  // all/online/error

  const filtered = robotList.filter(r => {
    if (filter === 'online') return r.online
    if (filter === 'error') return r.status === 'error'
    return true
  })

  return (
    <div style={{ animation: 'fadeInUp 0.4s var(--ease-out)' }}>
      {/* 页面头 */}
      <div className="page-header">
        <h1 className="page-title">机器人管理</h1>
        <div style={{ display: 'flex', gap: 8 }}>
          {['all', 'online', 'error'].map(f => (
            <button
              key={f}
              className="btn"
              onClick={() => setFilter(f)}
              style={{
                background: filter === f ? 'var(--primary-dim)' : 'var(--bg-elev-2)',
                color: filter === f ? 'var(--primary)' : 'var(--text-secondary)',
                borderColor: filter === f ? 'var(--primary)' : 'var(--border-base)',
              }}
            >
              {f === 'all' ? '全部' : f === 'online' ? '在线' : '故障'}
            </button>
          ))}
        </div>
      </div>

      {/* 三栏 */}
      <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr 280px', gap: 16, height: 'calc(100vh - 140px)' }}>
        {/* 左：列表 */}
        <div className="card" style={{ overflow: 'auto', padding: 14 }}>
          <div style={{ fontSize: 11, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 10 }}>
            ◇ 设备列表 ({filtered.length})
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {filtered.map((r) => (
              <RobotStatusCard key={r.robotId} state={r} compact />
            ))}
          </div>
        </div>

        {/* 中：3D 视图 */}
        <div
          className="card hud-corners"
          style={{ padding: 0, overflow: 'hidden', position: 'relative' }}
        >
          {selected ? (
            <RobotViewer robotId={selected.robotId} showMap />
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-tertiary)' }}>
              ── 请选择一台机器人 ──
            </div>
          )}
          {/* 悬浮 HUD 信息层 */}
          {selected && (
            <div style={{ position: 'absolute', top: 14, left: 14, right: 14, display: 'flex', justifyContent: 'space-between', pointerEvents: 'none' }}>
              <div style={{ background: 'rgba(10,14,26,0.8)', backdropFilter: 'blur(8px)', padding: '6px 12px', borderRadius: 6, border: '1px solid var(--border-base)' }}>
                <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>UNIT </span>
                <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--primary)', fontFamily: 'var(--font-mono)' }}>
                  {selected.robotId}
                </span>
              </div>
              <div style={{ background: 'rgba(10,14,26,0.8)', backdropFilter: 'blur(8px)', padding: '6px 12px', borderRadius: 6, border: '1px solid var(--border-base)' }}>
                <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>FPS </span>
                <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--status-online)', fontFamily: 'var(--font-mono)' }}>
                  60
                </span>
              </div>
            </div>
          )}
        </div>

        {/* 右：详情 + 操作 */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, overflow: 'auto' }}>
          {selected && (
            <>
              {/* 详情卡 */}
              <div className="card hud-corners" style={{ padding: 16 }}>
                <div style={{ fontSize: 11, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 10 }}>
                  ◇ 设备详情
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <DetailRow label="品牌型号" value={`${selected.brand} · ${selected.model}`} />
                  <DetailRow label="状态" value={selected.status} color={`var(--status-${selected.status})`} />
                  <DetailRow label="电量" value={`${selected.batteryPct}%`} color={selected.batteryPct < 20 ? 'var(--alert-error)' : 'var(--primary)'} />
                  <DetailRow label="坐标" value={`(${selected.position.x.toFixed(2)}, ${selected.position.y.toFixed(2)})`} mono />
                  <DetailRow label="朝向" value={`${selected.position.theta.toFixed(2)} rad`} mono />
                  <DetailRow label="电压" value={`${selected.voltage}V`} mono />
                  <DetailRow label="最后通信" value={new Date(selected.lastSeen).toLocaleTimeString()} mono />
                </div>
              </div>

              {/* 快捷操作 */}
              <div className="card" style={{ padding: 16 }}>
                <div style={{ fontSize: 11, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 10 }}>
                  ◇ 快捷操作
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                  {[
                    { label: '▶ 启动', color: 'var(--status-online)' },
                    { label: '⏹ 停止', color: 'var(--alert-warn)' },
                    { label: '🔋 回充', color: 'var(--status-charging)' },
                    { label: '🔄 重启', color: 'var(--primary)' },
                  ].map(btn => (
                    <button
                      key={btn.label}
                      className="btn"
                      style={{ justifyContent: 'center', borderColor: btn.color + '44', color: btn.color }}
                    >
                      {btn.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* 该机器人告警 */}
              <div className="card" style={{ padding: 16, flex: 1, overflow: 'auto' }}>
                <div style={{ fontSize: 11, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 10 }}>
                  ◇ 设备告警
                </div>
                {alerts.filter(a => a.robotId === selected.robotId).length === 0 ? (
                  <div style={{ color: 'var(--text-tertiary)', fontSize: 12 }}>── 无告警 ──</div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    {alerts.filter(a => a.robotId === selected.robotId).map((a, i) => (
                      <AlertItem key={i} alert={a} onDismiss={clearAlert} compact />
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

function DetailRow({ label, value, color, mono }: { label: string; value: string; color?: string; mono?: boolean }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>{label}</span>
      <span
        style={{
          fontSize: 12, fontWeight: 600,
          color: color ?? 'var(--text-primary)',
          fontFamily: mono ? 'var(--font-mono)' : 'inherit',
        }}
      >
        {value}
      </span>
    </div>
  )
}
```

---

## 七、TwinPage 数字孪生页优化

> **替换** `apps/web-console/src/routes/TwinPage.tsx`

### 设计要点
- 全屏 3D 沉浸（去掉多余卡片包裹）
- 四角 HUD 叠加层：左上=设备信息、右上=坐标/电量、左下=微型雷达、右下=状态机流程图
- 底部告警跑马灯
- 背景加粒子星空效果

```tsx
import { useParams } from 'react-router-dom'
import { useRobotStore } from '../stores/robotStore'
import { RobotViewer } from 'digital-twin'
import { useState } from 'react'

export function TwinPage() {
  const { id } = useParams()
  const { robots, alerts } = useRobotStore()
  const robotList = Object.values(robots)
  const selected = id ? robots[id] : robotList[0]
  const [showRadar, setShowRadar] = useState(true)

  // 模拟轨迹
  const mockTrajectory = Array.from({ length: 30 }, (_, i) => ({
    x: Math.cos(i * 0.4) * 3 + (selected?.position.x ?? 0),
    y: Math.sin(i * 0.4) * 3 + (selected?.position.y ?? 0),
  }))

  return (
    <div style={{ animation: 'fadeInUp 0.4s var(--ease-out)', height: 'calc(100vh - 100px)' }}>
      {/* 页面头（极简） */}
      <div className="page-header" style={{ marginBottom: 12 }}>
        <h1 className="page-title">数字孪生</h1>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <select
            className="btn"
            value={selected?.robotId ?? ''}
            onChange={(e) => window.location.assign(`/twin/${e.target.value}`)}
            style={{ minWidth: 160 }}
          >
            {robotList.map((r) => (
              <option key={r.robotId} value={r.robotId}>
                {r.robotId} ({r.brand})
              </option>
            ))}
          </select>
          <button className="btn" onClick={() => setShowRadar(!showRadar)}>
            {showRadar ? '◉ 雷达开' : '○ 雷达关'}
          </button>
        </div>
      </div>

      {/* 全屏 3D 容器 */}
      <div
        className="card hud-corners"
        style={{
          padding: 0,
          height: 'calc(100% - 60px)',
          overflow: 'hidden',
          position: 'relative',
          border: '1px solid var(--border-base)',
        }}
      >
        {selected ? (
          <RobotViewer robotId={selected.robotId} trajectory={mockTrajectory} showMap />
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-tertiary)' }}>
            ── 暂无机器人数据 ──
          </div>
        )}

        {/* ─── HUD 叠加层（pointer-events: none）─── */}
        {selected && (
          <>
            {/* 左上：设备身份 */}
            <div style={hudOverlay({ top: 16, left: 16 })}>
              <div style={{ fontSize: 10, color: 'var(--text-tertiary)', letterSpacing: '0.1em' }}>UNIT ID</div>
              <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--primary)', fontFamily: 'var(--font-mono)' }}>
                {selected.robotId}
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>
                {selected.brand} · {selected.model}
              </div>
            </div>

            {/* 右上：实时数据 */}
            <div style={hudOverlay({ top: 16, right: 16, textAlign: 'right' })}>
              <HudDataRow label="POS" value={`(${selected.position.x.toFixed(2)}, ${selected.position.y.toFixed(2)})`} />
              <HudDataRow label="BAT" value={`${selected.batteryPct}%`} color={selected.batteryPct < 20 ? 'var(--alert-error)' : 'var(--primary)'} />
              <HudDataRow label="YAW" value={`${selected.position.theta.toFixed(3)} rad`} />
              <HudDataRow label="VOL" value={`${selected.voltage}V`} />
            </div>

            {/* 左下：雷达扫描（CSS 动画） */}
            {showRadar && (
              <div style={hudOverlay({ bottom: 16, left: 16 })}>
                <RadarScan />
              </div>
            )}

            {/* 右下：状态机 */}
            <div style={hudOverlay({ bottom: 16, right: 16, textAlign: 'right' })}>
              <StateMachine current={selected.status} />
            </div>

            {/* 底部告警跑马灯 */}
            {alerts.length > 0 && (
              <div
                style={{
                  position: 'absolute', bottom: 0, left: 0, right: 0,
                  background: 'linear-gradient(90deg, transparent, rgba(239,68,68,0.85), transparent)',
                  color: '#fff', fontSize: 12, fontWeight: 600,
                  padding: '6px 0', textAlign: 'center',
                  animation: 'slide-in-right 0.3s var(--ease-out)',
                }}
              >
                ⚠ {alerts[0].robotId}: {alerts[0].message}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

/* ─── HUD 样式工具 ─── */
function hudOverlay(opts: { top?: number; bottom?: number; left?: number; right?: number; textAlign?: string }): React.CSSProperties {
  return {
    position: 'absolute',
    top: opts.top, bottom: opts.bottom,
    left: opts.left, right: opts.right,
    background: 'rgba(10, 14, 26, 0.75)',
    backdropFilter: 'blur(8px)',
    WebkitBackdropFilter: 'blur(8px)',
    border: '1px solid var(--border-base)',
    borderRadius: 'var(--radius-sm)',
    padding: '10px 14px',
    pointerEvents: 'none',
    textAlign: opts.textAlign as any,
    zIndex: 100,
  }
}

function HudDataRow({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', alignItems: 'center', marginBottom: 2 }}>
      <span style={{ fontSize: 11, color: color ?? 'var(--primary)', fontFamily: 'var(--font-mono)', fontWeight: 600 }}>
        {value}
      </span>
      <span style={{ fontSize: 9, color: 'var(--text-tertiary)', minWidth: 28 }}>{label}</span>
    </div>
  )
}

/* ─── 微型雷达（纯 CSS）─── */
function RadarScan() {
  return (
    <div
      style={{
        width: 100, height: 100,
        borderRadius: '50%',
        border: '1px solid var(--primary-dim)',
        position: 'relative',
        overflow: 'hidden',
        background: 'radial-gradient(circle, var(--primary-dim) 0%, transparent 70%)',
      }}
    >
      {/* 十字线 */}
      <div style={{ position: 'absolute', top: '50%', left: 0, right: 0, height: 1, background: 'var(--primary-dim)' }} />
      <div style={{ position: 'absolute', left: '50%', top: 0, bottom: 0, width: 1, background: 'var(--primary-dim)' }} />
      {/* 扫描扇形 */}
      <div
        style={{
          position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
          background: `conic-gradient(from 0deg, var(--primary-glow), transparent 60deg)`,
          animation: 'radar-spin 3s linear infinite',
          borderRadius: '50%',
        }}
      />
      {/* 中心点 */}
      <div
        style={{
          position: 'absolute', top: '50%', left: '50%',
          width: 4, height: 4, marginLeft: -2, marginTop: -2,
          borderRadius: '50%', background: 'var(--primary)',
          boxShadow: 'var(--glow-primary)',
        }}
      />
      {/* 目标点 */}
      <div
        style={{
          position: 'absolute', top: '30%', right: '25%',
          width: 3, height: 3,
          borderRadius: '50%', background: 'var(--alert-error)',
          boxShadow: '0 0 4px var(--alert-error)',
          animation: 'pulse-dot 1.5s ease infinite',
        }}
      />
      <style>{`
        @keyframes radar-spin {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  )
}

/* ─── 状态机流程图 ─── */
function StateMachine({ current }: { current: string }) {
  const states = ['idle', 'moving', 'working', 'charging']
  const colors: Record<string, string> = {
    idle: 'var(--status-online)',
    moving: 'var(--status-moving)',
    working: 'var(--status-working)',
    charging: 'var(--status-charging)',
  }
  return (
    <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
      {states.map((s, i) => (
        <div key={s} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <div
            style={{
              padding: '2px 8px',
              borderRadius: 3,
              fontSize: 10,
              fontFamily: 'var(--font-mono)',
              background: current === s ? colors[s] + '33' : 'transparent',
              border: `1px solid ${current === s ? colors[s] : 'var(--border-base)'}`,
              color: current === s ? colors[s] : 'var(--text-tertiary)',
              fontWeight: current === s ? 600 : 400,
              boxShadow: current === s ? `0 0 8px ${colors[s]}44` : 'none',
            }}
          >
            {s}
          </div>
          {i < states.length - 1 && (
            <span style={{ color: 'var(--text-tertiary)', fontSize: 10 }}>→</span>
          )}
        </div>
      ))}
    </div>
  )
}
```

---

## 八、SopPage SOP 编排页优化

> **替换** `apps/web-console/src/routes/SopPage.tsx`

### 设计要点
- 左：节点面板（毛玻璃悬浮 + 图标动画）
- 中：画布区域（深色网格背景 + 节点发光）
- 右：属性面板（选中节点时滑入）
- 顶部：操作栏（毛玻璃 + 主色调按钮）
- 底部：导出预览面板（可折叠）

```tsx
import { SopEditor, useSopStore, graphToPayload } from 'sop-editor'
import { useState } from 'react'

export function SopPage() {
  const { nodes, edges, reset } = useSopStore()
  const [exported, setExported] = useState('')
  const [showPreview, setShowPreview] = useState(false)

  const handleExport = () => {
    const graph = {
      id: 'sop-' + Date.now(),
      name: '火锅店晚市传菜',
      industry: 'hotpot',
      brand: 'unitree',
      model: 'g1',
      nodes, edges,
      version: 1,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }
    const payload = graphToPayload(graph)
    setExported(JSON.stringify(payload, null, 2))
    setShowPreview(true)
  }

  return (
    <div style={{ animation: 'fadeInUp 0.4s var(--ease-out)', height: 'calc(100vh - 100px)', display: 'flex', flexDirection: 'column' }}>
      {/* 操作栏 */}
      <div className="page-header" style={{ marginBottom: 12 }}>
        <h1 className="page-title">SOP 任务编排</h1>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn" onClick={reset}>🗑 清空画布</button>
          <button className="btn" onClick={() => setShowPreview(!showPreview)}>
            {showPreview ? '▾ 隐藏预览' : '▸ 显示预览'}
          </button>
          <button className="btn btn-primary" onClick={handleExport}>
            ⬇ 导出 JSON
          </button>
        </div>
      </div>

      {/* 画布区 */}
      <div
        className="card"
        style={{
          flex: 1,
          padding: 0,
          overflow: 'hidden',
          position: 'relative',
          minHeight: 400,
        }}
      >
        <SopEditor />
      </div>

      {/* 导出预览面板 */}
      {showPreview && exported && (
        <div
          className="card"
          style={{
            marginTop: 12,
            maxHeight: 200,
            overflow: 'auto',
            animation: 'slideInRight 0.3s var(--ease-out)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>
              ◇ 导出预览 ({nodes.length} 节点 / {edges.length} 连线)
            </span>
            <button className="btn" style={{ padding: '4px 10px', fontSize: 11 }} onClick={() => navigator.clipboard.writeText(exported)}>
              📋 复制
            </button>
          </div>
          <pre
            style={{
              background: 'var(--bg-base)',
              border: '1px solid var(--border-base)',
              padding: 12,
              borderRadius: 'var(--radius-sm)',
              fontSize: 11,
              fontFamily: 'var(--font-mono)',
              color: 'var(--text-secondary)',
              overflow: 'auto',
              maxHeight: 140,
            }}
          >
            {exported}
          </pre>
        </div>
      )}
    </div>
  )
}
```

---

## 九、SOP 节点视觉升级

> **替换** 5 个节点文件 + 新增节点样式 CSS

### 通用节点样式（追加到 globals.css）

```css
/* ─── SOP 节点通用 ─── */
.sop-node {
  position: relative;
  padding: 12px 16px;
  border-radius: var(--radius-md);
  background: var(--bg-glass);
  backdrop-filter: blur(8px);
  border: 1px solid var(--border-base);
  min-width: 130px;
  transition: all var(--dur-base) var(--ease-out);
  font-size: 12px;
}
.sop-node:hover {
  transform: scale(1.02);
  box-shadow: var(--shadow-pop);
}
.sop-node.selected {
  border-color: var(--primary);
  box-shadow: var(--glow-primary);
}
.sop-node .node-header {
  display: flex;
  align-items: center;
  gap: 6px;
  font-weight: 600;
  font-size: 12px;
  margin-bottom: 4px;
}
.sop-node .node-header .icon {
  font-size: 14px;
  width: 20px;
  text-align: center;
}
.sop-node .node-body {
  font-size: 11px;
  color: var(--text-tertiary);
  font-family: var(--font-mono);
}
/* 连接桩 */
.sop-node .react-flow__handle {
  width: 8px; height: 8px;
  border-radius: 50%;
  border: 2px solid var(--bg-elev-2);
}

/* 各类型节点配色 */
.sop-node.move    { border-left: 3px solid var(--status-moving); }
.sop-node.speak   { border-left: 3px solid var(--accent); }
.sop-node.wait    { border-left: 3px solid var(--status-working); }
.sop-node.loop    { border-left: 3px solid var(--status-charging); }
.sop-node.condition { border-left: 3px solid var(--alert-warn); }

/* 选中时各类型发光 */
.sop-node.move.selected      { box-shadow: 0 0 16px rgba(33,150,243,0.4); border-color: var(--status-moving); }
.sop-node.speak.selected     { box-shadow: 0 0 16px rgba(123,97,255,0.4); border-color: var(--accent); }
.sop-node.wait.selected      { box-shadow: 0 0 16px rgba(255,152,0,0.4); border-color: var(--status-working); }
.sop-node.loop.selected      { box-shadow: 0 0 16px rgba(171,71,188,0.4); border-color: var(--status-charging); }
.sop-node.condition.selected { box-shadow: 0 0 16px rgba(245,158,11,0.4); border-color: var(--alert-warn); }

/* React Flow 连线渐变 */
.react-flow__edge-path {
  stroke: var(--primary);
  stroke-width: 2;
  filter: drop-shadow(0 0 4px var(--primary-glow));
}
.react-flow__edge.selected .react-flow__edge-path {
  stroke: var(--accent);
  stroke-width: 3;
}

/* React Flow 背景网格（深色版） */
.react-flow__background {
  background: var(--bg-elev-1);
}
.react-flow__controls {
  background: var(--bg-glass);
  backdrop-filter: blur(8px);
  border: 1px solid var(--border-base);
  border-radius: var(--radius-sm);
  overflow: hidden;
}
.react-flow__controls-button {
  background: transparent;
  border-bottom: 1px solid var(--border-base);
  color: var(--text-secondary);
}
.react-flow__controls-button:hover {
  background: var(--bg-elev-3);
  color: var(--primary);
}
.react-flow__minimap {
  background: var(--bg-glass) !important;
  border: 1px solid var(--border-base);
  border-radius: var(--radius-sm);
}
```

### MoveNode.tsx

```tsx
import { Handle, Position, type NodeProps } from '@xyflow/react'
import type { MoveData } from '../schema/sop-schema'

export function MoveNode({ data, selected }: NodeProps) {
  const d = data as unknown as MoveData
  return (
    <div className={`sop-node move ${selected ? 'selected' : ''}`}>
      <Handle type="target" position={Position.Left} style={{ background: 'var(--status-moving)' }} />
      <div className="node-header">
        <span className="icon">➤</span>
        <span>MOVE</span>
      </div>
      <div className="node-body">
        ({d.x}, {d.y}){d.speed ? ` @${d.speed}m/s` : ''}
      </div>
      {d.label && <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginTop: 2 }}>{d.label}</div>}
      <Handle type="source" position={Position.Right} style={{ background: 'var(--status-moving)' }} />
    </div>
  )
}
```

### SpeakNode.tsx

```tsx
import { Handle, Position, type NodeProps } from '@xyflow/react'
import type { SpeakData } from '../schema/sop-schema'

export function SpeakNode({ data, selected }: NodeProps) {
  const d = data as unknown as SpeakData
  return (
    <div className={`sop-node speak ${selected ? 'selected' : ''}`}>
      <Handle type="target" position={Position.Left} style={{ background: 'var(--accent)' }} />
      <div className="node-header">
        <span className="icon">🔊</span>
        <span>SPEAK</span>
        {/* 声波动画 */}
        <span style={{ display: 'inline-flex', gap: 1, marginLeft: 'auto' }}>
          {[1,2,3].map(i => (
            <span
              key={i}
              style={{
                display: 'inline-block', width: 2, height: 8,
                background: 'var(--accent)', borderRadius: 1,
                animation: `speak-wave 0.8s ease infinite ${i * 0.15}s`,
              }}
            />
          ))}
        </span>
      </div>
      <div
        className="node-body"
        style={{
          maxWidth: 160, whiteSpace: 'nowrap',
          overflow: 'hidden', textOverflow: 'ellipsis',
        }}
      >
        {d.text || '(空话术)'}
      </div>
      <Handle type="source" position={Position.Right} style={{ background: 'var(--accent)' }} />
      <style>{`
        @keyframes speak-wave {
          0%, 100% { height: 4px; opacity: 0.5; }
          50%      { height: 12px; opacity: 1; }
        }
      `}</style>
    </div>
  )
}
```

### WaitNode.tsx

```tsx
import { Handle, Position, type NodeProps } from '@xyflow/react'
import type { WaitData } from '../schema/sop-schema'

export function WaitNode({ data, selected }: NodeProps) {
  const d = data as unknown as WaitData
  return (
    <div className={`sop-node wait ${selected ? 'selected' : ''}`}>
      <Handle type="target" position={Position.Left} style={{ background: 'var(--status-working)' }} />
      <div className="node-header">
        <span className="icon">⏱</span>
        <span>WAIT</span>
      </div>
      <div className="node-body" style={{ fontSize: 14, fontWeight: 600, color: 'var(--status-working)' }}>
        {d.seconds}s
      </div>
      <Handle type="source" position={Position.Right} style={{ background: 'var(--status-working)' }} />
    </div>
  )
}
```

### LoopNode.tsx

```tsx
import { Handle, Position, type NodeProps } from '@xyflow/react'
import type { LoopData } from '../schema/sop-schema'

export function LoopNode({ data, selected }: NodeProps) {
  const d = data as unknown as LoopData
  return (
    <div className={`sop-node loop ${selected ? 'selected' : ''}`}>
      <Handle type="target" position={Position.Left} style={{ background: 'var(--status-charging)' }} />
      <div className="node-header">
        <span className="icon">🔁</span>
        <span>LOOP</span>
      </div>
      <div className="node-body" style={{ fontSize: 14, fontWeight: 600, color: 'var(--status-charging)' }}>
        ×{d.count}
      </div>
      <Handle type="source" position={Position.Right} style={{ background: 'var(--status-charging)' }} />
    </div>
  )
}
```

### ConditionNode.tsx

```tsx
import { Handle, Position, type NodeProps } from '@xyflow/react'
import type { ConditionData } from '../schema/sop-schema'

export function ConditionNode({ data, selected }: NodeProps) {
  const d = data as unknown as ConditionData
  return (
    <div className={`sop-node condition ${selected ? 'selected' : ''}`}>
      <Handle type="target" position={Position.Left} style={{ background: 'var(--alert-warn)' }} />
      <div className="node-header">
        <span className="icon">◆</span>
        <span>IF</span>
      </div>
      <div className="node-body">
        {d.condition || '(条件未设置)'}
      </div>
      {/* 双出口 */}
      <Handle type="source" position={Position.Right} id="true" style={{ background: 'var(--status-online)', top: '35%' }} />
      <Handle type="source" position={Position.Right} id="false" style={{ background: 'var(--alert-error)', top: '65%' }} />
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6, fontSize: 10 }}>
        <span style={{ color: 'var(--status-online)' }}>T</span>
        <span style={{ color: 'var(--alert-error)' }}>F</span>
      </div>
    </div>
  )
}
```

---

## 十、AlertsPage 告警中心优化

> **替换** `apps/web-console/src/routes/AlertsPage.tsx` + `AlertsPage.css`

### 设计要点
- 顶部统计条（error/warn/info 三色计数）
- 告警卡片带**左侧等级色条 + 发光 + 脉冲动画**
- 支持按等级筛选 + 搜索
- 已读/未读视觉区分明显

```tsx
import { useAlertStore } from '../lib/wsHub'
import { useState, useMemo } from 'react'
import './AlertsPage.css'

export function AlertsPage() {
  const alerts = useAlertStore((s) => s.alerts)
  const unreadCount = useAlertStore((s) => s.unreadCount)
  const markRead = useAlertStore((s) => s.markRead)
  const markAllRead = useAlertStore((s) => s.markAllRead)
  const clear = useAlertStore((s) => s.clear)
  const [filter, setFilter] = useState<'all' | 'error' | 'warn' | 'info'>('all')
  const [search, setSearch] = useState('')

  const filtered = useMemo(() => {
    return alerts.filter(a => {
      if (filter !== 'all' && a.level !== filter) return false
      if (search && !a.message.toLowerCase().includes(search.toLowerCase())) return false
      return true
    })
  }, [alerts, filter, search])

  const counts = {
    all: alerts.length,
    error: alerts.filter(a => a.level === 'error').length,
    warn: alerts.filter(a => a.level === 'warn').length,
    info: alerts.filter(a => a.level === 'info').length,
  }

  return (
    <div className="alerts-page" style={{ animation: 'fadeInUp 0.4s var(--ease-out)' }}>
      {/* 头部 */}
      <div className="alerts-header">
        <div>
          <h1 style={{
            fontSize: 22, fontWeight: 700, color: 'var(--text-primary)',
            display: 'flex', alignItems: 'center', gap: 10,
          }}>
            <span style={{ color: 'var(--alert-error)' }}>⚑</span>
            告警 & 播报中心
          </h1>
          <p className="subtitle">
            {unreadCount > 0 ? (
              <span style={{ background: 'rgba(239,68,68,0.15)', color: 'var(--alert-error)', padding: '2px 10px', borderRadius: 10, fontSize: 12, fontWeight: 600 }}>
                {unreadCount} 条未读
              </span>
            ) : (
              <span style={{ color: 'var(--status-online)', fontSize: 13 }}>✅ 全部已读</span>
            )}
          </p>
        </div>
        <div className="header-actions">
          <button className="btn" onClick={markAllRead}>✓ 全部已读</button>
          <button className="btn btn-danger" onClick={clear}>🗑 清空</button>
        </div>
      </div>

      {/* 统计条 + 筛选 + 搜索 */}
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 20, flexWrap: 'wrap' }}>
        {[
          { key: 'all', label: '全部', count: counts.all, color: 'var(--text-secondary)' },
          { key: 'error', label: '错误', count: counts.error, color: 'var(--alert-error)' },
          { key: 'warn', label: '警告', count: counts.warn, color: 'var(--alert-warn)' },
          { key: 'info', label: '信息', count: counts.info, color: 'var(--alert-info)' },
        ].map(f => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key as any)}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '6px 14px', borderRadius: 'var(--radius-sm)',
              background: filter === f.key ? `${f.color}15` : 'var(--bg-elev-2)',
              border: `1px solid ${filter === f.key ? f.color : 'var(--border-base)'}`,
              color: filter === f.key ? f.color : 'var(--text-secondary)',
              fontSize: 12, fontWeight: 500, cursor: 'pointer',
            }}
          >
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: f.color, boxShadow: `0 0 4px ${f.color}` }} />
            {f.label}
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11 }}>{f.count}</span>
          </button>
        ))}
        <input
          placeholder="🔍 搜索告警内容..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ flex: 1, minWidth: 200, maxWidth: 300 }}
        />
      </div>

      {/* 列表 */}
      <div className="alerts-list">
        {filtered.length === 0 && (
          <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-tertiary)' }}>
            <span style={{ fontSize: 40, display: 'block', marginBottom: 12 }}>🔕</span>
            <p>无匹配告警记录</p>
          </div>
        )}
        {filtered.map((alert) => (
          <div
            key={alert.id}
            className={`alert-card alert-${alert.level} ${alert.read ? 'read' : 'unread'}`}
            onClick={() => !alert.read && markRead(alert.id)}
          >
            {/* 左侧等级色条 */}
            <div className={`alert-level-bar alert-level-${alert.level}`} />
            {/* 图标 */}
            <div className="alert-icon">
              {alert.level === 'error' ? '🚨' : alert.level === 'warn' ? '⚠' : '🔊'}
            </div>
            {/* 主体 */}
            <div className="alert-body">
              <div className="alert-message">{alert.message}</div>
              <div className="alert-meta">
                <span className="alert-code">{alert.code}</span>
                <span className="alert-robot">🤖 {alert.robotId}</span>
                <span className="alert-time">
                  {new Date(alert.timestamp).toLocaleString('zh-CN', { hour12: false })}
                </span>
              </div>
            </div>
            {/* 未读指示 */}
            {!alert.read && <div className="unread-dot" />}
          </div>
        ))}
      </div>
    </div>
  )
}
```

### AlertsPage.css（替换）

```css
/* AlertsPage.css · 科技感告警中心 */

.alerts-page {
  padding: 0;
  max-width: 1000px;
  margin: 0 auto;
}

.alerts-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 20px;
}

.header-actions {
  display: flex;
  gap: 8px;
}

/* ─── 告警卡片 ─── */
.alerts-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.alert-card {
  display: flex;
  align-items: stretch;
  gap: 0;
  border-radius: var(--radius-md);
  background: var(--bg-glass);
  backdrop-filter: blur(8px);
  border: 1px solid var(--border-base);
  cursor: pointer;
  transition: all var(--dur-base) var(--ease-out);
  position: relative;
  overflow: hidden;
}

.alert-card:hover {
  transform: translateX(4px);
  box-shadow: var(--shadow-pop);
  border-color: var(--border-hover);
}

/* 左侧等级色条 */
.alert-level-bar {
  width: 4px;
  flex-shrink: 0;
}
.alert-level-error { background: var(--alert-error); box-shadow: 0 0 8px var(--alert-error); }
.alert-level-warn  { background: var(--alert-warn); box-shadow: 0 0 8px var(--alert-warn); }
.alert-level-info  { background: var(--alert-info); box-shadow: 0 0 8px var(--alert-info); }

/* 未读样式 */
.alert-card.unread {
  background: linear-gradient(90deg, var(--primary-dim), var(--bg-glass) 30%);
  border-left: 1px solid var(--primary);
}

.alert-card.read {
  opacity: 0.55;
}

/* 等级背景微光 */
.alert-card.alert-error { background: linear-gradient(90deg, rgba(239,68,68,0.08), var(--bg-glass) 40%); }
.alert-card.alert-warn  { background: linear-gradient(90deg, rgba(245,158,11,0.08), var(--bg-glass) 40%); }
.alert-card.alert-info  { background: linear-gradient(90deg, rgba(59,130,246,0.08), var(--bg-glass) 40%); }

.alert-card.alert-error.unread { animation: alert-pulse 2s ease infinite; }

@keyframes alert-pulse {
  0%, 100% { box-shadow: 0 0 0 rgba(239,68,68,0); }
  50%      { box-shadow: 0 0 12px rgba(239,68,68,0.2); }
}

/* 图标 */
.alert-icon {
  font-size: 20px;
  padding: 14px 12px;
  display: flex;
  align-items: center;
  flex-shrink: 0;
}

/* 主体 */
.alert-body {
  flex: 1;
  padding: 12px 8px;
}

.alert-message {
  font-size: 14px;
  color: var(--text-primary);
  font-weight: 500;
  margin-bottom: 4px;
}

.alert-meta {
  display: flex;
  gap: 12px;
  font-size: 11px;
  color: var(--text-tertiary);
  align-items: center;
}

.alert-code {
  background: var(--bg-elev-3);
  padding: 1px 6px;
  border-radius: 3px;
  font-family: var(--font-mono);
  font-size: 10px;
}

/* 未读红点 */
.unread-dot {
  width: 8px; height: 8px;
  border-radius: 50%;
  background: var(--primary);
  box-shadow: var(--glow-primary);
  margin: 16px 14px 0 0;
  flex-shrink: 0;
  animation: pulse-dot 2s ease infinite;
}
```

---

## 十一、RobotStatusCard 组件升级

> **替换** `packages/ui-kit/src/RobotStatusCard.tsx`

```tsx
import type { UnifiedRobotState } from 'robot-adapter-kit'

const STATUS_COLORS: Record<string, string> = {
  idle: 'var(--status-online)',
  moving: 'var(--status-moving)',
  working: 'var(--status-working)',
  error: 'var(--status-error)',
  charging: 'var(--status-charging)',
}

const STATUS_LABELS: Record<string, string> = {
  idle: '空闲', moving: '移动中', working: '工作中',
  error: '故障', charging: '充电中',
}

interface Props {
  state: UnifiedRobotState
  onClick?: () => void
  compact?: boolean
}

export function RobotStatusCard({ state, onClick, compact }: Props) {
  const color = STATUS_COLORS[state.status] ?? 'var(--text-tertiary)'
  const pct = state.batteryPct

  return (
    <div
      onClick={onClick}
      className={`robot-card ${!state.online ? 'offline' : ''} ${compact ? 'compact' : ''}`}
      style={{
        cursor: onClick ? 'pointer' : 'default',
        borderLeft: `3px solid ${color}`,
      }}
    >
      {/* 头部：ID + 状态标签 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {/* 脉冲点 */}
          <span
            className={state.online ? 'dot dot-online' : 'dot dot-offline'}
            style={state.status === 'error' ? { background: 'var(--status-error)', animation: 'pulse-dot 1s ease infinite' } : undefined}
          />
          <span style={{ fontWeight: 600, fontSize: 13, color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>
            {state.robotId}
          </span>
        </div>
        <span
          style={{
            padding: '2px 8px', borderRadius: 10, fontSize: 10,
            background: `${color}15`, color, fontWeight: 600,
            border: `1px solid ${color}33`,
          }}
        >
          {STATUS_LABELS[state.status] ?? state.status}
        </span>
      </div>

      {/* 品牌型号 */}
      {!compact && (
        <div style={{ marginTop: 8, fontSize: 11, color: 'var(--text-tertiary)' }}>
          {state.brand} · {state.model}
        </div>
      )}

      {/* 电量条（分段式） */}
      <div style={{ marginTop: 10 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, marginBottom: 3 }}>
          <span style={{ color: 'var(--text-tertiary)' }}>BATTERY</span>
          <span
            style={{
              color: pct < 20 ? 'var(--alert-error)' : color,
              fontFamily: 'var(--font-mono)', fontWeight: 600,
            }}
          >
            {pct}%
          </span>
        </div>
        {/* 分段能量条 */}
        <div style={{ display: 'flex', gap: 2 }}>
          {Array.from({ length: 10 }).map((_, i) => {
            const segPct = (i + 1) * 10
            const filled = pct >= segPct
            const segColor = pct < 20 ? 'var(--alert-error)' : pct < 50 ? 'var(--alert-warn)' : 'var(--status-online)'
            return (
              <div
                key={i}
                style={{
                  flex: 1, height: 5, borderRadius: 1,
                  background: filled ? segColor : 'var(--bg-elev-3)',
                  boxShadow: filled ? `0 0 3px ${segColor}88` : 'none',
                  transition: 'all 0.3s',
                }}
              />
            )
          })}
        </div>
      </div>

      {/* 位置坐标 */}
      <div style={{ marginTop: 8, fontSize: 10, color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)' }}>
        POS ({state.position.x.toFixed(1)}, {state.position.y.toFixed(1)})
        {!state.online && (
          <span style={{ color: 'var(--alert-error)', marginLeft: 8 }}>● OFFLINE</span>
        )}
      </div>
    </div>
  )
}
```

### 配套 CSS（追加到 globals.css）

```css
.robot-card {
  padding: 12px 14px;
  border-radius: var(--radius-md);
  background: var(--bg-glass);
  backdrop-filter: blur(8px);
  border: 1px solid var(--border-base);
  transition: all var(--dur-base) var(--ease-out);
  position: relative;
  overflow: hidden;
}
.robot-card:hover {
  border-color: var(--border-hover);
  box-shadow: var(--shadow-pop);
  transform: translateY(-1px);
}
.robot-card.offline {
  opacity: 0.6;
  border-color: rgba(239,68,68,0.2);
}
.robot-card.compact {
  padding: 8px 12px;
}
/* 顶部微光线 */
.robot-card::before {
  content: '';
  position: absolute; top: 0; left: 14px; right: 14px; height: 1px;
  background: linear-gradient(90deg, transparent, var(--primary-dim), transparent);
}
```

---

## 十二、BatteryGauge 电池仪表升级

> **替换** `packages/ui-kit/src/BatteryGauge.tsx`

```tsx
interface Props {
  pct: number
  size?: number
}

export function BatteryGauge({ pct, size = 80 }: Props) {
  const radius = (size - 12) / 2
  const circ = 2 * Math.PI * radius
  const dash = (pct / 100) * circ
  const color = pct < 20 ? 'var(--alert-error)' : pct < 50 ? 'var(--alert-warn)' : 'var(--status-online)'
  const bgColor = 'var(--bg-elev-3)'

  return (
    <div style={{ position: 'relative', width: size, height: size }}>
      {/* 外环发光 */}
      <svg width={size} height={size} style={{ filter: `drop-shadow(0 0 4px ${color}55)` }}>
        {/* 背景环 */}
        <circle
          cx={size / 2} cy={size / 2} r={radius}
          fill="none" stroke={bgColor} strokeWidth={5}
        />
        {/* 进度环 */}
        <circle
          cx={size / 2} cy={size / 2} r={radius}
          fill="none" stroke={color} strokeWidth={5}
          strokeDasharray={`${dash} ${circ - dash}`}
          strokeLinecap="round"
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          style={{ transition: 'stroke-dasharray 0.6s var(--ease-out)' }}
        />
        {/* 刻度点 */}
        {Array.from({ length: 12 }).map((_, i) => {
          const angle = (i * 30 - 90) * Math.PI / 180
          const x = size / 2 + (radius + 4) * Math.cos(angle)
          const y = size / 2 + (radius + 4) * Math.sin(angle)
          return (
            <circle
              key={i} cx={x} cy={y} r={1}
              fill={i < (pct / 100) * 12 ? color : 'var(--border-base)'}
            />
          )
        })}
      </svg>
      {/* 中心文字 */}
      <div
        style={{
          position: 'absolute', top: '50%', left: '50%',
          transform: 'translate(-50%, -50%)',
          fontSize: size * 0.22, fontWeight: 700,
          color, fontFamily: 'var(--font-mono)',
          textShadow: `0 0 8px ${color}44`,
        }}
      >
        {pct}%
      </div>
    </div>
  )
}
```

---

## 十三、AlertItem / AlertCard 升级

> **替换** `packages/ui-kit/src/AlertItem.tsx` 和 `AlertCard.tsx`

```tsx
// AlertItem.tsx
import type { UnifiedAlert } from 'robot-adapter-kit'

const LEVEL_COLORS: Record<string, string> = {
  info: 'var(--alert-info)',
  warn: 'var(--alert-warn)',
  error: 'var(--alert-error)',
}
const LEVEL_BG: Record<string, string> = {
  info: 'rgba(59,130,246,0.08)',
  warn: 'rgba(245,158,11,0.08)',
  error: 'rgba(239,68,68,0.08)',
}
const LEVEL_ICONS: Record<string, string> = {
  info: '🔊', warn: '⚠', error: '🚨',
}

interface Props {
  alert: UnifiedAlert
  onDismiss?: (id: string) => void
  compact?: boolean
}

export function AlertItem({ alert, onDismiss, compact }: Props) {
  const color = LEVEL_COLORS[alert.level] ?? 'var(--text-tertiary)'
  const time = new Date(alert.timestamp).toLocaleTimeString()

  return (
    <div
      style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: compact ? '6px 10px' : '8px 12px',
        borderRadius: 'var(--radius-sm)',
        background: LEVEL_BG[alert.level] ?? 'var(--bg-elev-2)',
        borderLeft: `3px solid ${color}`,
        fontSize: 12,
        transition: 'all 0.2s',
      }}
    >
      <span style={{ fontSize: 14, flexShrink: 0 }}>{LEVEL_ICONS[alert.level]}</span>
      <span style={{ fontWeight: 500, color: 'var(--text-primary)', flexShrink: 0, fontFamily: 'var(--font-mono)', fontSize: 11 }}>
        {alert.robotId}
      </span>
      <span style={{ color: 'var(--text-secondary)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {alert.message}
      </span>
      <span style={{ color: 'var(--text-tertiary)', fontSize: 10, fontFamily: 'var(--font-mono)', flexShrink: 0 }}>
        {time}
      </span>
      {onDismiss && (
        <button
          onClick={() => onDismiss(alert.robotId)}
          style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--text-tertiary)', fontSize: 14, padding: '0 4px' }}
        >
          ✕
        </button>
      )}
    </div>
  )
}
```

```tsx
// AlertCard.tsx
import type { UnifiedAlert } from 'adapter-kit'

export function AlertCard({ alert }: { alert: UnifiedAlert }) {
  const s = {
    info:  { bg: 'rgba(59,130,246,0.06)', border: 'var(--alert-info)' },
    warn:  { bg: 'rgba(245,158,11,0.06)', border: 'var(--alert-warn)' },
    error: { bg: 'rgba(239,68,68,0.06)', border: 'var(--alert-error)' },
  }[alert.level] ?? { bg: 'var(--bg-elev-2)', border: 'var(--border-base)' }

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 8,
      padding: '6px 10px', borderRadius: 'var(--radius-sm)',
      background: s.bg, borderLeft: `3px solid ${s.border}`,
      fontSize: 12,
    }}>
      <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        <strong style={{ fontFamily: 'var(--font-mono)', fontSize: 11 }}>{alert.robotId}</strong>
        <span style={{ color: 'var(--text-secondary)', marginLeft: 6 }}>{alert.message}</span>
      </span>
      <span style={{ color: 'var(--text-tertiary)', fontSize: 10, fontFamily: 'var(--font-mono)' }}>
        {new Date(alert.timestamp).toLocaleTimeString()}
      </span>
    </div>
  )
}
```

---

## 十四、数字孪生 3D 场景氛围升级

> **替换** `packages/digital-twin/src/RobotViewer.tsx` + 相关组件

### RobotViewer.tsx

```tsx
import { Canvas } from '@react-three/fiber'
import { OrbitControls, Grid } from '@react-three/drei'
import { G1Dog } from './robots/G1Dog'
import { PeanutBot } from './robots/PeanutBot'
import { Floor } from './environment/Floor'
import { SlamMap } from './environment/SlamMap'
import { TrajectoryLine } from './overlays/TrajectoryLine'
import { StatusBadge } from './overlays/StatusBadge'
import { useRobotState } from './hooks/useRobotState'
import type { UnifiedRobotState } from 'robot-adapter-kit'
import { Stars } from '@react-three/drei'

interface RobotViewerProps {
  robotId: string
  trajectory?: { x: number; y: number }[]
  showMap?: boolean
}

export function RobotViewer({ robotId, trajectory, showMap = true }: RobotViewerProps) {
  const state = useRobotState(robotId)

  return (
    <Canvas
      shadows
      camera={{ position: [5, 4, 5], fov: 50 }}
      style={{ width: '100%', height: '100%', background: 'linear-gradient(180deg, #050810 0%, #0a0e1a 60%, #0d1225 100%)' }}
    >
      {/* 光照：冷色调科技感 */}
      <ambientLight intensity={0.3} color="#4488ff" />
      <directionalLight position={[5, 8, 5]} intensity={0.6} color="#88bbff" castShadow />
      <pointLight position={[-3, 2, -3]} intensity={0.4} color="#00f0ff" />
      <pointLight position={[3, 1, 3]} intensity={0.3} color="#7b61ff" />

      {/* 星空粒子 */}
      <Stars radius={50} depth={30} count={1500} factor={3} saturation={0.5} fade speed={0.5} />

      {/* 地面 */}
      <Floor />
      {showMap && <SlamMap />}

      {/* 科技感网格 */}
      <Grid
        args={[30, 30]}
        cellSize={0.5}
        cellColor="#00f0ff22"
        sectionSize={2}
        sectionColor="#00f0ff44"
        fadeDistance={20}
        fadeStrength={1}
        infiniteGrid
      />

      {/* 机器人 */}
      {state && <RobotBody state={state} />}

      {/* 轨迹线 */}
      {trajectory && trajectory.length > 1 && (
        <TrajectoryLine points={trajectory} />
      )}

      {/* 地面光环（选中效果） */}
      {state && <GroundRing position={[state.position.x, 0.02, state.position.y]} color={state.status === 'error' ? '#ff3d71' : '#00f0ff'} />}

      <OrbitControls enableDamping dampingFactor={0.08} target={[0, 0.5, 0]} />
    </Canvas>
  )
}

function RobotBody({ state }: { state: UnifiedRobotState }) {
  const pos: [number, number, number] = [state.position.x, 0, state.position.y]
  const rot: [number, number, number] = [0, state.position.theta, 0]
  return (
    <>
      {state.brand === 'unitree' && <G1Dog position={pos} rotation={rot} joints={state.joints} />}
      {state.brand === 'keenon' && <PeanutBot position={pos} rotation={rot} />}
      <StatusBadge state={state} />
    </>
  )
}

/* 地面光环 */
function GroundRing({ position, color }: { position: [number, number, number]; color: string }) {
  return (
    <mesh position={position} rotation={[-Math.PI / 2, 0, 0]}>
      <ringGeometry args={[0.4, 0.5, 32]} />
      <meshBasicMaterial color={color} transparent opacity={0.6} />
    </mesh>
  )
}
```

### G1Dog.tsx（升级版）

```tsx
import { useGLTF } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { useRef } from 'react'
import * as THREE from 'three'

interface G1DogProps {
  position: [number, number, number]
  rotation: [number, number, number]
  joints?: Record<string, number>
  scale?: number
}

function PlaceholderDog({ position, rotation, scale = 0.5 }: G1DogProps) {
  const ref = useRef<THREE.Group>(null!)
  useFrame(({ clock }) => {
    if (ref.current) {
      ref.current.rotation.y = rotation[1] + Math.sin(clock.elapsedTime * 2) * 0.1
      // 模拟行走上下浮动
      ref.current.position.y = position[1] + Math.abs(Math.sin(clock.elapsedTime * 3)) * 0.05
    }
  })
  return (
    <group ref={ref} position={position} rotation={rotation} scale={scale}>
      {/* 主体 */}
      <mesh castShadow>
        <boxGeometry args={[0.6, 0.3, 0.8]} />
        <meshStandardMaterial color="#00f0ff" emissive="#00f0ff" emissiveIntensity={0.15} metalness={0.6} roughness={0.3} />
      </mesh>
      {/* 头部 */}
      <mesh position={[0, 0.28, 0.35]}>
        <boxGeometry args={[0.2, 0.18, 0.22]} />
        <meshStandardMaterial color="#0a1628" emissive="#00f0ff" emissiveIntensity={0.3} />
      </mesh>
      {/* 眼睛发光 */}
      <mesh position={[0.06, 0.3, 0.47]}>
        <sphereGeometry args={[0.02]} />
        <meshBasicMaterial color="#00f0ff" />
      </mesh>
      <mesh position={[-0.06, 0.3, 0.47]}>
        <sphereGeometry args={[0.02]} />
        <meshBasicMaterial color="#00f0ff" />
      </mesh>
      {/* 腿 */}
      {[[-0.2,-0.15,0.25],[0.2,-0.15,0.25],[-0.2,-0.15,-0.25],[0.2,-0.15,-0.25]].map((p, i) => (
        <mesh key={i} position={p as [number, number, number]}>
          <cylinderGeometry args={[0.035, 0.035, 0.3]} />
          <meshStandardMaterial color="#0a1628" emissive="#00f0ff" emissiveIntensity={0.1} />
        </mesh>
      ))}
      {/* 尾部光条 */}
      <mesh position={[0, 0.15, -0.45]}>
        <boxGeometry args={[0.03, 0.03, 0.15]} />
        <meshBasicMaterial color="#00f0ff" />
      </mesh>
    </group>
  )
}

export function G1Dog(props: G1DogProps) {
  try {
    const { scene } = useGLTF('/models/g1_dog.glb')
    return (
      <primitive
        object={scene}
        position={props.position}
        rotation={props.rotation}
        scale={props.scale ?? 0.5}
      />
    )
  } catch {
    return <PlaceholderDog {...props} />
  }
}
```

### PeanutBot.tsx（升级版）

```tsx
import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

interface PeanutBotProps {
  position: [number, number, number]
  rotation: [number, number, number]
}

export function PeanutBot({ position, rotation }: PeanutBotProps) {
  const ref = useRef<THREE.Group>(null!)
  useFrame(({ clock }) => {
    if (ref.current) {
      ref.current.rotation.y = rotation[1]
      // 托盘轻微浮动
      const tray = ref.current.children[1]
      if (tray) tray.position.y = 0.2 + Math.sin(clock.elapsedTime * 2) * 0.02
    }
  })
  return (
    <group ref={ref} position={position} rotation={rotation}>
      {/* 底盘（发光环） */}
      <mesh castShadow>
        <cylinderGeometry args={[0.28, 0.28, 0.12, 32]} />
        <meshStandardMaterial color="#1a1a2e" metalness={0.8} roughness={0.2} />
      </mesh>
      <mesh position={[0, 0.07, 0]}>
        <ringGeometry args={[0.25, 0.28, 32]} />
        <meshBasicMaterial color="#ff9800" />
      </mesh>
      {/* 托盘 */}
      <mesh position={[0, 0.2, 0]}>
        <cylinderGeometry args={[0.32, 0.32, 0.04, 32]} />
        <meshStandardMaterial color="#fff7e6" emissive="#ff980022" />
      </mesh>
      {/* 立柱 */}
      <mesh position={[0, 0.5, 0]}>
        <boxGeometry args={[0.1, 0.55, 0.1]} />
        <meshStandardMaterial color="#ff9800" metalness={0.5} roughness={0.3} />
      </mesh>
      {/* 头部/屏幕（发光） */}
      <mesh position={[0, 0.9, 0]}>
        <boxGeometry args={[0.22, 0.28, 0.12]} />
        <meshStandardMaterial color="#0a0e1a" emissive="#00f0ff" emissiveIntensity={0.4} />
      </mesh>
      {/* 屏幕内容光 */}
      <mesh position={[0, 0.9, 0.07]}>
        <planeGeometry args={[0.18, 0.22]} />
        <meshBasicMaterial color="#00f0ff" transparent opacity={0.6} />
      </mesh>
    </group>
  )
}
```

### TrajectoryLine.tsx（升级版 - 渐变发光轨迹）

```tsx
import { useMemo } from 'react'
import * as THREE from 'three'

interface TrajectoryLineProps {
  points: { x: number; y: number }[]
  color?: string
}

export function TrajectoryLine({ points, color = '#00f0ff' }: TrajectoryLineProps) {
  const { geometry, lengths } = useMemo(() => {
    const verts = points.map((p) => new THREE.Vector3(p.x, 0.06, p.y))
    const geom = new THREE.BufferGeometry().setFromPoints(verts)
    // 计算每段长度用于渐变
    const lens: number[] = []
    for (let i = 1; i < verts.length; i++) {
      lens.push(verts[i].distanceTo(verts[i - 1]))
    }
    return { geometry: geom, lengths: lens }
  }, [points])

  if (points.length < 2) return null

  return (
    <group>
      {/* 主线 */}
      <line>
        <primitive object={geometry} attach="geometry" />
        <lineBasicMaterial color={color} linewidth={2} transparent opacity={0.7} />
      </line>
      {/* 发光复制层 */}
      <line>
        <primitive object={geometry} attach="geometry" />
        <lineBasicMaterial color={color} linewidth={4} transparent opacity={0.2} />
      </line>
      {/* 终点标记 */}
      <mesh position={[points[points.length - 1].x, 0.1, points[points.length - 1].y]}>
        <sphereGeometry args={[0.06]} />
        <meshBasicMaterial color={color} />
      </mesh>
    </group>
  )
}
```

### StatusBadge.tsx（升级版）

```tsx
import { Html } from '@react-three/drei'
import type { UnifiedRobotState } from 'robot-adapter-kit'

const STATUS_COLORS: Record<string, string> = {
  idle: '#00e676', moving: '#2196f3', working: '#ff9800',
  error: '#ff3d71', charging: '#ab47bc',
}

export function StatusBadge({ state }: { state: UnifiedRobotState }) {
  const color = STATUS_COLORS[state.status] ?? '#999'
  return (
    <Html position={[0, 1.5, 0]} center distanceFactor={8} occlude={false}>
      <div
        style={{
          background: 'rgba(10, 14, 26, 0.85)',
          backdropFilter: 'blur(6px)',
          border: `1px solid ${color}55`,
          borderRadius: 6,
          padding: '4px 10px',
          fontSize: 11,
          whiteSpace: 'nowrap',
          color: '#e2e8f0',
          fontFamily: 'JetBrains Mono, monospace',
          boxShadow: `0 0 8px ${color}33`,
        }}
      >
        <div style={{ fontWeight: 700, color, fontSize: 12 }}>
          ● {state.robotId}
        </div>
        <div style={{ color: 'var(--text-tertiary)', fontSize: 10 }}>
          BAT {state.batteryPct}% · {state.status.toUpperCase()}
        </div>
      </div>
    </Html>
  )
}
```

---

## 十五、SpeakBubble 播报气泡升级

> **替换** `apps/web-console/src/components/overlays/SpeakBubble.tsx` + CSS

```tsx
import { useSpeakStore } from '../../lib/wsHub'
import { useEffect, useState } from 'react'
import './SpeakBubble.css'

export function SpeakBubble() {
  const lastSpeak = useSpeakStore(s => s.lastSpeak)
  const [visible, setVisible] = useState(false)
  const [text, setText] = useState('')
  const [history, setHistory] = useState<{ text: string; time: string }[]>([])
  const [showHistory, setShowHistory] = useState(false)

  useEffect(() => {
    if (lastSpeak) {
      setText(lastSpeak.text)
      setVisible(true)
      setHistory(prev => [{ text: lastSpeak.text, time: new Date(lastSpeak.timestamp).toLocaleTimeString() }, ...prev].slice(0, 20))
      const timer = setTimeout(() => setVisible(false), 3500)
      return () => clearTimeout(timer)
    }
  }, [lastSpeak])

  if (!visible && !showHistory) return null

  return (
    <>
      {/* 主气泡 */}
      {visible && (
        <div className="speak-bubble">
          <span className="speak-icon">🔊</span>
          <span className="speak-text">{text}</span>
          <button
            className="speak-close"
            onClick={() => setVisible(false)}
          >
            ✕
          </button>
        </div>
      )}

      {/* 历史面板 */}
      <div className="speak-history-panel">
        <button
          className="speak-history-toggle"
          onClick={() => setShowHistory(!showHistory)}
        >
          📜 播报历史 ({history.length})
        </button>
        {showHistory && (
          <ul className="speak-history-list">
            {history.length === 0 ? (
              <li className="empty">暂无播报记录</li>
            ) : (
              history.map((h, i) => (
                <li key={i}>
                  <span className="time">{h.time}</span>
                  <span className="text">{h.text}</span>
                </li>
              ))
            )}
          </ul>
        )}
      </div>
    </>
  )
}
```

### SpeakBubble.css（升级版）

```css
/* SpeakBubble.css · 科技感播报气泡 */

.speak-bubble {
  position: fixed;
  bottom: 32px;
  right: 32px;
  z-index: 9999;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px 20px;
  border-radius: 14px;
  background: linear-gradient(135deg, rgba(0,240,255,0.15), rgba(123,97,255,0.15));
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border: 1px solid var(--primary-glow);
  box-shadow: var(--glow-primary-lg);
  animation: speakPop 0.35s cubic-bezier(0.34, 1.56, 0.64, 1);
}

.speak-bubble .speak-icon {
  font-size: 20px;
  animation: pulse 1s ease infinite;
}

.speak-bubble .speak-text {
  font-size: 15px;
  font-weight: 500;
  color: var(--text-primary);
  white-space: nowrap;
  font-family: var(--font-sans);
}

.speak-bubble .speak-close {
  background: none;
  border: none;
  color: var(--text-tertiary);
  cursor: pointer;
  font-size: 14px;
  padding: 0 4px;
  transition: color 0.2s;
}
.speak-bubble .speak-close:hover {
  color: var(--text-primary);
}

/* 声波动画 */
.speak-bubble::before {
  content: '';
  position: absolute;
  left: -2px; top: 50%;
  width: 3px; height: 60%;
  background: linear-gradient(180deg, transparent, var(--primary), transparent);
  transform: translateY(-50%);
  border-radius: 2px;
  animation: speak-wave 1.2s ease infinite;
}

@keyframes speakPop {
  0%   { transform: scale(0.6) translateY(20px); opacity: 0; }
  100% { transform: scale(1)   translateY(0);    opacity: 1; }
}

@keyframes pulse {
  0%, 100% { transform: scale(1); }
  50%      { transform: scale(1.2); }
}

@keyframes speak-wave {
  0%, 100% { opacity: 0.3; }
  50%      { opacity: 1; }
}

/* 历史面板 */
.speak-history-panel {
  position: fixed;
  bottom: 32px;
  right: 32px;
  z-index: 9998;
  margin-bottom: 70px;
}

.speak-history-toggle {
  background: var(--bg-glass);
  backdrop-filter: blur(8px);
  border: 1px solid var(--border-base);
  border-radius: 10px;
  padding: 8px 14px;
  font-size: 12px;
  cursor: pointer;
  color: var(--text-secondary);
  transition: all 0.2s;
}
.speak-history-toggle:hover {
  background: var(--bg-elev-3);
  border-color: var(--border-hover);
  color: var(--primary);
}

.speak-history-list {
  list-style: none;
  margin: 8px 0 0 0;
  padding: 12px;
  background: var(--bg-glass);
  backdrop-filter: blur(12px);
  border-radius: 12px;
  border: 1px solid var(--border-base);
  box-shadow: var(--shadow-pop);
  max-height: 240px;
  overflow-y: auto;
  min-width: 280px;
}
.speak-history-list li {
  display: flex;
  gap: 10px;
  padding: 6px 0;
  border-bottom: 1px solid var(--border-subtle);
  font-size: 12px;
}
.speak-history-list li:last-child { border-bottom: none; }
.speak-history-list .time {
  color: var(--text-tertiary);
  font-size: 11px;
  white-space: nowrap;
  min-width: 65px;
  font-family: var(--font-mono);
}
.speak-history-list .text {
  color: var(--text-primary);
}
.speak-history-list .empty {
  color: var(--text-tertiary);
  text-align: center;
  padding: 12px;
  border: none;
}
```

---

## 十六、TenantsPage 租户管理页优化

> **替换** `apps/web-console/src/routes/TenantsPage.tsx`

```tsx
import { useState } from 'react'
import { useTenantStore, type Tenant } from '../stores/tenantStore'

const mockTenants: Tenant[] = [
  { id: 'laowang',  name: '老王机器人运营中心', primaryColor: '#ff6b35', domain: 'laowang.robot-ops.io' },
  { id: 'hotpot01', name: '蜀大侠机器人后台',  primaryColor: '#ef4444', domain: 'hotpot01.robot-ops.io' },
  { id: 'pharma01', name: '康佰家药房机器人',  primaryColor: '#22c55e', domain: 'pharma01.robot-ops.io' },
]

export function TenantsPage() {
  const { tenant: currentTenant, setTenant } = useTenantStore()
  const [tenants] = useState(mockTenants)

  const handleSwitch = (t: Tenant) => {
    setTenant(t)
    window.history.replaceState(null, '', `?tenant=${t.id}`)
  }

  return (
    <div style={{ animation: 'fadeInUp 0.4s var(--ease-out)' }}>
      <div className="page-header">
        <h1 className="page-title">租户管理</h1>
        <button className="btn btn-primary">＋ 新建租户</button>
      </div>

      {/* 租户卡片网格 */}
      <div className="grid grid-3" style={{ marginBottom: 24 }}>
        {tenants.map((t) => {
          const isCurrent = currentTenant?.id === t.id
          return (
            <div
              key={t.id}
              onClick={() => handleSwitch(t)}
              style={{
                cursor: 'pointer',
                position: 'relative',
                overflow: 'hidden',
              }}
              className={`card hud-corners ${isCurrent ? 'active' : ''}`}
            >
              {/* 顶部色条 */}
              <div
                style={{
                  position: 'absolute', top: 0, left: 0, right: 0, height: 3,
                  background: t.primaryColor,
                  boxShadow: `0 0 8px ${t.primaryColor}66`,
                }}
              />
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14, marginTop: 4 }}>
                {/* Logo 占位 */}
                <div
                  style={{
                    width: 42, height: 42, borderRadius: 12,
                    background: `linear-gradient(135deg, ${t.primaryColor}, ${t.primaryColor}88)`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: '#fff', fontWeight: 800, fontSize: 18,
                    boxShadow: `0 4px 12px ${t.primaryColor}33`,
                  }}
                >
                  {t.name.charAt(0)}
                </div>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--text-primary)' }}>{t.name}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)' }}>
                    {t.domain}
                  </div>
                </div>
              </div>

              {/* 信息行 */}
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <span style={{
                  fontSize: 11, padding: '3px 8px',
                  background: `${t.primaryColor}15`, color: t.primaryColor,
                  borderRadius: 4, fontFamily: 'var(--font-mono)',
                  border: `1px solid ${t.primaryColor}33`,
                }}>
                  {t.primaryColor}
                </span>
                {isCurrent && (
                  <span style={{
                    fontSize: 11, padding: '3px 8px',
                    background: 'var(--primary-dim)', color: 'var(--primary)',
                    borderRadius: 4, fontWeight: 600,
                  }}>
                    ● 当前激活
                  </span>
                )}
              </div>

              {/* Hover 时显示"点击切换" */}
              {!isCurrent && (
                <div style={{
                  position: 'absolute', inset: 0,
                  background: 'rgba(0,0,0,0.4)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  opacity: 0, transition: 'opacity 0.2s',
                  fontSize: 14, fontWeight: 600, color: '#fff',
                }} className="overlay-text">
                  点击切换至此租户 →
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* 贴牌说明 */}
      <div className="card" style={{ padding: 20 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 12 }}>
          ◇ 贴牌换肤机制
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          {[
            { label: '独立域名', desc: '每个租户独立子域名，自动加载品牌色/Logo' },
            { label: 'CSS 变量', desc: '--primary-color 全局生效，换肤零代码' },
            { label: '数据隔离', desc: 'Supabase RLS 按 tenant_id 行级隔离' },
            { label: '机器人分组', desc: '按租户分组管理，互不干扰' },
          ].map(item => (
            <div key={item.label} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
              <span style={{ color: 'var(--primary)', fontSize: 14, marginTop: 2 }}>▸</span>
              <div>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>{item.label}</div>
                <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{item.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 内联样式补充 */}
      <style>{`
        .card.active {
          border-color: var(--primary);
          box-shadow: var(--glow-primary);
        }
        .card:hover .overlay-text {
          opacity: 1 !important;
        }
      `}</style>
    </div>
  )
}
```

---

## 十七、Login 登录页（新增）

> **新建** `apps/web-console/src/routes/LoginPage.tsx` + 在 App.tsx 加路由

```tsx
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

export function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    // TODO: 接入 Supabase Auth
    await new Promise(r => setTimeout(r, 800))
    setLoading(false)
    navigate('/')
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* 3D 线框球背景（CSS 版） */}
      <div style={bgSphereStyle} />

      {/* 背景网格 */}
      <div
        style={{
          position: 'absolute', inset: 0,
          background:
            'linear-gradient(rgba(0,240,255,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(0,240,255,0.03) 1px, transparent 1px)',
          backgroundSize: '60px 60px',
          zIndex: 0,
        }}
      />

      {/* 扫描线 */}
      <div
        style={{
          position: 'absolute', top: 0, left: 0, right: 0, height: 2,
          background: 'linear-gradient(90deg, transparent, var(--primary-glow), transparent)',
          animation: 'scanline 6s linear infinite',
          zIndex: 1,
        }}
      />

      {/* 登录卡片 */}
      <form onSubmit={handleLogin} style={loginCardStyle}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div
            style={{
              width: 56, height: 56, borderRadius: 16,
              background: 'linear-gradient(135deg, var(--primary), var(--accent))',
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              color: '#0a0e1a', fontWeight: 800, fontSize: 24,
              boxShadow: 'var(--glow-primary-lg)',
              marginBottom: 16,
            }}
          >
            R
          </div>
          <h1
            style={{
              fontSize: 24, fontWeight: 700,
              color: 'var(--text-primary)',
              letterSpacing: '0.1em',
              textShadow: 'var(--glow-primary)',
            }}
          >
            ROBOTOPS
          </h1>
          <p style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 4, letterSpacing: '0.05em' }}>
            CONSOLE · v0.2
          </p>
        </div>

        {/* 输入框 */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginBottom: 24 }}>
          <div>
            <label style={labelStyle}>邮箱</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="admin@robot-ops.io"
              style={inputStyle}
              required
            />
          </div>
          <div>
            <label style={labelStyle}>密码</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              style={inputStyle}
              required
            />
          </div>
        </div>

        {/* 登录按钮 */}
        <button
          type="submit"
          disabled={loading}
          style={{
            width: '100%', padding: '12px',
            background: loading
              ? 'var(--bg-elev-3)'
              : 'linear-gradient(135deg, var(--primary), var(--accent))',
            color: '#0a0e1a',
            border: 'none',
            borderRadius: 'var(--radius-sm)',
            fontSize: 14, fontWeight: 700,
            cursor: loading ? 'wait' : 'pointer',
            boxShadow: loading ? 'none' : 'var(--glow-primary)',
            transition: 'all 0.3s',
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          {/* 扫描光效 */}
          {!loading && (
            <span
              style={{
                position: 'absolute', top: 0, left: '-100%',
                width: '100%', height: '100%',
                background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.3), transparent)',
                animation: 'btn-scan 2.5s ease infinite',
              }}
            />
          )}
          {loading ? '⏳ 验证中...' : '▶ 进入控制台'}
        </button>

        {/* 底部 */}
        <div style={{ textAlign: 'center', marginTop: 20, fontSize: 11, color: 'var(--text-tertiary)' }}>
          Powered by <span style={{ color: 'var(--primary)' }}>robot-adapter-kit</span>
        </div>
      </form>

      <style>{`
        @keyframes btn-scan {
          0%   { left: -100%; }
          50%  { left: 100%; }
          100% { left: 100%; }
        }
        @keyframes sphere-rotate {
          from { transform: rotateX(0deg) rotateY(0deg); }
          to   { transform: rotateX(360deg) rotateY(360deg); }
        }
      `}</style>
    </div>
  )
}

/* ─── 样式常量 ─── */
const loginCardStyle: React.CSSProperties = {
  position: 'relative',
  zIndex: 10,
  width: 380,
  padding: '40px 36px',
  background: 'var(--bg-glass)',
  backdropFilter: 'blur(16px)',
  WebkitBackdropFilter: 'blur(16px)',
  border: '1px solid var(--border-base)',
  borderRadius: 'var(--radius-lg)',
  boxShadow: 'var(--shadow-pop)',
  animation: 'fadeInUp 0.5s var(--ease-out)',
}

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: 11,
  color: 'var(--text-tertiary)',
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
  marginBottom: 6,
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '10px 14px',
  background: 'var(--bg-elev-2)',
  border: '1px solid var(--border-base)',
  borderRadius: 'var(--radius-sm)',
  color: 'var(--text-primary)',
  fontSize: 14,
  fontFamily: 'var(--font-mono)',
  transition: 'border-color 0.2s',
}

const bgSphereStyle: React.CSSProperties = {
  position: 'absolute',
  width: 500, height: 500,
  borderRadius: '50%',
  border: '1px solid var(--primary-dim)',
  top: '50%', left: '50%',
  marginTop: -250, marginLeft: -250,
  zIndex: 0,
  animation: 'sphere-rotate 30s linear infinite',
  background:
    'radial-gradient(circle at 30% 30%, var(--primary-dim), transparent 50%), radial-gradient(circle at 70% 70%, var(--accent-dim), transparent 50%)',
}
```

### App.tsx 加路由

```tsx
// 在 App.tsx 的 Routes 里加一行
import { LoginPage } from './routes/LoginPage'

// Routes 内加：
<Route path="/login" element={<LoginPage />} />
```

---

## 十八、动画规范与动效库

### 18.1 动画时长规范

| 场景 | 时长 | 缓动 |
|------|------|------|
| 按钮 hover | 150ms | ease-out |
| 卡片 hover 上浮 | 250ms | cubic-bezier(0.16, 1, 0.3, 1) |
| 弹窗/气泡出现 | 350ms | cubic-bezier(0.34, 1.56, 0.64, 1)（弹簧） |
| 页面进入 | 400ms | cubic-bezier(0.16, 1, 0.3, 1) |
| 数据刷新闪烁 | 600ms | ease |
| 扫描线循环 | 6-8s | linear |

### 18.2 推荐动效库

```json
{
  "framer-motion": "^11.0.0",     // 复杂交互动画（推荐）
  "react-spring": "^9.7.0",       // 弹簧物理动画
  "lottie-react": "^2.4.0",       // Lottie 动画（播报/告警图标）
  "tsparticles": "^3.0.0",        // 粒子背景（登录页星空）
}
```

### 18.3 不用库也能做的动效（纯 CSS）

已包含在 globals.css 中：
- `pulse-dot` — 状态点脉冲
- `countUp` — 数字跳动
- `data-flash` — 数据刷新高亮
- `scanline` — 全局扫描线
- `fadeInUp` — 页面进入
- `slideInRight` — 右侧滑入
- `speakPop` — 气泡弹出
- `speak-wave` — 声波动画
- `radar-spin` — 雷达旋转
- `alert-pulse` — 告警脉冲
- `btn-scan` — 按钮扫描光

---

## 十九、字体与图标方案

### 19.1 字体加载（推荐 next/font 或 Google Fonts）

```html
<!-- 在 index.html 的 <head> 里加 -->
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600;700&display=swap" rel="stylesheet">
```

### 19.2 字体使用规则

| 用途 | 字体 | 字号 | 字重 |
|------|------|------|------|
| 页面标题 | Inter | 22px | 700 |
| 卡片标题 | Inter | 13-14px | 600 |
| 正文 | Inter | 13-14px | 400 |
| 数字/坐标/状态码 | JetBrains Mono | 11-16px | 500-700 |
| 按钮文字 | Inter | 13px | 500-600 |

### 19.3 图标方案（推荐）

| 方案 | 说明 | 适用 |
|------|------|------|
| **Lucide React** | 线条图标，风格统一，支持 tree-shaking | 导航/按钮/状态 |
| **Tabler Icons** | 图标多，风格偏科技 | 备选 |
| **Emoji** | 零依赖，快速 | 当前阶段够用 |
| **Lottie** | 动画图标 | 告警/播报/加载 |

安装：`pnpm add lucide-react`

替换示例：
```tsx
import { Activity, Battery, AlertTriangle, Cpu, MapPin } from 'lucide-react'

// 替代 emoji
<Activity size={16} color="var(--status-online)" />
<Battery size={16} color="var(--primary)" />
<AlertTriangle size={16} color="var(--alert-error)" />
```

---

## 二十、依赖安装清单

```bash
# 在 robot-ops-solo 根目录执行

# 动画库
pnpm add framer-motion lottie-react

# 图标
pnpm add lucide-react

# 粒子背景
pnpm add tsparticles @tsparticles/react

# Tailwind（如果还没装）
pnpm add -D tailwindcss postcss autoprefixer
pnpm exec tailwindcss init -p

# 类型补全
pnpm add -D @types/node
```

---

## 二十一、分步实施顺序

按以下顺序执行，**每步完成后启动项目验证一次**，确保不翻车：

| 步骤 | 内容 | 预计耗时 | 验证方式 |
|------|------|---------|---------|
| **1** | 安装依赖（第二十节） | 5 min | `pnpm install` 无报错 |
| **2** | 替换 globals.css（第二节完整版） | 10 min | 页面变深色，毛玻璃生效 |
| **3** | 新增 Tailwind 配置（第三节） | 5 min | 构建无报错 |
| **4** | 替换 Sidebar.tsx（第四节） | 10 min | 侧边栏变窄+毛玻璃+脉冲点 |
| **5** | 替换 RobotStatusCard + BatteryGauge + AlertItem + AlertCard | 20 min | 卡片带 HUD 角标+分段电量+状态色条 |
| **6** | 替换 Dashboard.tsx（第五节） | 15 min | KPI 卡片+数字跳动+迷你仪表 |
| **7** | 替换 RobotsPage.tsx（第六节） | 15 min | 三栏布局+详情面板+快捷操作 |
| **8** | 替换 TwinPage.tsx（第七节） | 20 min | 全屏 3D+HUD 四角+雷达+跑马灯 |
| **9** | 替换 5 个 SOP 节点 + globals.css 追加节点样式 | 20 min | 节点带左边色条+声波动画+双出口 |
| **10** | 替换 SopPage.tsx（第八节） | 10 min | 画布+预览面板+复制按钮 |
| **11** | 替换 AlertsPage.tsx + CSS（第十节） | 15 min | 筛选+搜索+等级色条+脉冲 |
| **12** | 替换 TenantsPage.tsx（第十六节） | 10 min | 租户卡片+色条+激活态 |
| **13** | 替换数字孪生组件（第十四节全部） | 20 min | 3D 星空+发光机器人+轨迹线 |
| **14** | 替换 SpeakBubble（第十五节） | 10 min | 渐变气泡+历史面板 |
| **15** | 新增 LoginPage（第十七节）+ 路由 | 15 min | 登录页3D背景+扫描光效 |
| **16** | 全局扫描线（在 App.tsx 加 `<div className="scanline-overlay" />`） | 2 min | 页面顶部有极淡扫描线 |
| **17** | 截图+录屏 | 10 min | 30 秒演示视频 |

**总计约 3-4 小时**，做完你的系统视觉水平从"后台管理"直接跳到"科技展台"。

---

## 二十二、Prompt 模板（喂给 AI 用）

### 模板 A：通用组件升级

```
你是一个资深前端 UI 工程师，擅长深色科技感数据可视化中台设计。
参考 Linear / Vercel / Raycast 的视觉语言。

请帮我升级这个 React 组件 [组件名]，要求：
1. 深色主题，背景用 var(--bg-elev-2)，文字用 var(--text-primary)
2. 边框用 var(--border-base)，hover 时变 var(--border-hover) 并加 box-shadow: var(--shadow-pop)
3. 数字用 JetBrains Mono 等宽字体，状态色用 var(--status-xxx)
4. 加 HUD 角标装饰（::before/::after 做左上+右下 L 形角标）
5. 入场动画用 fadeInUp 0.4s cubic-bezier(0.16, 1, 0.3, 1)
6. 所有动画尊重 prefers-reduced-motion
7. 不要引入新依赖，用 CSS variables + keyframes

当前代码：
[粘贴现有代码]
```

### 模板 B：3D 场景氛围

```
我在用 React Three Fiber 做机器人 3D 数字孪生。
请帮我增强场景氛围感，要求：
1. 背景用深蓝黑渐变（#050810 → #0a0e1a）
2. 加 Stars 粒子星空（1500 颗，慢速旋转）
3. 地面 Grid 用青色发光（cellColor #00f0ff22, sectionColor #00f0ff44）
4. 机器人脚下加一个发光圆环（ringGeometry，颜色随状态变化）
5. 光照：冷色调（ambient 0.3 + directional 0.6 蓝色调 + 2 个青紫色 pointLight）
6. 轨迹线用双重 line（主线 + 4px 宽半透明发光复制层）
7. 机器人模型用 emissive 材质，自发光强度 0.15-0.4

当前代码：
[粘贴 RobotViewer / G1Dog / PeanutBot 代码]
```

### 模板 C：数据卡片 KPI

```
请帮我做一个 KPI 指标卡片组件，要求：
1. 毛玻璃背景（backdrop-filter: blur(12px) + rgba 半透明）
2. 顶部：标签（11px 灰色 uppercase）+ 右侧趋势箭头（绿色↑/红色↓）
3. 主体：大数字（28px 等宽字体 700 字重 + 主题色 textShadow 发光）
4. 右侧：迷你仪表盘或图标
5. 底部：1px 渐变光线（transparent → 主题色 → transparent）
6. 支持 blink 属性（告警时整体 pulse 动画）
7. 用 CSS variables，支持任意主题色

请输出完整 TypeScript React 组件代码。
```

### 模板 D：让 AI 审查你的 UI

```
请审查我这个 React 组件的视觉设计，从以下维度打分（1-10）：
1. 视觉层次是否清晰
2. 信息密度是否合理
3. 交互反馈是否及时
4. 暗色主题一致性
5. 科技感元素运用
6. 无障碍（对比度/聚焦状态）

然后给出具体的改进建议（带代码）。
组件代码：
[粘贴代码]
```

---

## 二十三、避坑指南

| 坑 | 症状 | 解决方案 |
|----|------|---------|
| **backdrop-filter 不生效** | 毛玻璃变纯色 | 确保父元素有背景色（不能是 transparent），Safari 加 `-webkit-backdrop-filter` |
| **发光过多变夜店** | 满屏光晕眼花 | 发光只在 hover/选中/告警时触发，默认状态用 `33` 结尾的透明度（如 `rgba(0,240,255,0.2)`） |
| **等宽字体加载慢** | 数字先跳变后稳定 | 用 `font-display: swap`，fallback 设 `ui-monospace, Consolas` |
| **CSS 变量未生效** | 颜色没变 | 检查 `:root` 是否被正确加载，Tailwind 的 `var()` 语法是否写对 |
| **动画卡顿** | 60fps 掉到 30fps | 避免 `box-shadow` 动画（用 `opacity` 代替），3D 场景减少实时阴影 |
| **文字看不清** | 灰底灰字对比度不足 | 正文至少 `#94a3b8`（WCAG AA），关键数据用 `#e2e8f0` |
| **移动端炸裂** | 网格溢出/字体太小 | 加 `@media (max-width: 768px)` 断点，网格改单列，字号 +2px |
| **打印/截图黑底** | 截图全是黑 | 加 `@media print` 覆盖背景为白，或提供"浅色模式"切换 |
| **客户说"太花哨"** | 餐饮老板不适应 | 准备一个"简洁模式"CSS 类，关闭扫描线/粒子/脉冲，只保留毛玻璃+状态色 |
| **首次加载白屏** | 字体/CSS 加载慢 | 内联关键 CSS 到 index.html，字体用 `preload` |

---

## 附录：改完后的视觉验收清单

逐条打勾，全绿即可出门见客户：

- [ ] 整体深蓝黑底，非纯黑（#0a0e1a 系）
- [ ] 卡片毛玻璃效果可见（半透明 + 模糊）
- [ ] 主色调青蓝（#00f0ff）统一贯穿
- [ ] 状态色：在线绿、移动蓝、工作橙、故障红、充电紫
- [ ] 数字全部等宽字体（JetBrains Mono）
- [ ] 状态点有脉冲动画
- [ ] 卡片 hover 有上浮 + 光晕
- [ ] 选中态有发光边框
- [ ] 告警卡片有等级色条 + 脉冲
- [ ] 3D 场景有星空粒子 + 网格 + 地面光环
- [ ] 播报气泡有渐变 + 声波
- [ ] 登录页有 3D 线框球 + 扫描光
- [ ] 全局有极淡扫描线（不仔细看看不出）
- [ ] 减少动画偏好下所有动效关闭
- [ ] 切换租户后主题色即时变化

---

> **文档版本**：v1.0
> **适用项目**：robot-ops-solo（当前 MVP 状态）
> **预计实施时间**：3-4 小时（按第二十一节顺序）
> **下一步**：实施完成后，录 30 秒演示视频 → 这就是你见 RaaS 合伙人的核心道具
