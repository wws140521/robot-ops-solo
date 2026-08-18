# Robot-Ops-Solo 科技感 UI 优化参考文档

> 一份给你和 AI 共同使用的"视觉语言字典"——知道参考谁、偷什么、怎么下指令。

---

## 目录

- [一、核心参考网站清单（8 个必看）](#一核心参考网站清单)
- [二、按页面精准对标](#二按页面精准对标)
- [三、设计语言总纲](#三设计语言总纲)
- [四、配色系统（CSS 变量）](#四配色系统)
- [五、字体规范](#五字体规范)
- [六、动效原则](#六动效原则)
- [七、组件视觉规范](#七组件视觉规范)
- [八、给 AI 的 Prompt 模板](#八给-ai-的-prompt-模板)
- [九、避坑清单](#九避坑清单)
- [十、每日审美训练](#十每日审美训练)

---

## 一、核心参考网站清单

把这 8 个站加进书签，**每天打开看一眼**，审美会自然向科技感靠拢。

| # | 网站 | URL | 核心偷学点 | 用于你的哪个模块 |
|---|------|-----|-----------|----------------|
| 1 | **Vercel** | vercel.com | 暗色渐变光晕、双 CTA、极简 hero | Dashboard 总览页 |
| 2 | **Railway** | railway.app | 终端邻近美学、密集数据布局 | 机器人卡片网格 |
| 3 | **Resend** | resend.com | 代码即主视觉、单色克制 | Login 登录页 |
| 4 | **Midjourney** | midjourney.com | Gallery-forward、产品自己说话 | TwinPage 3D 大屏 |
| 5 | **LobsterBoard** | lobsterboard.com | 毛玻璃 widget 堆叠、实时流 | Dashboard KPI 卡片 |
| 6 | **PostHog** | posthog.com | 品牌个性 + 技术深度并存 | AlertsPage 告警流 |
| 7 | **Clay** | clay.com | 可识别视觉世界、差异化节点 | SopPage 画布节点 |
| 8 | **Plausible** | plausible.io | 对比定位、极简暗色 | TenantsPage 租户页 |

### 辅助参考（后台结构，不抄审美）

| 系统 | 参考点 | 别抄的点 |
|------|--------|----------|
| Cool-Admin | AI 工作流编排结构 | 蓝白传统配色 |
| N Admin (Next.js 16) | RBAC 权限 + 命令搜索 | 企业级密集表单 |
| 芋道管理后台 (Vue3) | SaaS 多租户模块划分 | Element Plus 默认风 |
| CatchAdmin | 代码生成器交互 | PHP 后台传统布局 |

---

## 二、按页面精准对标

### 2.1 Dashboard 总览页

**参考组合：Vercel 光晕 + Railway 密度 + LobsterBoard widget**

| 区域 | 偷谁 | 具体做法 |
|------|------|---------|
| Hero/KPI 区 | Vercel | 暗色底 + 中央柔和光晕（radial-gradient, opacity 0.15）+ 大号等宽数字跳动 |
| 双 CTA 按钮 | Vercel | 主按钮"进入控制台"（青蓝渐变）+ 次按钮"预约演示"（幽灵按钮，仅边框） |
| 机器人卡片网格 | Railway + LobsterBoard | 密集排列、毛玻璃卡片、终端感数据展示 |
| 实时数据刷新 | LobsterBoard | SSE/WS 推送、数字更新时绿色闪烁 200ms |
| 底部状态栏 | Railway | 连接状态点 + 最后同步时间 + 版本号 |

**Prompt 模板：**
```
参考 Vercel 的暗色渐变光晕 + Railway 的终端邻近美学 + LobsterBoard 的毛玻璃 widget 堆叠。
Dashboard 顶部是 4 个 KPI 卡片（在线设备数/今日告警数/任务完成率/平均电量），
每个数字用 JetBrains Mono，更新时有 countUp 动画 + 绿色闪烁。
整体暗色底 #0a0e1a，卡片 rgba(16,23,42,0.6) + backdrop-blur(12px)，
主色 #00f0ff，hover 时边框发光。
```

### 2.2 TwinPage 数字孪生大屏

**参考组合：Midjourney gallery + OpenClaw 像素办公室 + Signal Dashboard**

| 区域 | 偷谁 | 具体做法 |
|------|------|---------|
| 3D 画布主体 | Midjourney | 产品自己说话——机器人 3D 模型是主角，HUD 叠加层克制 |
| 趣味化呈现 | OpenClaw Bot Review | 机器人状态可视化变成"养宠物"体验——在线=走路、充电=睡觉、告警=冒汗 |
| 四角 HUD 数据 | Signal Dashboard | 左上身份(青色等宽) + 右上坐标(JetBrains Mono) + 左下 CSS 雷达 + 右下状态机流程图 |
| 告警跑马灯 | Signal Dashboard | 底部横向滚动，霓虹绿/红色，新告警从右侧滑入 |
| 全屏边框 | 通用 Cyberpunk | 内阴影 + 极淡青色扫描线循环 |

**Prompt 模板：**
```
参考 Midjourney 的 gallery-forward 设计（让 3D 模型自己说话）+ Signal Dashboard 的终端美学。
Canvas 占满全屏，背景深蓝黑 #0a0e1a。
四角 HUD 叠加层用 pointer-events-none，等宽字体 JetBrains Mono，
青色 #00f0ff 发光文字。左下角一个纯 CSS 雷达扫描动画（conic-gradient 旋转）。
底部告警跑马灯红色背景，新告警 slideInRight 300ms。
```

### 2.3 SopPage 编排画布

**参考组合：Clay 视觉差异化 + Replit 产品演示感**

| 节点类型 | 形状 | 边框色 | 图标 | 动效 |
|---------|------|--------|------|------|
| MoveNode | 菱形 | 青蓝 #00f0ff | 箭头 | hover 时箭头左右移动 |
| SpeakNode | 圆角矩形 | 紫色 #7b61ff | 喇叭 | 3 条竖线声波动画 |
| WaitNode | 圆形 | 橙色 #ff8c42 | 时钟 | 中间秒数倒计时 |
| LoopNode | 六边形 | 绿色 #00e676 | 循环箭头 | 箭头旋转动画 |
| ConditionNode | 菱形 | 黄色 #ffd600 | 问号 | true/false 出口分色 |

**通用规则：**
- 背景半透明 + backdrop-blur
- 选中时边框发光（对应颜色）+ 轻微上浮 scale(1.02)
- 连线渐变色（从源节点色到目标节点色）
- 画布背景：极淡网格线 + 中央一个巨大的半透明 logo 水印

**Prompt 模板：**
```
参考 Clay.com 的视觉差异化（每种节点形状/颜色/图标都不同，一眼区分）+
Replit 的产品演示感（画布本身就是最好的营销）。
用 @xyflow/react 实现，自定义 5 个节点组件 + 1 个渐变 Edge 组件。
所有节点选中时边框发光对应颜色，连线用 linear-gradient stroke。
```

### 2.4 AlertsPage 告警流

**参考组合：PostHog 品牌个性 + Signal Dashboard 终端感**

| 元素 | 做法 |
|------|------|
| 顶部统计条 | 3 个数字：今日告警/已处理/未处理，等宽字体，告警级用红/橙/黄/蓝四级 |
| 等级筛选芯片 | 胶囊按钮组，选中时填充对应颜色 + 数字角标 |
| 告警卡片 | 左侧 4px 色条（红=critical, 橙=warning, 蓝=info）+ 背景微光渐变 + 未读脉冲点 |
| 时间线视图 | 可选切换"卡片/时间线"，时间线用中央竖线 + 左右交错卡片 |
| 搜索框 | 等宽字体 placeholder，实时过滤，无结果时显示机器人 ASCII 表情 |

**Prompt 模板：**
```
参考 PostHog 的个性设计 + Signal Dashboard 的终端美学。
告警卡片左侧 4px 色条表示等级，背景是 rgba(16,23,42,0.6) + backdrop-blur。
未读告警右上角一个红色脉冲点（CSS keyframes pulse）。
搜索框用 JetBrains Mono，placeholder "搜索告警码 / 机器人 ID / 关键词..."。
```

### 2.5 Login 登录页

**参考组合：Resend 代码即主视觉 + Vercel 光晕**

| 元素 | 做法 |
|------|------|
| 背景 | 3D 线框球缓慢旋转（@react-three/fiber，wireframe material） |
| 中央卡片 | 毛玻璃 + 1px 青色边框 + 内部微妙径向渐变 |
| 标题 | "RobotOps Console" 等宽字体 + 字母间距 0.15em + 青色发光 text-shadow |
| 输入框 | 无边框，仅底部 1px 线，focus 时线变亮 + 左侧出现 4px 青色竖条 |
| 登录按钮 | 青→紫渐变背景，hover 时扫描光效从左到右划过（::after + translateX） |
| 底部 | 版本号 + "Powered by robot-adapter-kit" 灰色小字 |

**Prompt 模板：**
```
参考 Resend.com 的代码即主视觉 + Vercel 的暗色光晕。
背景一个 @react-three/fiber 线框球（wireframe sphereGeometry, 缓慢旋转）。
中央登录卡片 380px 宽，毛玻璃 + 青色边框发光。
输入框只用底部线条，focus 时左侧出现青色竖条。
按钮青→紫渐变 + hover 扫描光效。
```

### 2.6 TenantsPage 租户/贴牌页

**参考组合：Plausible 对比定位 + Vercel 卡片**

| 元素 | 做法 |
|------|------|
| 租户卡片 | 顶部 4px 品牌色条 + Logo 发光 + 名称等宽字体 + 激活态青色边框 |
| 贴牌预览 | 右侧实时预览区，切换租户时整个预览区变色（CSS 变量动态切换） |
| 配色选择器 | 3 套预设（青蓝/紫橙/绿金）+ 自定义色 picker |
| 激活状态 | 当前租户卡片有青色光晕 + "ACTIVE" 标签 + 脉冲点 |

---

## 三、设计语言总纲

### 3.1 五大设计原则

| 原则 | 含义 | 反例 |
|------|------|------|
| **数据自己发光** | 让数字/状态成为视觉焦点，而非装饰 | 用大号 emoji 当图标 |
| **克制即高级** | 发光/动效只在"变化时刻"触发 | 满屏都在闪 |
| **等宽即科技** | 数字/状态码/坐标用 JetBrains Mono | 数字用圆体 |
| **毛玻璃即层次** | 半透明 + blur 制造深度，不用阴影堆砌 | 卡片加 10px 黑色阴影 |
| **暗色即专业** | 深蓝黑底，不用纯黑 | 纯黑 #000 背景 |

### 3.2 设计风格定位

```
你的中台 = Fluent Glass（框架） + HUD（数据区） + Cyberpunk（3D 大屏）

┌─────────────────────────────────────────┐
│  Sidebar (Fluent Glass 毛玻璃)           │
│  ┌─────────────────────────────────────┐ │
│  │  Dashboard  (HUD 数据卡片)          │ │
│  │  ┌────┐ ┌────┐ ┌────┐ ┌────┐      │ │
│  │  │KPI1│ │KPI2│ │KPI3│ │KPI4│      │ │
│  │  └────┘ └────┘ └────┘ └────┘      │ │
│  ├─────────────────────────────────────┤ │
│  │  TwinPage   (Cyberpunk 3D 大屏)     │ │
│  │  ████████████████████████████████   │ │
│  │  █████ HUD overlay ██████████████   │ │
│  │  ████████████████████████████████   │ │
│  ├─────────────────────────────────────┤ │
│  │  SopPage    (Fluent Glass 画布)     │ │
│  │  ◆ ── ● ── ○ ── ⬡ ── ◇           │ │
│  └─────────────────────────────────────┘ │
└─────────────────────────────────────────┘
```

---

## 四、配色系统

### 4.1 CSS 变量（直接复制进 globals.css）

```css
:root {
  /* ===== 背景层级 ===== */
  --bg-base:        #0a0e1a;   /* 最底层背景 */
  --bg-surface:     #0f1525;   /* 卡片/面板底 */
  --bg-elevated:    #141b2e;   /* 弹出层/模态 */
  --bg-overlay:     rgba(16, 23, 42, 0.6);  /* 毛玻璃卡片 */

  /* ===== 边框 ===== */
  --border-subtle:  rgba(0, 240, 255, 0.08);
  --border-base:    rgba(0, 240, 255, 0.15);
  --border-hover:   rgba(0, 240, 255, 0.40);
  --border-focus:   rgba(0, 240, 255, 0.60);

  /* ===== 文字 ===== */
  --text-primary:   #e2e8f0;   /* 不用纯白 */
  --text-secondary: #94a3b8;
  --text-muted:     #64748b;
  --text-disabled:  #475569;

  /* ===== 强调色（霓虹三色） ===== */
  --accent-cyan:    #00f0ff;   /* 主色：青蓝霓虹 */
  --accent-purple:  #7b61ff;   /* 辅色：紫 */
  --accent-green:   #00e676;   /* 正常/成功 */
  --accent-orange:  #ff8c42;   /* 警告 */
  --accent-red:     #ff3d71;   /* 错误/告警 */
  --accent-yellow:  #ffd600;   /* 条件/注意 */

  /* ===== 状态色（语义化） ===== */
  --status-online:    #00e676;
  --status-offline:   #64748b;
  --status-warning:   #ff8c42;
  --status-error:     #ff3d71;
  --status-busy:      #7b61ff;

  /* ===== 阴影/发光 ===== */
  --glow-cyan:       0 0 12px rgba(0, 240, 255, 0.4);
  --glow-cyan-strong: 0 0 24px rgba(0, 240, 255, 0.6);
  --glow-purple:     0 0 12px rgba(123, 97, 255, 0.4);
  --glow-green:      0 0 8px rgba(0, 230, 118, 0.5);
  --glow-red:        0 0 12px rgba(255, 61, 113, 0.5);
  --shadow-card:      0 4px 16px rgba(0, 0, 0, 0.4);

  /* ===== 字体 ===== */
  --font-sans:       'Inter', system-ui, sans-serif;
  --font-mono:       'JetBrains Mono', 'Fira Code', ui-monospace, monospace;
  --font-display:    'Space Grotesk', 'Inter', sans-serif;

  /* ===== 动效时长 ===== */
  --dur-fast:        150ms;
  --dur-base:        250ms;
  --dur-slow:        400ms;
  --dur-slower:      600ms;
  --ease-out:        cubic-bezier(0.16, 1, 0.3, 1);
  --ease-in-out:      cubic-bezier(0.65, 0, 0.35, 1);

  /* ===== 圆角 ===== */
  --radius-sm:        4px;
  --radius-md:        8px;
  --radius-lg:        12px;
  --radius-xl:        16px;
  --radius-full:      9999px;

  /* ===== 间距 ===== */
  --space-1:          4px;
  --space-2:          8px;
  --space-3:          12px;
  --space-4:          16px;
  --space-6:          24px;
  --space-8:          32px;
  --space-12:         48px;
}
```

### 4.2 贴牌换肤变量（每个租户覆盖）

```css
/* 租户 A：青蓝主题（默认） */
[data-tenant="default"] {
  --brand-primary:   #00f0ff;
  --brand-secondary: #7b61ff;
  --brand-glow:      0 0 12px rgba(0, 240, 255, 0.4);
}

/* 租户 B：橙紫主题 */
[data-tenant="hotpot-king"] {
  --brand-primary:   #ff8c42;
  --brand-secondary: #e91e63;
  --brand-glow:      0 0 12px rgba(255, 140, 66, 0.4);
}

/* 租户 C：绿金主题 */
[data-tenant="green-feast"] {
  --brand-primary:   #00e676;
  --brand-secondary: #ffd600;
  --brand-glow:      0 0 12px rgba(0, 230, 118, 0.4);
}
```

### 4.3 Tailwind 配置映射

```js
// tailwind.config.js
module.exports = {
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        base:    'var(--bg-base)',
        surface: 'var(--bg-surface)',
        elevated:'var(--bg-elevated)',
        cyan:    { DEFAULT: 'var(--accent-cyan)', glow: 'var(--glow-cyan)' },
        purple:  { DEFAULT: 'var(--accent-purple)' },
        green:   { DEFAULT: 'var(--accent-green)' },
        orange:  { DEFAULT: 'var(--accent-orange)' },
        red:     { DEFAULT: 'var(--accent-red)' },
        yellow:  { DEFAULT: 'var(--accent-yellow)' },
      },
      fontFamily: {
        sans: ['var(--font-sans)'],
        mono: ['var(--font-mono)'],
        display: ['var(--font-display)'],
      },
      borderRadius: {
        sm: 'var(--radius-sm)',
        md: 'var(--radius-md)',
        lg: 'var(--radius-lg)',
        xl: 'var(--radius-xl)',
      },
      boxShadow: {
        'glow-cyan': 'var(--glow-cyan)',
        'glow-purple': 'var(--glow-purple)',
        'glow-green': 'var(--glow-green)',
        'glow-red': 'var(--glow-red)',
      },
      backdropBlur: { xs: '2px', sm: '4px', md: '12px', lg: '20px' },
      keyframes: {
        pulse:    { '0%,100%':{opacity:1}, '50%':{opacity:0.4} },
        scanline: { '0%':{transform:'translateY(-100%)'}, '100%':{transform:'translateY(100vh)'} },
        slideInRight:{ '0%':{transform:'translateX(100%)',opacity:0}, '100%':{transform:'translateX(0)',opacity:1} },
        countUp:  { '0%':{transform:'translateY(10px)',opacity:0}, '100%':{transform:'translateY(0)',opacity:1} },
        radar:    { '0%':{transform:'rotate(0deg)'}, '100%':{transform:'rotate(360deg)'} },
        waveform: { '0%,100%':{transform:'scaleY(0.5)'}, '50%':{transform:'scaleY(1.2)'} },
      },
      animation: {
        pulse:    'pulse 2s ease-in-out infinite',
        scanline: 'scanline 8s linear infinite',
        slideInRight:'slideInRight 300ms ease-out',
        countUp:  'countUp 400ms ease-out',
        radar:    'radar 4s linear infinite',
        waveform: 'waveform 1s ease-in-out infinite',
      },
    },
  },
}
```

---

## 五、字体规范

### 5.1 字体选择

| 用途 | 字体 | 加载方式 | 备选 |
|------|------|---------|------|
| 正文/UI 文本 | Inter | Google Fonts | system-ui |
| 数字/状态码/坐标 | JetBrains Mono | Google Fonts | Fira Code / ui-monospace |
| 标题/品牌名 | Space Grotesk | Google Fonts | Outfit / Manrope |
| 中文正文 | 思源黑体 / 系统 | 系统默认 | "PingFang SC", "Microsoft YaHei" |

### 5.2 加载代码（Next.js 示例）

```tsx
// app/layout.tsx 或 pages/_app.tsx
import { Inter, JetBrains_Mono, Space_Grotesk } from 'next/font/google'

const inter = Inter({ subsets: ['latin'], variable: '--font-sans' })
const jetbrains = JetBrains_Mono({ subsets: ['latin'], variable: '--font-mono' })
const spaceGrotesk = Space_Grotesk({ subsets: ['latin'], variable: '--font-display' })

export default function RootLayout({ children }) {
  return (
    <html className={`${inter.variable} ${jetbrains.variable} ${spaceGrotesk.variable}`}>
      <body className="font-sans bg-base text-primary">{children}</body>
    </html>
  )
}
```

### 5.3 字体使用规则

```
JetBrains Mono 用于：
  ✅ 机器人 ID（"G1-001"）
  ✅ 坐标 (x: 3.2, y: 1.8, θ: 45°)
  ✅ 电量百分比 "85%"
  ✅ 状态码 "IDLE" / "MOVING" / "ERROR"
  ✅ 告警码 "BATT_LOW_20"
  ✅ 时间戳 "14:32:05.123"
  ✅ 版本号 "v1.2.3"

Inter 用于：
  ✅ 正文段落
  ✅ 按钮文字
  ✅ 菜单项
  ✅ 描述文字

Space Grotesk 用于：
  ✅ 页面大标题
  ✅ 品牌名
  ✅ KPI 数字（大号）
```

---

## 六、动效原则

### 6.1 核心原则：变化时刻才动

| 场景 | 动效 | 时长 | 触发条件 |
|------|------|------|---------|
| 页面进入 | fadeInUp | 400ms | 路由切换 |
| 数据刷新 | 数字绿色闪烁 | 200ms | WS 推送新值 |
| 卡片 hover | 上浮 2px + 边框发光 | 150ms | 鼠标悬停 |
| 节点选中 | 边框发光 + scale(1.02) | 200ms | 点击选中 |
| 告警到达 | slideInRight + 红色脉冲 | 300ms | 新告警推送 |
| 模态弹窗 | fadeIn + scale(0.95→1) | 250ms | 打开弹窗 |
| 加载状态 | 骨架屏脉冲 | 1.5s 循环 | 数据加载中 |
| 雷达扫描 | conic-gradient 旋转 | 4s 循环 | 持续展示 |

### 6.2 禁止事项

| ❌ 不要做 | 为什么 |
|----------|--------|
| 满屏同时动画 | 视觉噪音，像杀马特网页 |
| 发光常驻 | 发光是"信号"，常驻=没信号 |
| 弹跳/弹性动画 | 不专业，像儿童 App |
| 旋转 360° 的 loading | 太 2015，用骨架屏替代 |
| 自动播放的音频 | 用户会立刻关闭页面 |
| 全屏粒子满天飞 | 像屏保，不是中台 |

### 6.3 推荐动效库

| 库 | 用途 | 体积 | 推荐度 |
|----|------|------|--------|
| **framer-motion** | 组件动画/布局动画/手势 | ~30KB | ⭐⭐⭐⭐⭐ |
| **CSS keyframes** | 简单循环动画（脉冲/扫描/雷达） | 0KB | ⭐⭐⭐⭐⭐ |
| **lottie-react** | 复杂矢量动画（机器人走路/充电） | ~50KB | ⭐⭐⭐⭐ |
| **tsparticles** | 背景粒子（星空/数据流） | ~100KB | ⭐⭐⭐ |
| **three.js / R3F** | 3D 场景 | ~150KB | ⭐⭐⭐⭐⭐（3D 页专用） |

---

## 七、组件视觉规范

### 7.1 通用卡片（所有页面复用）

```tsx
// components/ui/Card.tsx
interface CardProps {
  glow?: 'cyan' | 'purple' | 'green' | 'red' | 'orange' | 'yellow' | 'none'
  cornerMark?: boolean  // HUD 四角 L 形角标
  children: React.ReactNode
}

export function Card({ glow = 'cyan', cornerMark = false, children }: CardProps) {
  const glowMap = {
    cyan: 'shadow-glow-cyan hover:shadow-glow-cyan-strong',
    purple: 'shadow-glow-purple',
    green: 'shadow-glow-green',
    red: 'shadow-glow-red',
    orange: '',
    yellow: '',
    none: 'shadow-card',
  }

  return (
    <div
      className={`
        relative bg-overlay backdrop-blur-md
        border border-border-base rounded-lg
        transition-all duration-200 ease-out
        hover:border-border-hover hover:-translate-y-0.5
        ${glowMap[glow]}
      `}
    >
      {cornerMark && (
        <>
          {/* 左上角标 */}
          <span className="absolute top-0 left-0 w-2 h-2 border-l border-t border-cyan rounded-tl-lg" />
          {/* 右上角标 */}
          <span className="absolute top-0 right-0 w-2 h-2 border-r border-t border-cyan rounded-tr-lg" />
          {/* 左下角标 */}
          <span className="absolute bottom-0 left-0 w-2 h-2 border-l border-b border-cyan rounded-bl-lg" />
          {/* 右下角标 */}
          <span className="absolute bottom-0 right-0 w-2 h-2 border-r border-b border-cyan rounded-br-lg" />
        </>
      )}
      {children}
    </div>
  )
}
```

### 7.2 状态指示灯（全站复用）

```tsx
// components/ui/StatusDot.tsx
type Status = 'online' | 'offline' | 'warning' | 'error' | 'busy'

const statusMap: Record<Status, { color: string; pulse: boolean; label: string }> = {
  online:  { color: 'bg-green text-green',  pulse: true,  label: '在线' },
  offline: { color: 'bg-gray-500',         pulse: false, label: '离线' },
  warning: { color: 'bg-orange',           pulse: true,  label: '警告' },
  error:   { color: 'bg-red',             pulse: true,  label: '错误' },
  busy:    { color: 'bg-purple',           pulse: false, label: '工作中' },
}

export function StatusDot({ status }: { status: Status }) {
  const s = statusMap[status]
  return (
    <span className="inline-flex items-center gap-2">
      <span
        className={`
          inline-block w-2 h-2 rounded-full
          ${s.color}
          ${s.pulse ? 'animate-pulse' : ''}
          shadow-glow-green
        `}
      />
      <span className="text-xs text-secondary font-mono">{s.label}</span>
    </span>
  )
}
```

### 7.3 分段能量条（电量显示）

```tsx
// components/ui/SegmentedBar.tsx
export function SegmentedBar({
  value, max = 100, segments = 10, color = 'cyan'
}: {
  value: number; max?: number; segments?: number; color?: 'cyan' | 'green' | 'orange' | 'red'
}) {
  const pct = value / max
  const filled = Math.round(pct * segments)

  const colorMap = {
    cyan:   'bg-cyan shadow-glow-cyan',
    green:  'bg-green shadow-glow-green',
    orange: 'bg-orange',
    red:    'bg-red shadow-glow-red animate-pulse',
  }

  // 低电量时整体变红
  const effectiveColor = pct < 0.2 ? 'red' : pct < 0.5 ? 'orange' : color
  const c = colorMap[effectiveColor as keyof typeof colorMap]

  return (
    <div className="flex gap-0.5">
      {Array.from({ length: segments }).map((_, i) => (
        <div
          key={i}
          className={`
            h-2 w-4 rounded-sm transition-all duration-300
            ${i < filled ? c : 'bg-gray-700'}
          `}
        />
      ))}
    </div>
  )
}
```

### 7.4 扫描线按钮

```tsx
// components/ui/ScanButton.tsx
export function ScanButton({
  children, variant = 'primary', onClick
}: {
  children: React.ReactNode
  variant?: 'primary' | 'ghost'
  onClick?: () => void
}) {
  if (variant === 'ghost') {
    return (
      <button
        onClick={onClick}
        className="
          px-6 py-2 rounded-md border border-cyan text-cyan font-mono text-sm
          hover:bg-cyan/10 hover:shadow-glow-cyan transition-all duration-200
        "
      >
        {children}
      </button>
    )
  }

  return (
    <button
      onClick={onClick}
      className="
        relative overflow-hidden px-6 py-2 rounded-md
        bg-gradient-to-r from-cyan to-purple text-base font-mono font-medium
        hover:shadow-glow-cyan-strong transition-all duration-200
        group
      "
    >
      {/* 扫描光效 */}
      <span className="
        absolute inset-0 -translate-x-full group-hover:translate-x-full
        bg-gradient-to-r from-transparent via-white/20 to-transparent
        transition-transform duration-500 ease-out
      " />
      <span className="relative">{children}</span>
    </button>
  )
}
```

### 7.5 HUD 角标框（3D 大屏用）

```tsx
// components/overlays/HudFrame.tsx
export function HudFrame({ children, position = 'top-left' }: {
  children: React.ReactNode
  position: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'
}) {
  const posMap = {
    'top-left':     'top-4 left-4',
    'top-right':    'top-4 right-4',
    'bottom-left':  'bottom-4 left-4',
    'bottom-right': 'bottom-4 right-4',
  }

  return (
    <div
      className={`
        absolute ${posMap[position]}
        pointer-events-none
        font-mono text-xs text-cyan
        bg-overlay backdrop-blur-sm
        border border-cyan/20 rounded-md
        px-3 py-2
        shadow-glow-cyan/30
      `}
    >
      {children}
    </div>
  )
}
```

### 7.6 CSS 雷达扫描（纯 CSS）

```css
/* globals.css */
.radar {
  position: relative;
  width: 120px;
  height: 120px;
  border-radius: 50%;
  border: 1px solid rgba(0, 240, 255, 0.3);
  overflow: hidden;
}

.radar::before {
  content: '';
  position: absolute;
  inset: 0;
  background: conic-gradient(
    from 0deg,
    rgba(0, 240, 255, 0.4) 0deg,
    transparent 60deg,
    transparent 360deg
  );
  animation: radar 4s linear infinite;
}

.radar::after {
  content: '';
  position: absolute;
  top: 50%;
  left: 50%;
  width: 4px;
  height: 4px;
  background: var(--accent-cyan);
  border-radius: 50%;
  transform: translate(-50%, -50%);
  box-shadow: 0 0 8px var(--accent-cyan);
}

@keyframes radar {
  from { transform: rotate(0deg); }
  to   { transform: rotate(360deg); }
}
```

---

## 八、给 AI 的 Prompt 模板

### 8.1 万能前缀（每次都带）

```
你是一个有 10 年经验的资深前端工程师，精通 React、Three.js、Tailwind CSS 和现代 CSS 动画。
你擅长将企业级中台做成"科技感数据可视化"风格，参考 Vercel、Railway、Resend、LobsterBoard 的视觉语言。

所有代码必须：
- TypeScript 严格模式
- Tailwind CSS 优先，不用 styled-components
- 动画用 CSS keyframes 或 framer-motion，不用 jQuery
- 响应式，但优先桌面端 1920×1080
- 不引入未使用的依赖
- 数字/状态码用 JetBrains Mono 字体
- 背景色 #0a0e1a，卡片用 rgba(16,23,42,0.6) + backdrop-blur(12px)
- 强调色 #00f0ff（青蓝霓虹），辅色 #7b61ff（紫）
- 动画克制：只在 hover/选中/告警/数据刷新时触发
- 不用 emoji，用 Lucide React 图标
- 不用纯白 #fff，用 #e2e8f0
```

### 8.2 全局主题改造

```
请帮我改造这个 React + Tailwind CSS 项目的全局视觉风格：

1. 整体基调：深色科技风（Dark Tech）
2. 背景色：主背景 #0a0e1a，卡片背景 rgba(16,23,42,0.6) + backdrop-blur(12px)
3. 强调色：主色 #00f0ff，辅色 #7b61ff，告警色 #ff3d71，正常色 #00e676
4. 边框：1px solid rgba(0,240,255,0.15)，hover 时 rgba(0,240,255,0.4) + 发光
5. 字体：等宽字体用于数字/状态码（JetBrains Mono），正文用 Inter
6. 动效：页面进入 fadeInUp，数据更新时数字 countUp，卡片 hover 上浮+光晕
7. 装饰：卡片四角 L 形角标，页面背景极淡网格线

请输出修改后的 globals.css 和 tailwind.config.js，以及需要安装的字体/npm 包。
```

### 8.3 单个组件升级

```
我有一个 React 组件 RobotStatusCard.tsx，展示单台机器人的实时状态。
请把它改造成 HUD 军事抬头显示风格：

1. 外框：深蓝半透明背景 + 四角 L 形角标（8px × 2px，青色）
2. 顶部标题栏：左侧脉冲状态点，右侧状态码等宽字体
3. 电量显示：分段能量条（10 段），满电青色，低电红色闪烁
4. 位置坐标：x/y/θ 等宽字体，每秒更新时绿色闪烁
5. 状态标签：idle/moving/error 用不同颜色发光药丸
6. 整体 320×180px，hover 时边框发光增强

输出完整组件代码，使用 Tailwind CSS + CSS keyframes，不引入动画库。
```

### 8.4 3D 大屏 HUD 叠加层

```
我有一个 R3F 数字孪生页面 RobotViewer.tsx，Canvas 渲染机器人 3D 模型。
请在 Canvas 上方叠加 HUD 数据层（绝对定位，pointer-events-none）：

1. 左上角：机器人 ID + 品牌型号，等宽字体，绿色脉冲点
2. 右上角：实时坐标 (x, y, θ) + 电量百分比
3. 左下角：纯 CSS 雷达扫描动画（conic-gradient 旋转）
4. 右下角：状态机流程图（idle → moving → working → idle），当前状态高亮
5. 底部中央：告警跑马灯，新告警从右侧滑入
6. 全屏边框：内阴影 + 极淡青色扫描线循环

所有叠加层用 Tailwind + CSS keyframes，不阻挡 3D 交互。
```

### 8.5 SOP 画布节点美化

```
我使用 @xyflow/react 做 SOP 编排画布。请重新设计 5 种节点视觉：

1. MoveNode：菱形，青蓝边框 + 箭头图标
2. SpeakNode：圆角矩形，紫色边框 + 喇叭图标 + 3 条声波动画
3. WaitNode：圆形，橙色边框 + 时钟图标 + 倒计时
4. LoopNode：六边形，绿色边框 + 循环箭头
5. ConditionNode：菱形，黄色边框 + 问号 + true/false 双色出口

所有节点：半透明 + backdrop-blur + 选中发光 + hover scale(1.02)
连线：从源节点色到目标节点色渐变

输出 5 个节点文件 + 自定义 Edge 组件。
```

### 8.6 登录页

```
帮我设计机器人运维中台登录页：

1. 全屏深色背景 + @react-three/fiber 线框球缓慢旋转
2. 中央登录卡片：毛玻璃 + 1px 青色边框 + 内部径向渐变
3. 标题 "RobotOps Console" 等宽字体 + 字母间距 + 青色发光
4. 输入框：无边框，仅底部 1px 线，focus 时左侧青色竖条
5. 登录按钮：青→紫渐变 + hover 扫描光效
6. 底部：版本号 + "Powered by robot-adapter-kit" 灰色小字
```

### 8.7 AI 代码审查

```
请审查我当前的 UI 代码，找出以下问题并给出修改建议：

1. 哪些地方用了纯白 #fff 应该改成 #e2e8f0
2. 哪些动画过于夸张（duration > 600ms 或无限循环无暂停）
3. 哪些组件缺少 hover/focus 状态
4. 哪些数字/状态码没用等宽字体
5. 哪些地方可以用毛玻璃替代实色背景
6. 哪些 emoji 应该替换成 Lucide 图标

请逐文件列出问题 + 给出修改后的代码片段。
```

---

## 九、避坑清单

### 9.1 视觉陷阱

| ❌ 常见错误 | ✅ 正确做法 |
|------------|-----------|
| 满屏霓虹发光 | 发光只在 hover/选中/告警时触发 |
| 纯黑 #000 背景 | 深蓝黑 #0a0e1a 更有质感 |
| 纯白 #fff 文字 | #e2e8f0 减少刺眼 |
| 所有数字用普通字体 | 数字/状态码统一 JetBrains Mono |
| 卡片用大阴影 | 毛玻璃 + 微光晕更高级 |
| 弹跳/弹性动画 | 用 ease-out 位移，不用 bounce |
| 自动播放背景音乐 | 永远不要 |
| 全屏粒子特效 | 仅登录页背景适度使用 |
| Emoji 当图标 | 用 Lucide React 统一图标 |
| 渐变色用 3 种以上 | 主色+辅色不超过 2 种 |

### 9.2 性能陷阱

| ❌ 不要做 | ✅ 替代方案 |
|----------|-----------|
| 同时 50+ 个 CSS 动画 | 用 IntersectionObserver 按需触发 |
| 3D 场景不限制帧率 | R3F 的 frameloop="demand" 或限制 30fps |
| 告警流无限滚动不回收 | 只保留最近 200 条，虚拟滚动 |
| 每次 WS 推送重渲染全树 | Zustand selector 精准订阅 |
| 毛玻璃 blur > 20px | 12px 是甜点，超过性能骤降 |
| 粒子数 > 100 | tsparticles 限制在 50 以内 |

### 9.3 可访问性

```css
/* 尊重用户减少动画偏好 */
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}

/* 焦点可见性（键盘导航） */
:focus-visible {
  outline: 2px solid var(--accent-cyan);
  outline-offset: 2px;
}
```

---

## 十、每日审美训练

### 10.1 每日 10 分钟（坚持 30 天脱胎换骨）

| 时间 | 动作 | 目的 |
|------|------|------|
| 早上 2 分钟 | 打开 vercel.com，看 10 秒 | 植入"克制即高级" |
| 上午 2 分钟 | 打开 railway.app，看 10 秒 | 植入"终端美学" |
| 下午 2 分钟 | 打开 resend.com，看 10 秒 | 植入"代码即视觉" |
| 晚上 2 分钟 | 打开 midjourney.com，看 10 秒 | 植入"产品自己说话" |
| 睡前 2 分钟 | 看自己项目截图，找 1 个可改进点 | 形成审美肌肉记忆 |

### 10.2 每周一次"审美对标"

每周日花 30 分钟：
1. 截图自己项目当前状态
2. 截图 Vercel/Railway 对应模块
3. 并排对比，列出 3 个差距
4. 下周逐个修复

### 10.3 灵感收藏夹

在 GitHub 建一个 repo `ui-inspiration`，收藏：
- 看到的优秀设计截图
- 好用的 Tailwind 代码片段
- 有趣的 CSS 动效
- 喜欢的配色方案

---

## 附录 A：推荐依赖安装

```bash
# 核心
pnpm add tailwindcss postcss autoprefixer
pnpm add framer-motion
pnpm add lucide-react

# 字体（Next.js）
pnpm add next/font

# 3D（已装则跳过）
pnpm add @react-three/fiber @react-three/drei three

# 可选（按需）
pnpm add lottie-react          # 复杂矢量动画
pnpm add tsparticles @tsparticles/react  # 背景粒子
pnpm add @xyflow/react         # SOP 画布（已装跳过）
```

## 附录 B：文件放置位置

```
robot-ops-solo/
├── apps/
│   └── web-console/
│       ├── src/
│       │   ├── styles/
│       │   │   └── globals.css        ← 复制第四节 CSS 变量
│       │   ├── lib/
│       │   │   └── tailwind.config.js  ← 复制第四节 Tailwind 配置
│       │   ├── components/
│       │   │   ├── ui/                ← 通用组件（Card/Button/Dot/Bar）
│       │   │   │   ├── Card.tsx
│       │   │   │   ├── ScanButton.tsx
│       │   │   │   ├── StatusDot.tsx
│       │   │   │   └── SegmentedBar.tsx
│       │   │   └── overlays/
│       │   │       └── HudFrame.tsx
│       │   └── pages/
│       │       ├── Dashboard.tsx
│       │       ├── TwinPage.tsx
│       │       ├── SopPage.tsx
│       │       ├── AlertsPage.tsx
│       │       ├── Login.tsx
│       │       └── TenantsPage.tsx
```

## 附录 C：验收清单（全绿即可出门见客户）

### 视觉验收
- [ ] 全站背景统一 #0a0e1a，无纯黑区域
- [ ] 全站文字无纯白，正文 #e2e8f0
- [ ] 所有数字/状态码用 JetBrains Mono
- [ ] 卡片统一毛玻璃 + 1px 青色边框
- [ ] hover 状态全部有视觉反馈
- [ ] 无 emoji 图标，全部 Lucide

### 动效验收
- [ ] 数据刷新有视觉反馈（闪烁/跳动）
- [ ] 告警到达有 slideIn 动画
- [ ] 无无限循环动画（除雷达/扫描线）
- [ ] prefers-reduced-motion 时动画关闭
- [ ] 页面切换有 fadeInUp

### 功能验收
- [ ] 3D 大屏 HUD 四角数据实时更新
- [ ] SOP 节点选中发光 + 详情面板
- [ ] 告警流实时推送 + 等级筛选
- [ ] 登录页 3D 背景正常渲染
- [ ] 租户切换时配色实时变化

---

> **一句话**：科技感不是"花哨"，是**让数据自己发光**。Vercel 的光晕 + Railway 的终端感 + Resend 的克制 + LobsterBoard 的密度 + Signal 的霓虹——这五样的融合，就是你的视觉语言。
