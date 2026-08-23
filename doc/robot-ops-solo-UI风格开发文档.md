# Robot-Ops-Solo · 深色玻璃拟态 UI 风格开发文档（Neon Glass Task Console）

> **版本**：v1.0 · 2026-08-19
> **适用**：robot-ops-solo 项目 Dashboard / SOP / Alerts / 机器人详情等页面的 UI 重构参考
> **来源**：参考界面（深色主题、黑绿霓虹、半透明玻璃、层叠卡片、时间轴）的风格提炼
> **目标**：把视觉风格抽象为一套可落地 Design System（Design Tokens + 组件规范 + 实现指南），而非照抄界面

---

## 一、风格定位一句话

> **"冷静高效的运维作战室"**：以深色为基底、绿色霓虹为主强调色、玻璃拟态卡片承载信息、层叠与时间轴表达任务/告警的时序关系，整体传达"实时、可信、AI 驱动"的工业运维感。

**设计关键词**：`Dark` · `Neon Green` · `Glassmorphism` · `Layered Cards` · `Timeline` · `Tech-noir Calm`

---

## 二、适用边界（先定"用在哪里"）

| 页面/模块 | 建议风格强度 | 说明 |
|---|---|---|
| 运维总览 Dashboard | ★★★★★ | 主战场，承载卡片墙 + 时间轴 |
| 告警流 / AlertsPage | ★★★★ | 时序列表，适合霓虹状态色 |
| SOP 任务编排 | ★★★★ | 步骤卡片 + 时间轴天然契合 |
| 机器人详情 / TwinPage | ★★★ | 3D 为主、UI 轻量玻璃点缀 |
| 登录 / 租户后台 | ★★ | 保持克制，避免花哨 |
| 对外官网 / 营销页 | ★ | 不建议深色霓虹，另走品牌页 |

**核心原则**：风格服务于"信息密度 + 实时状态"，不做纯炫酷装饰；移动端降级为浅色/普通卡片。

---

## 三、色彩系统（Design Tokens）

### 3.1 基础色板（CSS 变量）

```css
/* src/styles/neon-glass.css */
:root {
  /* 背景（仅 3 层） */
  --ng-bg-base: #0a0f0c;        /* 近黑带极淡绿 */
  --ng-bg-elev1: #101613;       /* 一级抬升 */
  --ng-bg-elev2: #161d18;       /* 二级抬升 */
  --ng-bg-overlay: rgba(16,22,19,.72);  /* 玻璃基底 */

  /* 文字 */
  --ng-text-primary: #e6f2ea;
  --ng-text-secondary: #a8b8ae;
  --ng-text-muted: #6f7d74;

  /* 主强调：霓虹绿 */
  --ng-neon: #39ff8b;
  --ng-neon-soft: #2bd977;
  --ng-neon-glow: 0 0 12px rgba(57,255,139,.45), 0 0 30px rgba(57,255,139,.18);

  /* 功能状态色（低饱和，避免"红绿灯过度"） */
  --ng-status-info: #5ecbff;
  --ng-status-warn: #ffd166;
  --ng-status-error: #ff6b6b;
  --ng-status-ok: #39ff8b;

  /* 线条 / 描边 */
  --ng-border: rgba(255,255,255,.08);
  --ng-border-strong: rgba(57,255,139,.35);

  /* 阴影 */
  --ng-shadow-card: 0 8px 30px rgba(0,0,0,.45);
  --ng-shadow-glass: inset 0 1px 0 rgba(255,255,255,.05);
}
```

### 3.2 使用规则

- 背景**只用 3 层**（base / elev1 / elev2），避免深浅乱飞。
- 霓虹绿**只用于强调**：在线点、进度高亮、主按钮、关键数值；不要把整块卡片涂绿。
- 状态色**优先文本/小圆点/细边框**，大色块仅用于"严重告警"等极少数场景。

---

## 四、材质与质感

1. **玻璃拟态（Glassmorphism）**
   - 半透明背景 + 1px 顶部高光线 + 模糊。
   - 模糊半径建议 `backdrop-filter: blur(14px)`，性能敏感页面（3D 孪生）降级为不模糊。
2. **层叠（Layering）**
   - 任务/告警卡片用"主卡 + 悬浮子卡"表达归属（参考图"项目文档 87%"高亮层）。
   - 层间用 `translateY(-6px)` + 更强阴影表达"浮起"，不要靠大色块。
3. **微动效**
   - 入场：卡片 `fade + slide-up 160ms ease-out`。
   - 状态变化：数值/进度用 `transition: .3s ease`，避免数值跳动。
   - 持续：在线点 `pulse 2s infinite`，告警严重级 `soft-pulse 1.2s infinite`。
4. **不滥用**
   - 不用大范围渐变背景、不用发光文字做正文、不用多个霓虹色共存（绿为主，蓝/黄/红仅状态）。

---

## 五、核心组件规范

### 5.1 玻璃卡片（GlassCard）—— 基础容器

```tsx
// src/components/ui/GlassCard.tsx
import styles from './neon-glass.module.css';

export function GlassCard({
  children, highlight = false, as = 'div', className = '',
}: {
  children: React.ReactNode; highlight?: boolean; as?: 'div' | 'section'; className?: string;
}) {
  const Tag = as;
  return (
    <Tag className={`${styles.glassCard} ${highlight ? styles.highlight : ''} ${className}`}>
      {children}
    </Tag>
  );
}
```

```css
/* neon-glass.module.css */
.glassCard {
  position: relative;
  background: var(--ng-bg-overlay);
  border: 1px solid var(--ng-border);
  border-radius: 14px;
  padding: 16px;
  backdrop-filter: blur(14px);
  -webkit-backdrop-filter: blur(14px);
  box-shadow: var(--ng-shadow-card), var(--ng-shadow-glass);
  color: var(--ng-text-primary);
  transition: transform .2s ease, box-shadow .2s ease, border-color .2s ease;
}
.glassCard:hover { transform: translateY(-2px); border-color: var(--ng-border-strong); }
.glassCard.highlight { border-color: var(--ng-border-strong); box-shadow: var(--ng-neon-glow), var(--ng-shadow-card); }
```

### 5.2 霓虹状态点（StatusDot）

```tsx
// 在线/离线/告警 状态点
export function StatusDot({ status }: { status: 'online' | 'offline' | 'warn' | 'error' }) {
  const map = { online: 'var(--ng-status-ok)', warn: 'var(--ng-status-warn)', error: 'var(--ng-status-error)', offline: 'var(--ng-text-muted)' };
  return <span className="ng-dot" style={{ background: map[status], boxShadow: status === 'online' ? '0 0 8px ' + map.online : 'none' }} />;
}
```

```css
.ng-dot { display:inline-block; width:8px; height:8px; border-radius:50%; animation: ng-pulse 2s infinite; }
@keyframes ng-pulse { 0%,100%{opacity:1} 50%{opacity:.45} }
```

### 5.3 品牌 Badge（NeonBadge）

```tsx
// 复用你已有的 BrandBadge，套玻璃样式
export function NeonBadge({ brand, children }: { brand: string; children?: React.ReactNode }) {
  const colorMap: Record<string,string> = { FANUC: '#e60012', KUKA: '#f5a623', ESTUN: '#39ff8b', YASKAWA: '#5ecbff', UR: '#ffd166', ABB: '#9b8cff' };
  return (
    <span className="ng-badge" style={{ borderColor: colorMap[brand] || 'var(--ng-neon)', color: colorMap[brand] || 'var(--ng-neon)' }}>
      {children || brand}
    </span>
  );
}
```

```css
.ng-badge { display:inline-flex; align-items:center; gap:6px; padding:2px 10px; border:1px solid; border-radius:999px; font-size:12px; background:rgba(255,255,255,.04); }
```

### 5.4 任务/告警时间轴（TaskTimeline）

```tsx
// 竖排时间轴，用于 SOP 步骤 + 告警历史
export function TaskTimeline({ items }: { items: Array<{ time: string; title: string; status: 'done'|'doing'|'todo'|'warn'; desc?: string }> }) {
  return (
    <ol className="ng-timeline">
      {items.map((it, i) => (
        <li key={i} className={`ng-tl-item ng-tl-${it.status}`}>
          <span className="ng-tl-dot" />
          <div className="ng-tl-body">
            <div className="ng-tl-time">{it.time}</div>
            <div className="ng-tl-title">{it.title}</div>
            {it.desc && <div className="ng-tl-desc">{it.desc}</div>}
          </div>
        </li>
      ))}
    </ol>
  );
}
```

```css
.ng-timeline { position:relative; margin:0; padding:0; list-style:none; }
.ng-timeline::before { content:''; position:absolute; left:7px; top:4px; bottom:4px; width:2px; background:linear-gradient(var(--ng-border-strong),transparent); }
.ng-tl-item { position:relative; padding:0 0 14px 26px; }
.ng-tl-dot { position:absolute; left:0; top:4px; width:16px; height:16px; border-radius:50%; border:2px solid var(--ng-neon); background:var(--ng-bg-base); }
.ng-tl-doing .ng-tl-dot { box-shadow:var(--ng-neon-glow); }
.ng-tl-warn .ng-tl-dot { border-color:var(--ng-status-warn); }
.ng-tl-title { font-size:13px; color:var(--ng-text-primary); }
.ng-tl-time { font-size:11px; color:var(--ng-text-muted); }
.ng-tl-desc { font-size:12px; color:var(--ng-text-secondary); margin-top:2px; }
```

### 5.5 进度环（HealthGauge）—— 健康分/完成率

```tsx
// SVG 圆环，stroke-dasharray 驱动
export function HealthGauge({ value, size = 88, label = '健康分' }: { value: number; size?: number; label?: string }) {
  const r = size / 2 - 8, c = 2 * Math.PI * r, dash = (Math.max(0, Math.min(100, value)) / 100) * c;
  const color = value >= 80 ? 'var(--ng-status-ok)' : value >= 60 ? 'var(--ng-status-warn)' : 'var(--ng-status-error)';
  return (
    <div className="ng-gauge" style={{ width: size, height: size }}>
      <svg width={size} height={size}>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="rgba(255,255,255,.1)" strokeWidth="6" />
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth="6" strokeLinecap="round"
          strokeDasharray={`${dash} ${c}`} transform={`rotate(-90 ${size/2} ${size/2})`} style={{ transition: 'stroke-dasharray .4s ease' }} />
      </svg>
      <div className="ng-gauge-val" style={{ color }}>{value}</div>
      <div className="ng-gauge-label">{label}</div>
    </div>
  );
}
```

```css
.ng-gauge { position:relative; display:inline-flex; align-items:center; justify-content:center; }
.ng-gauge-val { position:absolute; font-size:22px; font-weight:700; }
.ng-gauge-label { position:absolute; bottom:6px; font-size:10px; color:var(--ng-text-muted); }
```

---

## 六、页面级组合示例（Dashboard 布局）

```tsx
// src/pages/Dashboard/Dashboard.tsx（风格化骨架）
import { GlassCard } from '@/components/ui/GlassCard';
import { StatusDot } from '@/components/ui/StatusDot';
import { NeonBadge } from '@/components/ui/NeonBadge';
import { TaskTimeline } from '@/components/ui/TaskTimeline';
import { HealthGauge } from '@/components/ui/HealthGauge';

export default function Dashboard() {
  return (
    <div className="ng-page">
      <header className="ng-page-header">
        <h1>运维总览</h1>
        <div className="ng-stats">
          <GlassCard><b>2/6</b><span>在线机器人</span></GlassCard>
          <GlassCard><b>1</b><span>活跃告警</span></GlassCard>
          <GlassCard><b>87%</b><span>任务完成率</span></GlassCard>
        </div>
      </header>

      <section className="ng-grid">
        <GlassCard highlight>
          <NeonBadge brand="FANUC">FANUC_M20iD_001</NeonBadge>
          <StatusDot status="warn" />
          <p>2 轴温度偏高 67°C · SRVO-023</p>
          <HealthGauge value={54} label="健康分" />
        </GlassCard>

        <GlassCard>
          <NeonBadge brand="KUKA">KUKA_KR210_002</NeonBadge>
          <StatusDot status="online" />
          <p>制动器温度监控触发 · 已派单</p>
          <HealthGauge value={82} label="健康分" />
        </GlassCard>
      </section>

      <section className="ng-timeline-section">
        <GlassCard>
          <h2>近期告警 / 任务</h2>
          <TaskTimeline items={[
            { time: '10:24', title: 'KUKA_KR210_002 制动器温度预警', status: 'doing', desc: '已通知设备科长' },
            { time: '09:51', title: 'FANUC_M20iD_001 SRVO-023 过热', status: 'warn', desc: '建议 2 轴减速机检查' },
            { time: '08:30', title: 'ESTUN_ER3A_001 定期保养到期', status: 'todo' },
          ]} />
        </GlassCard>
      </section>
    </div>
  );
}
```

```css
.ng-page { background: var(--ng-bg-base); min-height:100vh; color:var(--ng-text-primary); padding:20px; }
.ng-page-header h1 { font-size:24px; }
.ng-stats { display:flex; gap:12px; }
.ng-stats .glassCard { padding:12px 16px; }
.ng-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(320px,1fr)); gap:16px; margin:16px 0; }
.ng-timeline-section { max-width:720px; }
```

---

## 七、SOP 步骤卡（层叠样式）

```tsx
// src/components/sop/SopStepCard.tsx
export function SopStepCard({ step, active, done }: { step: number; active?: boolean; done?: boolean; title: string; desc?: string }) {
  return (
    <GlassCard highlight={active} className={`ng-sop-step ${done ? 'is-done' : ''}`}>
      <div className="ng-sop-head">
        <span className="ng-sop-no">{done ? '✓' : step}</span>
        <span className="ng-sop-title">{title}</span>
        <StatusDot status={done ? 'online' : active ? 'doing' : 'todo'} />
      </div>
      {desc && <p className="ng-sop-desc">{desc}</p>}
    </GlassCard>
  );
}
```

```css
.ng-sop-step { margin-bottom:10px; }
.ng-sop-head { display:flex; align-items:center; gap:10px; }
.ng-sop-no { width:22px; height:22px; border-radius:50%; display:inline-flex; align-items:center; justify-content:center; background:var(--ng-neon); color:#001; font-weight:700; font-size:12px; }
.ng-sop-step.is-done .ng-sop-no { background:var(--ng-status-ok); }
```

---

## 八、动效规范（motion.md 摘录）

| 场景 | 动效 | 时长 | 说明 |
|---|---|---|---|
| 卡片入场 | `fade + slide-up` | 160ms | 列表/卡片首次出现 |
| 悬停浮起 | `translateY(-2px)` + 边框高亮 | 200ms | 可点击卡片 |
| 数值变化 | `transition` | 300ms | 健康分/进度环 |
| 在线点 | `pulse` | 2s 循环 | 仅小圆点，不闪整卡 |
| 严重告警 | `soft-pulse` + 边框泛红 | 1.2s 循环 | 仅告警卡，不滥用 |
| 页面切换 | `fade` | 200ms | React Router 过渡 |

```css
@keyframes ng-soft-pulse { 0%,100%{ box-shadow:0 0 0 0 rgba(255,107,107,.0) } 50%{ box-shadow:0 0 0 6px rgba(255,107,107,.18) } }
.ng-tl-error { animation: ng-soft-pulse 1.2s infinite; }
```

---

## 九、暗色/亮色与移动端降级

- **默认主题**：深色霓虹（本文）。
- **系统偏好**：尊重 `prefers-color-scheme`，亮色模式降级为浅灰底 + 绿色主色 + 无玻璃模糊。
- **移动端（<768px）**：
  - 关闭 `backdrop-filter`（性能 + 可读性）。
  - 卡片单列堆叠，时间轴缩进减小。
  - 霓虹发光仅保留状态点，去掉卡片 glow。

```css
@media (prefers-color-scheme: light) {
  :root { --ng-bg-base:#f4f6f5; --ng-bg-overlay:rgba(255,255,255,.85); --ng-text-primary:#14301f; --ng-text-secondary:#3d5547; --ng-text-muted:#7c8a80; --ng-border:rgba(0,0,0,.08); }
}
@media (max-width: 768px) {
  .glassCard { backdrop-filter: none; -webkit-backdrop-filter: none; }
}
```

---

## 十、落地优先级（建议开发顺序）

| 优先级 | 内容 | 说明 |
|---|---|---|
| P0 | 引入 `neon-glass.css`（CSS 变量）+ `GlassCard` | 全站风格底座，1 天 |
| P0 | `StatusDot` + `NeonBadge` 替换现有状态/品牌展示 | 即时统一视觉语言 |
| P1 | `TaskTimeline` 用于 AlertsPage + SOP 页 | 时序信息立竿见影 |
| P1 | `HealthGauge` 用于机器人详情/卡片 | 健康分可视化 |
| P2 | Dashboard 深色布局 + 层叠卡片重构 | 需要设计走查 |
| P2 | 动效 + 亮色/移动端降级 | 体验打磨 |

---

## 十一、风险与边界

- **可读性优先**：深色 + 低对比文字是常见翻车点，务必用 `--ng-text-secondary` 而非纯灰。
- **性能**：`backdrop-filter` 在低端设备/3D 孪生页有成本，按需降级。
- **品牌色冲突**：品牌 Badge 用各品牌主色时，避免在同卡大面积撞色，仅描边+文字着色。
- **"科技感"不等于"信息密度低"**：卡片仍要承载数据（数值、状态、时间），不沦为纯装饰。
- **一致性**：风格由 Design Tokens 集中控制，禁止在组件内硬编码 `#39ff8b` 等色值。

---

## 十二、文件落位建议（对应你现有架构）

```
packages/
├── ui-kit/                          # 新增：风格组件库（可独立复用）
│   └── src/
│       ├── components/
│       │   ├── GlassCard.tsx
│       │   ├── StatusDot.tsx
│       │   ├── NeonBadge.tsx
│       │   ├── TaskTimeline.tsx
│       │   └── HealthGauge.tsx
│       └── styles/
│           ├── neon-glass.css       # CSS 变量 Tokens
│           └── neon-glass.module.css
└── web-console/
    └── src/
        ├── pages/Dashboard/Dashboard.tsx   # 改：套 GlassCard + 时间轴
        ├── pages/SopPage/SopStepCard.tsx   # 改：层叠步骤卡
        └── pages/AlertsPage/AlertsPage.tsx # 改：TaskTimeline 替换列表
```

---

*文档版本：v1.0 | 2026-08-19 | 用于 robot-ops-solo UI 风格统一与 Dashboard/SOP/Alerts 重构参考*
