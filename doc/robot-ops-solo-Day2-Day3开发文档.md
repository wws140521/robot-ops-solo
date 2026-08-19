# Robot-Ops Solo · Day 2 & Day 3 开发文档

> **适用版本**：在 Day 1 收工标准全部达成后使用（6/6 在线、WS 稳定、电量/位置差异化、Pose 有值）
> **Day 2 目标**：点击机器人卡片 → 进入详情页，看到品牌专属数据
> **Day 3 目标**：趋势图实时滚动 + 全品牌告警流聚合
> **预计工作量**：2 天（一人），Day 2 约 6 小时，Day 3 约 5 小时
> **文档版本**：v1.0 | 2026-08-19

---

## 总览：Day 2–3 要建/改的文件

| 文件 | 操作 | 属于 | 行数 |
|------|------|------|------|
| `utils/robotType.ts` | **新建** | Day 2 前置 | ~30 |
| `utils/brandRegistry.ts` | **新建** | Day 2 前置 | ~40 |
| `pages/RobotDetail.tsx` | **新建** | Day 2 核心 | ~120 |
| `components/JointTable.tsx` | **新建** | Day 2 核心 | ~60 |
| `components/AlarmHistory.tsx` | **新建** | Day 2 核心 | ~50 |
| `components/ExtensionPanel.tsx` | **新建** | Day 2 核心 | ~40 |
| `components/HealthGauge.tsx` | **新建** | Day 2 核心 | ~50 |
| `App.tsx` | **修改** | Day 2 路由 | +15 |
| `components/RobotCard.tsx` | **修改** | Day 2 交互 | +5 |
| `components/TrendChart.tsx` | **新建** | Day 3 核心 | ~70 |
| `components/AlarmStream.tsx` | **修改** | Day 3 完善 | ~20 |
| `roboticsops-edge/fanuc_mock.py` | **修改** | Day 3 告警 | +25 |
| `roboticsops-edge/kuka_mock.py` | **修改** | Day 3 告警 | +25 |
| `styles.css` | **修改** | Day 2+3 样式 | +80 |
| `package.json` | **修改** | Day 3 依赖 | +2 |

---

# 📅 DAY 2：机器人详情页

> **目标**：点击 Dashboard 上的任意机器人卡片 → 跳转 `/robot/:robotId` → 看到该机器人的关节表格、健康分仪表盘、品牌特有数据、告警历史。
> **验收标准**：点 FANUC → 看到 R 寄存器；点 KUKA → 看到安全门状态；点 peanut → 看到电量+位置。

---

## Day 2 · 步骤 1：前置工具（30 分钟）

### 1a. 机器人类型判断（`utils/robotType.ts`）

**新建文件** `packages/adapter-kit/src/utils/robotType.ts`

```typescript
// 判断机器人属于哪一大类，用于 UI 差异化渲染

export type RobotCategory = 'industrial_arm' | 'mobile_robot' | 'collaborative';

const INDUSTRIAL_BRANDS = ['fanuc', 'kuka', 'estun', 'yaskawa', 'abb'];
const MOBILE_BRANDS = ['keenon', 'unitree', 'agv', 'amr', 'peanut'];

export function getRobotCategory(brand: string): RobotCategory {
  const b = (brand || '').toLowerCase();
  if (INDUSTRIAL_BRANDS.includes(b)) return 'industrial_arm';
  if (MOBILE_BRANDS.includes(b)) return 'mobile_robot';
  return 'collaborative'; // UR / 未知默认协作
}

// 判断是否需要显示电量条
export function shouldShowBattery(category: RobotCategory): boolean {
  return category === 'mobile_robot' || category === 'collaborative';
}

// 判断是否需要显示负载率
export function shouldShowLoad(category: RobotCategory): boolean {
  return category === 'industrial_arm';
}
```

### 1b. 品牌注册表（`utils/brandRegistry.ts`）

**新建文件** `packages/adapter-kit/src/utils/brandRegistry.ts`

```typescript
// 统一管理所有品牌的颜色、图标、协议、分类
// 新增品牌只需在这里加一行

export interface BrandConfig {
  name: string;
  color: string;       // 主题色（用于边框、标题）
  badgeBg: string;     // 标签背景色
  badgeText: string;    // 标签文字色
  icon: string;        // emoji 图标
  protocol: string;    // 默认协议
  category: 'industrial_arm' | 'mobile_robot' | 'collaborative';
}

export const BRAND_REGISTRY: Record<string, BrandConfig> = {
  fanuc:   { name: 'FANUC',  color: '#1e40af', badgeBg: '#dbeafe', badgeText: '#1e40af', icon: '🤖', protocol: 'FOCAS',  category: 'industrial_arm' },
  kuka:    { name: 'KUKA',   color: '#dc2626', badgeBg: '#fee2e2', badgeText: '#dc2626', icon: '🦾', protocol: 'OPC_UA', category: 'industrial_arm' },
  estun:   { name: 'ESTUN',  color: '#ea580c', badgeBg: '#ffedd5', badgeText: '#c2410c', icon: '🏭', protocol: 'MODBUS', category: 'industrial_arm' },
  yaskawa: { name: 'YASKAWA',color: '#16a34a', badgeBg: '#dcfce7', badgeText: '#15803d', icon: '⚙️', protocol: 'HSE',    category: 'industrial_arm' },
  abb:     { name: 'ABB',    color: '#7c3aed', badgeBg: '#ede9fe', badgeText: '#6d28d9', icon: '🔧', protocol: 'OPC_UA', category: 'industrial_arm' },
  keenon:  { name: 'Keenon', color: '#0891b2', badgeBg: '#cffafe', badgeText: '#0e7490', icon: '🚶', protocol: 'REST',   category: 'mobile_robot' },
  unitree: { name: 'Unitree',color: '#9333ea', badgeBg: '#f3e8ff', badgeText: '#7e22ce', icon: '🐕', protocol: 'ROS2',   category: 'mobile_robot' },
  peanut:  { name: 'Peanut', color: '#0d9488', badgeBg: '#ccfbf1', badgeText: '#0f766e', icon: '🥜', protocol: 'REST',   category: 'mobile_robot' },
  ur:      { name: 'Universal Robots', color: '#0d9488', badgeBg: '#ccfbf1', badgeText: '#0f766e', icon: '🤝', protocol: 'REST', category: 'collaborative' },
  // 商用四足
  g1:      { name: 'Unitree G1', color: '#9333ea', badgeBg: '#f3e8ff', badgeText: '#7e22ce', icon: '🐾', protocol: 'ROS2', category: 'mobile_robot' },
};

// 获取品牌配置（找不到时返回默认灰）
export function getBrandConfig(brand: string): BrandConfig {
  return BRAND_REGISTRY[(brand || '').toLowerCase()] || {
    name: (brand || 'UNKNOWN').toUpperCase(),
    color: '#6b7280',
    badgeBg: '#f3f4f6',
    badgeText: '#374151',
    icon: '❓',
    protocol: 'UNKNOWN',
    category: 'collaborative',
  };
}
```

---

## Day 2 · 步骤 2：路由配置（15 分钟）

### 修改 `App.tsx`（或你的入口文件）

```tsx
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Dashboard from './pages/Dashboard';
import RobotDetail from './pages/RobotDetail';
import { connectMqtt } from './protocol/mqtt-client';
import { useRobotStore } from './store/robotStore';
import { useEffect } from 'react';

function App() {
  useEffect(() => {
    // 启动 MQTT 连接
    const { updateRobot, addAlerts } = useRobotStore.getState();

    const handleTelemetry = (robotId: string, state: any, alerts: any[]) => {
      // 这里需要 brand/model 信息，从 state 里取
      updateRobot(robotId, state.brand, state.model, state, alerts);
      if (alerts.length > 0) {
        addAlerts(robotId, alerts);
      }
    };

    connectMqtt(handleTelemetry);

    // 每 5 秒检查离线
    const timer = setInterval(() => {
      useRobotStore.getState().markOfflineIfStale();
    }, 5000);

    return () => clearInterval(timer);
  }, []);

  return (
    <BrowserRouter>
      <div className="app-shell">
        <nav className="sidebar">
          {/* 你的侧边栏菜单 */}
          <a href="/">📊 仪表盘</a>
          <a href="/alarms">🔔 告警</a>
          <a href="/sop">📋 SOP</a>
        </nav>
        <main className="main-content">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/robot/:robotId" element={<RobotDetail />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}

export default App;
```

> ⚠️ **注意**：如果你的 `connectMqtt` 用的是回调注册模式（见 `mqtt-client.ts` 里的 `onTelemetry`），需要在 `App.tsx` 里先注册回调再 connect。具体看你现有代码的调用方式。

---

## Day 2 · 步骤 3：RobotCard 加 onClick（15 分钟）

### 修改 `components/RobotCard.tsx`

```tsx
import { useNavigate } from 'react-router-dom';
import { getBrandConfig } from '../utils/brandRegistry';
import { getRobotCategory } from '../utils/robotType';
import type { RobotEntry } from '../store/robotStore';
import { healthColor } from '../store/robotStore';

interface Props {
  robot: RobotEntry;
}

export function RobotCard({ robot }: Props) {
  const navigate = useNavigate();
  const brand = getBrandConfig(robot.brand);
  const category = getRobotCategory(robot.brand);
  const score = robot.state.health_score ?? 85;

  const handleClick = () => {
    navigate(`/robot/${robot.robotId}`);
  };

  return (
    <div
      className={`robot-card ${robot.state.online ? 'online' : 'offline'} cat-${category}`}
      style={{ borderLeftColor: brand.color }}
      onClick={handleClick}
      role="button"
      tabIndex={0}
    >
      {/* 头部：图标 + ID + 品牌标签 */}
      <div className="card-header">
        <span className="robot-icon">{brand.icon}</span>
        <span className="robot-id">{robot.robotId}</span>
        <span
          className="brand-badge"
          style={{ background: brand.badgeBg, color: brand.badgeText }}
        >
          {brand.name}
        </span>
      </div>

      {/* 型号 */}
      <div className="card-model">{robot.model}</div>

      {/* 状态行 */}
      <div className="card-status">
        <span className={`dot ${robot.state.online ? 'green' : 'red'}`} />
        <span>{robot.state.online ? '工作中' : '离线'}</span>
        <span className="health-score" style={{ color: healthColor(score) }}>
          {score}分
        </span>
      </div>

      {/* 指标：按类型差异化 */}
      {category === 'industrial_arm' && (
        <div className="card-metrics">
          <div>负载: {robot.state.joints[0]?.load_pct ?? 0}%</div>
          <div>温度: {robot.state.joints[0]?.temp_c ?? 0}°C</div>
          <div>运行: {robot.state.runtime?.power_on_hours ?? 0}h</div>
        </div>
      )}
      {category === 'mobile_robot' && (
        <div className="card-metrics">
          <div>电量: {robot.state.battery ?? 0}%</div>
          <div>位置: ({robot.state.pose?.x ?? 0}, {robot.state.pose?.y ?? 0})</div>
        </div>
      )}
      {category === 'collaborative' && (
        <div className="card-metrics">
          <div>电量: {robot.state.battery ?? 0}%</div>
          <div>模式: {robot.state.runtime?.mode ?? 'IDLE'}</div>
        </div>
      )}
    </div>
  );
}
```

---

## Day 2 · 步骤 4：详情页核心组件（2 小时）

### 4a. 健康分仪表盘（`components/HealthGauge.tsx`）

```tsx
// 圆形进度条，显示 0-100 的健康分
// 颜色：≥80 绿、≥60 黄、≥40 橙、<40 红

import { healthColor } from '../store/robotStore';

interface Props {
  score: number;
  size?: number;
  label?: string;
}

export function HealthGauge({ score, size = 160, label = '健康分' }: Props) {
  const radius = (size - 20) / 2;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.max(0, Math.min(100, score));
  const offset = circumference * (1 - clamped / 100);
  const color = healthColor(clamped);

  return (
    <div className="health-gauge" style={{ width: size, height: size }}>
      <svg width={size} height={size}>
        {/* 背景圆环 */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="#e5e7eb"
          strokeWidth="12"
        />
        {/* 进度圆环 */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth="12"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          style={{ transition: 'stroke-dashoffset 0.6s ease, stroke 0.3s' }}
        />
      </svg>
      <div className="gauge-text" style={{ color }}>
        <div className="gauge-value">{clamped}</div>
        <div className="gauge-label">{label}</div>
      </div>
    </div>
  );
}
```

### 4b. 关节数据表格（`components/JointTable.tsx`）

```tsx
import type { JointState } from '../types/unified';
import { healthColor } from '../store/robotStore';

interface Props {
  joints: JointState[];
  brand: string;
}

// 关节名称映射（不同品牌轴名不同）
const AXIS_NAMES: Record<string, string[]> = {
  fanuc: ['J1', 'J2', 'J3', 'J4', 'J5', 'J6'],
  kuka: ['A1', 'A2', 'A3', 'A4', 'A5', 'A6'],
  estun: ['J1', 'J2', 'J3', 'J4', 'J5', 'J6'],
  default: ['轴1', '轴2', '轴3', '轴4', '轴5', '轴6'],
};

export function JointTable({ joints, brand }: Props) {
  const names = AXIS_NAMES[brand.toLowerCase()] || AXIS_NAMES.default;

  return (
    <table className="joint-table">
      <thead>
        <tr>
          <th>关节</th>
          <th>负载率</th>
          <th>温度</th>
          <th>电流</th>
          <th>健康分</th>
        </tr>
      </thead>
      <tbody>
        {joints.map((j, i) => (
          <tr key={j.j}>
            <td className="joint-name">{names[i] || `J${j.j}`}</td>
            <td>
              <div className="bar-cell">
                <div
                  className="bar-fill"
                  style={{
                    width: `${j.load_pct}%`,
                    background: j.load_pct > 80 ? '#ef4444' : j.load_pct > 60 ? '#f59e0b' : '#22c55e',
                  }}
                />
                <span>{j.load_pct}%</span>
              </div>
            </td>
            <td className={j.temp_c > 70 ? 'text-red' : ''}>{j.temp_c}°C</td>
            <td>{j.current_a.toFixed(1)}A</td>
            <td style={{ color: healthColor(j.health_score) }}>{j.health_score}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
```

### 4c. 告警历史（`components/AlarmHistory.tsx`）

```tsx
import { useRobotStore } from '../store/robotStore';
import type { UnifiedAlert } from '../types/unified';

interface Props {
  robotId: string;
}

const SEVERITY_COLOR: Record<string, string> = {
  INFO: '#3b82f6',
  WARNING: '#f59e0b',
  ERROR: '#ef4444',
  CRITICAL: '#991b1b',
};

export function AlarmHistory({ robotId }: Props) {
  const allAlerts = useRobotStore((s) => s.alerts);
  // 过滤出该机器人的告警
  const robotAlerts = allAlerts.filter((a: any) => a.robot_id === robotId);

  if (robotAlerts.length === 0) {
    return <p className="empty-hint">暂无告警 ✅</p>;
  }

  return (
    <table className="alarm-table">
      <thead>
        <tr>
          <th>时间</th>
          <th>等级</th>
          <th>告警码</th>
          <th>描述</th>
          <th>状态</th>
        </tr>
      </thead>
      <tbody>
        {robotAlerts.slice(0, 20).map((a: any, i: number) => (
          <tr key={i} className={`sev-${a.severity}`}>
            <td>{new Date(a.occurred_at).toLocaleString('zh-CN')}</td>
            <td>
              <span
                className="severity-dot"
                style={{ background: SEVERITY_COLOR[a.severity] || '#6b7280' }}
              />
              {a.severity}
            </td>
            <td className="mono">{a.raw_code}</td>
            <td>{a.zh_desc}</td>
            <td>{a.cleared ? '✅ 已清除' : '⚠️ 未清除'}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
```

### 4d. 品牌扩展面板（`components/ExtensionPanel.tsx`）

```tsx
import { getBrandConfig } from '../utils/brandRegistry';

interface Props {
  extensions: Record<string, any> | undefined;
  brand: string;
}

// 不同品牌的扩展字段中文名映射
const FIELD_LABELS: Record<string, Record<string, string>> = {
  fanuc: {
    tool_life_remaining: '刀具剩余寿命',
    r_register_200: 'R寄存器#200',
    d_parameter_101: 'D参数#101',
    macro_status: '宏指令状态',
    servo_alarm_history: '伺服告警历史',
  },
  kuka: {
    safety_gate_open: '安全门状态',
    robroot_offset_x: '基坐标偏移X',
    robroot_offset_y: '基坐标偏移Y',
    safety_controller_state: '安全控制器',
    axis_soft_limit: '轴软限位',
  },
  estun: {
    energy_consumption: '能耗监测',
    plc_extension: 'PLC扩展区',
    custom_alarm_word: '自定义告警字',
  },
  peanut: {
    battery_voltage: '电池电压',
    navigation_status: '导航状态',
    obstacle_distance: '障碍物距离',
  },
  g1: {
    gait_pattern: '步态模式',
    terrain_type: '地形类型',
    joint_torque_limit: '关节扭矩上限',
  },
};

export function ExtensionPanel({ extensions, brand }: Props) {
  const brandKey = brand.toLowerCase();
  const data = extensions?.[brandKey];
  const labels = FIELD_LABELS[brandKey] || {};
  const brandCfg = getBrandConfig(brand);

  if (!data || Object.keys(data).length === 0) {
    return <p className="empty-hint">暂无 {brandCfg.name} 特有数据</p>;
  }

  return (
    <div className="extension-panel">
      <h3 style={{ color: brandCfg.color }}>
        {brandCfg.icon} {brandCfg.name} 特有数据
      </h3>
      <div className="ext-grid">
        {Object.entries(data).map(([key, value]) => (
          <div key={key} className="ext-item">
            <span className="ext-key">{labels[key] || key}</span>
            <span className="ext-value">
              {typeof value === 'boolean'
                ? value ? '✅ 开' : '⛔ 关'
                : String(value)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
```

---

## Day 2 · 步骤 5：详情页组装（`pages/RobotDetail.tsx`）

**新建文件** `packages/adapter-kit/src/pages/RobotDetail.tsx`

```tsx
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useRobotStore } from '../store/robotStore';
import { getBrandConfig } from '../utils/brandRegistry';
import { getRobotCategory } from '../utils/robotType';
import { JointTable } from '../components/JointTable';
import { AlarmHistory } from '../components/AlarmHistory';
import { ExtensionPanel } from '../components/ExtensionPanel';
import { HealthGauge } from '../components/HealthGauge';

export default function RobotDetail() {
  const { robotId } = useParams<{ robotId: string }>();
  const navigate = useNavigate();
  const robot = useRobotStore((s) => (robotId ? s.robots.get(robotId) : undefined));

  if (!robot) {
    return (
      <div className="detail-empty">
        <h2>找不到机器人 {robotId}</h2>
        <p>该机器人可能离线或不存在。</p>
        <Link to="/" className="btn-primary">← 返回仪表盘</Link>
      </div>
    );
  }

  const brand = getBrandConfig(robot.brand);
  const category = getRobotCategory(robot.brand);
  const state = robot.state;
  const score = state.health_score ?? 85;

  return (
    <div className="detail-page" style={{ ['--brand-color' as any]: brand.color }}>
      {/* 返回按钮 */}
      <button className="btn-back" onClick={() => navigate('/')}>
        ← 返回仪表盘
      </button>

      {/* 头部信息 */}
      <header className="detail-header">
        <div className="detail-title">
          <span className="detail-icon">{brand.icon}</span>
          <h1>{robot.robotId}</h1>
          <span
            className="brand-badge"
            style={{ background: brand.badgeBg, color: brand.badgeText }}
          >
            {brand.name}
          </span>
          <span className="model-tag">{robot.model}</span>
        </div>
        <div className="detail-meta">
          <span className={`status-dot ${state.online ? 'green' : 'red'}`} />
          <span>{state.online ? '🟢 在线' : '🔴 离线'}</span>
          <span>协议: {brand.protocol}</span>
          <span>类型: {category === 'industrial_arm' ? '工业机械臂' : category === 'mobile_robot' ? '移动机器人' : '协作机器人'}</span>
        </div>
      </header>

      {/* 两栏布局 */}
      <div className="detail-grid">
        {/* 左栏：健康分 + 核心指标 */}
        <section className="detail-left">
          <div className="gauge-section">
            <HealthGauge score={score} />
          </div>

          {/* 核心指标卡片（按类型） */}
          <div className="metric-cards">
            {category === 'industrial_arm' && (
              <>
                <MetricCard label="运行时间" value={`${state.runtime?.power_on_hours ?? 0}h`} />
                <MetricCard label="循环次数" value={`${state.runtime?.cycle_count ?? 0}`} />
                <MetricCard label="最高温度" value={`${Math.max(...state.joints.map(j => j.temp_c))}°C`} />
                <MetricCard label="最大负载" value={`${Math.max(...state.joints.map(j => j.load_pct))}%`} />
              </>
            )}
            {category === 'mobile_robot' && (
              <>
                <MetricCard label="电量" value={`${state.battery ?? 0}%`} />
                <MetricCard label="X 坐标" value={`${state.pose?.x ?? 0}`} />
                <MetricCard label="Y 坐标" value={`${state.pose?.y ?? 0}`} />
                <MetricCard label="Z 坐标" value={`${state.pose?.z ?? 0}`} />
              </>
            )}
            {category === 'collaborative' && (
              <>
                <MetricCard label="电量" value={`${state.battery ?? 0}%`} />
                <MetricCard label="模式" value={state.runtime?.mode ?? 'IDLE'} />
              </>
            )}
          </div>
        </section>

        {/* 右栏：关节表格 + 告警 + 扩展 */}
        <section className="detail-right">
          <h2>关节状态</h2>
          <JointTable joints={state.joints} brand={robot.brand} />

          <h2>品牌特有数据</h2>
          <ExtensionPanel extensions={state.extensions} brand={robot.brand} />

          <h2>告警历史</h2>
          <AlarmHistory robotId={robot.robotId} />
        </section>
      </div>
    </div>
  );
}

// 小指标卡片
function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="metric-card">
      <div className="metric-label">{label}</div>
      <div className="metric-value">{value}</div>
    </div>
  );
}
```

---

## Day 2 · 步骤 6：样式（`styles.css` 追加）

```css
/* ═════════════════════════════════════════════
   Robot-Ops Solo · Day 2+3 样式
   ═════════════════════════════════════════════ */

/* ── 健康分仪表盘 ────────────────────────── */
.health-gauge {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
}
.gauge-text {
  position: absolute;
  text-align: center;
}
.gauge-value {
  font-size: 36px;
  font-weight: 700;
}
.gauge-label {
  font-size: 12px;
  color: #6b7280;
}

/* ── 关节表格 ────────────────────────────── */
.joint-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
}
.joint-table th {
  background: #f9fafb;
  padding: 8px 12px;
  text-align: left;
  font-weight: 600;
  color: #374151;
  border-bottom: 1px solid #e5e7eb;
}
.joint-table td {
  padding: 8px 12px;
  border-bottom: 1px solid #f3f4f6;
}
.joint-name {
  font-weight: 600;
  color: var(--brand-color, #3b82f6);
}
.text-red { color: #ef4444; font-weight: 600; }

/* 条形图单元格 */
.bar-cell {
  display: flex;
  align-items: center;
  gap: 8px;
}
.bar-fill {
  height: 8px;
  border-radius: 4px;
  min-width: 2px;
  transition: width 0.5s ease;
}
.bar-cell span {
  font-size: 12px;
  min-width: 36px;
}

/* ── 告警表格 ────────────────────────────── */
.alarm-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
}
.alarm-table th {
  background: #f9fafb;
  padding: 6px 10px;
  text-align: left;
  font-weight: 600;
}
.alarm-table td {
  padding: 6px 10px;
  border-bottom: 1px solid #f3f4f6;
}
.severity-dot {
  display: inline-block;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  margin-right: 4px;
  vertical-align: middle;
}
.mono { font-family: 'SF Mono', Menlo, monospace; font-size: 12px; }

/* ── 扩展面板 ────────────────────────────── */
.extension-panel {
  background: #f9fafb;
  border-radius: 8px;
  padding: 16px;
  margin-top: 8px;
}
.extension-panel h3 {
  margin: 0 0 12px 0;
  font-size: 14px;
}
.ext-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 8px;
}
.ext-item {
  display: flex;
  justify-content: space-between;
  padding: 6px 10px;
  background: white;
  border-radius: 6px;
  font-size: 13px;
}
.ext-key {
  color: #6b7280;
}
.ext-value {
  font-weight: 600;
  color: #111827;
}

/* ── 详情页布局 ──────────────────────────── */
.detail-page {
  padding: 24px;
  max-width: 1400px;
  margin: 0 auto;
}
.detail-header {
  margin-bottom: 24px;
}
.detail-title {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}
.detail-title h1 {
  font-size: 24px;
  margin: 0;
}
.detail-icon { font-size: 28px; }
.model-tag {
  background: #f3f4f6;
  padding: 2px 10px;
  border-radius: 4px;
  font-size: 13px;
  color: #6b7280;
}
.detail-meta {
  display: flex;
  gap: 16px;
  margin-top: 8px;
  font-size: 13px;
  color: #6b7280;
}
.status-dot {
  display: inline-block;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  margin-right: 4px;
}
.status-dot.green { background: #22c55e; }
.status-dot.red { background: #ef4444; }

/* 两栏 */
.detail-grid {
  display: grid;
  grid-template-columns: 280px 1fr;
  gap: 24px;
}
@media (max-width: 900px) {
  .detail-grid { grid-template-columns: 1fr; }
}

/* 指标卡片 */
.metric-cards {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
  margin-top: 16px;
}
.metric-card {
  background: white;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  padding: 12px 16px;
  text-align: center;
}
.metric-label {
  font-size: 12px;
  color: #6b7280;
}
.metric-value {
  font-size: 20px;
  font-weight: 700;
  color: var(--brand-color, #3b82f6);
  margin-top: 4px;
}

/* 按钮 */
.btn-back {
  background: none;
  border: 1px solid #d1d5db;
  padding: 6px 14px;
  border-radius: 6px;
  cursor: pointer;
  font-size: 13px;
  margin-bottom: 16px;
}
.btn-back:hover { background: #f9fafb; }
.btn-primary {
  display: inline-block;
  background: #3b82f6;
  color: white;
  padding: 8px 20px;
  border-radius: 6px;
  text-decoration: none;
  margin-top: 12px;
}

/* 空状态 */
.empty-hint {
  color: #9ca3af;
  font-size: 13px;
  padding: 12px 0;
}
.detail-empty {
  text-align: center;
  padding: 60px 20px;
}

/* ── RobotCard 点击态 ────────────────────── */
.robot-card {
  cursor: pointer;
  transition: transform 0.15s, box-shadow 0.15s;
}
.robot-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0,0,0,0.1);
}
.robot-card:focus {
  outline: 2px solid var(--brand-color, #3b82f6);
  outline-offset: 2px;
}
```

---

## Day 2 · 步骤 7：验证 Checklist

> 收工前逐项确认，全勾才算 Day 2 完成 ✅

- [ ] **路由生效**：点击 `FANUC_M20iD_001` → URL 变成 `/robot/FANUC_M20iD_001`
- [ ] **返回正常**：点"← 返回仪表盘" → 回到 Dashboard，不报错
- [ ] **FANUC 详情**：看到 6 行关节表格 + R 寄存器数据 + 健康分仪表盘
- [ ] **KUKA 详情**：看到 6 行关节表格 + 安全门状态 + 健康分仪表盘
- [ ] **peanut 详情**：看到电量 + 位置坐标 + 导航状态
- [ ] **离线机器人**：点一个停掉的 mock 对应的卡片 → 显示"找不到机器人"或离线标记
- [ ] **品牌颜色**：FANUC 蓝色调、KUKA 红色调、Estun 橙色调
- [ ] **健康分颜色**：≥80 绿色圆环、60-79 黄色、<60 红色
- [ ] **告警表格**：至少 1 条告警记录显示，带时间+等级+描述
- [ ] **键盘可达**：Tab 键能聚焦卡片，Enter 键能进入详情页

---

# 📅 DAY 3：趋势图 + 告警流

> **目标**：每个机器人详情页有 30 点滚动趋势图（温度/负载/电流）；Dashboard 右侧告警流聚合所有品牌告警，按严重等级颜色区分。
> **验收标准**：趋势图每 5 秒滚一个点；告警流同时出现 FANUC SRVO-xxx / KUKA KSS-xxxxx / ESTUN 告警。

---

## Day 3 · 步骤 1：安装 Chart.js（15 分钟）

```bash
cd ~/Desktop/robot-ops-solo
pnpm add chart.js react-chartjs-2
```

确认 `package.json` 里出现：
```json
"dependencies": {
  "chart.js": "^4.x.x",
  "react-chartjs-2": "^5.x.x",
  ...
}
```

---

## Day 3 · 步骤 2：趋势图组件（`components/TrendChart.tsx`）

**新建文件** `packages/adapter-kit/src/components/TrendChart.tsx`

```tsx
import { useEffect, useRef, useState } from 'react';
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Filler,
  Tooltip,
  Legend,
} from 'chart.js';
import { useRobotStore } from '../store/robotStore';

// 注册 Chart.js 模块（只需一次）
ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Filler, Tooltip, Legend);

interface Props {
  robotId: string;
  metric: 'temp_c' | 'load_pct' | 'current_a' | 'health_score';
  jointIndex?: number;       // 看哪根关节（默认 0 = 第 1 轴）
  maxPoints?: number;        // 保留多少个点（默认 30）
  height?: number;
  color?: string;           // 折线颜色（不传则按 metric 自动选）
}

const METRIC_CONFIG: Record<string, { label: string; color: string; unit: string }> = {
  temp_c:      { label: '温度',   color: '#ef4444', unit: '°C' },
  load_pct:    { label: '负载率', color: '#f59e0b', unit: '%' },
  current_a:   { label: '电流',   color: '#3b82f6', unit: 'A' },
  health_score:{ label: '健康分', color: '#22c55e', unit: '' },
};

export function TrendChart({
  robotId,
  metric,
  jointIndex = 0,
  maxPoints = 30,
  height = 140,
  color,
}: Props) {
  const robot = useRobotStore((s) => s.robots.get(robotId));
  const cfg = METRIC_CONFIG[metric] || METRIC_CONFIG.temp_c;
  const lineColor = color || cfg.color;

  // 用 ref 存历史（避免 setState 触发重渲染风暴）
  const historyRef = useRef<number[]>([]);
  const labelsRef = useRef<string[]>([]);
  const [tick, setTick] = useState(0); // 强制刷新用

  useEffect(() => {
    if (!robot) return;

    let val: number;
    if (metric === 'health_score') {
      val = robot.state.health_score ?? 85;
    } else {
      val = robot.state.joints[jointIndex]?.[metric] ?? 0;
    }

    const time = new Date().toLocaleTimeString('zh-CN', { hour12: false });

    historyRef.current.push(val);
    labelsRef.current.push(time);

    if (historyRef.current.length > maxPoints) {
      historyRef.current.shift();
      labelsRef.current.shift();
    }

    // 每 5 秒强制刷新一次图表
    setTick((t) => t + 1);
  }, [robot?.state.timestamp]); // 每次数据更新触发

  const data = {
    labels: [...labelsRef.current],
    datasets: [
      {
        label: `${cfg.label}`,
        data: [...historyRef.current],
        borderColor: lineColor,
        backgroundColor: lineColor + '22', // 20% 透明度填充
        fill: true,
        tension: 0.3,
        pointRadius: 0,      // 隐藏数据点，更干净
        borderWidth: 2,
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    animation: { duration: 300 },
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          label: (ctx: any) => `${ctx.parsed.y}${cfg.unit}`,
        },
      },
    },
    scales: {
      x: {
        display: true,
        ticks: { maxTicksLimit: 5, font: { size: 10 } },
        grid: { display: false },
      },
      y: {
        display: true,
        beginAtZero: metric !== 'health_score',
        ticks: { font: { size: 10 } },
        grid: { color: '#f3f4f6' },
      },
    },
  };

  return (
    <div className="trend-chart" style={{ height }}>
      <div className="trend-header">
        <span className="trend-label">{cfg.label}</span>
        <span className="trend-value" style={{ color: lineColor }}>
          {historyRef.current.length > 0
            ? `${historyRef.current[historyRef.current.length - 1]}${cfg.unit}`
            : '--'}
        </span>
      </div>
      <Line data={data} options={options} />
    </div>
  );
}
```

### 在 `RobotDetail.tsx` 里使用趋势图

在 `<section className="detail-right">` 里，关节表格之前加：

```tsx
<h2>实时趋势</h2>
<div className="trend-grid">
  <TrendChart robotId={robot.robotId} metric="temp_c" />
  <TrendChart robotId={robot.robotId} metric="load_pct" />
  <TrendChart robotId={robot.robotId} metric="current_a" />
  <TrendChart robotId={robot.robotId} metric="health_score" />
</div>
```

### 趋势图样式（追加到 `styles.css`）

```css
/* ── 趋势图 ──────────────────────────────── */
.trend-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
  margin-bottom: 20px;
}
@media (max-width: 700px) {
  .trend-grid { grid-template-columns: 1fr; }
}
.trend-chart {
  background: white;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  padding: 12px;
}
.trend-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 4px;
}
.trend-label {
  font-size: 12px;
  color: #6b7280;
  font-weight: 600;
}
.trend-value {
  font-size: 16px;
  font-weight: 700;
}
```

---

## Day 3 · 步骤 3：告警流组件完善（`components/AlarmStream.tsx`）

### 修改/新建 `components/AlarmStream.tsx`

```tsx
import { useRobotStore } from '../store/robotStore';
import { getBrandConfig } from '../utils/brandRegistry';
import { useNavigate } from 'react-router-dom';

const SEVERITY_STYLE: Record<string, { bg: string; border: string; icon: string }> = {
  INFO:     { bg: '#eff6ff', border: '#3b82f6', icon: 'ℹ️' },
  WARNING:  { bg: '#fffbeb', border: '#f59e0b', icon: '⚠️' },
  ERROR:    { bg: '#fef2f2', border: '#ef4444', icon: '❌' },
  CRITICAL: { bg: '#fdf2f8', border: '#e11d48', icon: '🚨' },
};

export function AlarmStream({ maxItems = 20 }: { maxItems?: number }) {
  const alerts = useRobotStore((s) => s.alerts);
  const navigate = useNavigate();

  // 按时间倒序
  const sorted = [...alerts].sort((a, b) =>
    (b.occurred_at || '').localeCompare(a.occurred_at || '')
  );

  if (sorted.length === 0) {
    return (
      <div className="alarm-stream">
        <h2>🔔 实时告警流</h2>
        <p className="empty-hint">暂无告警，一切正常 ✅</p>
      </div>
    );
  }

  return (
    <div className="alarm-stream">
      <h2>🔔 实时告警流 <span className="alarm-count">({sorted.length})</span></h2>
      <div className="alarm-list">
        {sorted.slice(0, maxItems).map((a: any, i: number) => {
          const sev = SEVERITY_STYLE[a.severity] || SEVERITY_STYLE.INFO;
          const brand = getBrandConfig(a.robot_id?.split('_')[0] || '');
          return (
            <div
              key={i}
              className="alarm-item"
              style={{ background: sev.bg, borderLeftColor: sev.border }}
              onClick={() => a.robot_id && navigate(`/robot/${a.robot_id}`)}
            >
              <span className="alarm-icon">{sev.icon}</span>
              <span className="alarm-time">
                {new Date(a.occurred_at).toLocaleTimeString('zh-CN', { hour12: false })}
              </span>
              <span
                className="alarm-robot"
                style={{ color: brand.color, fontWeight: 600 }}
              >
                {a.robot_id || '未知'}
              </span>
              <span className="alarm-code mono">{a.raw_code}</span>
              <span className="alarm-desc">{a.zh_desc}</span>
              {!a.cleared && <span className="alarm-active">●</span>}
            </div>
          );
        })}
      </div>
    </div>
  );
}
```

### 告警流样式（追加到 `styles.css`）

```css
/* ── 告警流 ──────────────────────────────── */
.alarm-stream {
  margin-top: 16px;
}
.alarm-stream h2 {
  font-size: 15px;
  margin-bottom: 10px;
}
.alarm-count {
  font-size: 13px;
  color: #6b7280;
  font-weight: normal;
}
.alarm-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
  max-height: 400px;
  overflow-y: auto;
}
.alarm-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 12px;
  border-radius: 6px;
  border-left: 4px solid;
  cursor: pointer;
  font-size: 13px;
  transition: opacity 0.15s;
}
.alarm-item:hover { opacity: 0.8; }
.alarm-time {
  color: #6b7280;
  font-size: 12px;
  min-width: 70px;
}
.alarm-robot {
  min-width: 140px;
}
.alarm-code {
  background: #f3f4f6;
  padding: 1px 6px;
  border-radius: 3px;
  font-size: 12px;
}
.alarm-desc {
  flex: 1;
  color: #374151;
}
.alarm-active {
  color: #ef4444;
  font-size: 10px;
  animation: pulse 1.5s infinite;
}
@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.3; }
}
```

---

## Day 3 · 步骤 4：所有 Mock 发告警

### 修改 `roboticsops-edge/fanuc_mock.py`

在文件顶部加告警池，在 `generate_payload()` 里加 `alarms` 字段：

```python
# ═══════════════════════════════════════════
# FANUC 告警池
# ═══════════════════════════════════════════
import random

FANUC_ALARM_POOL = [
    {"raw_code": "SRVO-062", "severity": "WARNING", "zh_desc": "伺服放大器过热"},
    {"raw_code": "SRVO-075", "severity": "ERROR",   "zh_desc": "关节2超速"},
    {"raw_code": "SRVO-214", "severity": "WARNING", "zh_desc": "制动器温度高"},
    {"raw_code": "SRVO-230", "severity": "ERROR",   "zh_desc": "编码器电池低电压"},
    {"raw_code": "INTP-311", "severity": "INFO",    "zh_desc": "程序暂停"},
    {"raw_code": "SRVO-105", "severity": "CRITICAL","zh_desc": "关节6过电流"},
    {"raw_code": "MOTN-023", "severity": "WARNING", "zh_desc": "运动指令超限"},
]

def generate_alarms(brand="fanuc"):
    """15% 概率发 1 条告警，5% 概率发 2 条"""
    alarms = []
    if random.random() < 0.15:
        pool = FANUC_ALARM_POOL if brand == "fanuc" else KUKA_ALARM_POOL
        n = 2 if random.random() < 0.05 else 1
        selected = random.sample(pool, min(n, len(pool)))
        for a in selected:
            alarms.append({
                **a,
                "occurred_at": datetime.utcnow().isoformat() + "Z",
                "cleared": False,
            })
    return alarms
```

### 修改 `roboticsops-edge/kuka_mock.py`

```python
# ═══════════════════════════════════════════
# KUKA 告警池
# ═══════════════════════════════════════════
KUKA_ALARM_POOL = [
    {"raw_code": "KSS01005", "severity": "WARNING", "zh_desc": "制动器温度监控触发"},
    {"raw_code": "KSS01131", "severity": "ERROR",   "zh_desc": "轴2伺服故障"},
    {"raw_code": "KSS00404", "severity": "INFO",    "zh_desc": "安全门打开"},
    {"raw_code": "KSS01069", "severity": "WARNING", "zh_desc": "电池电压低"},
    {"raw_code": "KSS01142", "severity": "CRITICAL","zh_desc": "紧急停止触发"},
    {"raw_code": "KSS00997", "severity": "WARNING", "zh_desc": "轴3碰撞检测"},
]

# 复用上面 fanuc_mock.py 里的 generate_alarms 函数
# （把 generate_alarms 抽到 common.py 更优雅，但先这样能跑）
```

### 在 payload 里加 alarms

两个 mock 的 `generate_payload()` 函数里都加一行：

```python
payload = {
    # ... 已有字段 ...
    "alarms": generate_alarms(brand="fanuc"),  # kuka_mock 里改 brand="kuka"
}
```

### 新建 `roboticsops-edge/common.py`（可选，更优雅）

```python
"""
共用工具：告警生成 + 时间工具
两个 mock 都 import 这个
"""
import random
from datetime import datetime

def now_iso():
    return datetime.utcnow().isoformat() + "Z"

def generate_alarms(pool, prob_single=0.15, prob_double=0.05):
    alarms = []
    if random.random() < prob_single:
        n = 2 if random.random() < prob_double else 1
        selected = random.sample(pool, min(n, len(pool)))
        for a in selected:
            alarms.append({
                **a,
                "occurred_at": now_iso(),
                "cleared": False,
            })
    return alarms
```

然后 `fanuc_mock.py` 和 `kuka_mock.py` 顶部：
```python
from common import generate_alarms, now_iso
```

---

## Day 3 · 步骤 5：Dashboard 集成告警流

### 修改 `pages/Dashboard.tsx`（或你的主页）

在右侧栏加告警流组件：

```tsx
import { AlarmStream } from '../components/AlarmStream';

// 在 Dashboard 的 JSX 里
<div className="dashboard-layout">
  {/* 左侧/中间：机器人卡片网格 */}
  <div className="robot-grid">
    {robots.map(r => <RobotCard key={r.robotId} robot={r} />)}
  </div>

  {/* 右侧：告警流 */}
  <aside className="dashboard-sidebar">
    <AlarmStream maxItems={15} />
  </aside>
</div>
```

### Dashboard 布局样式（追加到 `styles.css`）

```css
.dashboard-layout {
  display: grid;
  grid-template-columns: 1fr 360px;
  gap: 20px;
}
@media (max-width: 1100px) {
  .dashboard-layout { grid-template-columns: 1fr; }
}
.dashboard-sidebar {
  position: sticky;
  top: 20px;
  max-height: calc(100vh - 40px);
  overflow-y: auto;
}
```

---

## Day 3 · 步骤 6：验证 Checklist

- [ ] **趋势图滚动**：打开 FANUC 详情页 → 温度折线每 5 秒右移一个点
- [ ] **4 张趋势图**：温度/负载/电流/健康分 各一张，颜色不同
- [ ] **30 个点满**：等 2.5 分钟 → 图表保持 30 个点不溢出
- [ ] **FANUC 告警**：右侧告警流出现 `SRVO-xxx` 开头的中文告警
- [ ] **KUKA 告警**：右侧告警流出现 `KSSxxxxx` 开头的中文告警
- [ ] **颜色分级**：ERROR 红底、WARNING 黄底、INFO 蓝底
- [ ] **点击告警**：点一条告警 → 跳转到对应机器人详情页
- [ ] **告警计数**：标题旁显示 `(N)` 实时数量
- [ ] **脉冲动画**：未清除的告警有红色圆点闪烁
- [ ] **Dashboard 布局**：左侧卡片 + 右侧告警流，不重叠

---

## 完整文件树（Day 2+3 完成后）

```
packages/adapter-kit/src/
├── types/
│   └── unified.ts              (已有，不动)
├── store/
│   └── robotStore.ts           (已有，Day 1 改过)
├── protocol/
│   └── mqtt-client.ts          (已有，Day 1 改过)
├── adapters/
│   └── index.ts                (已有，不动)
├── utils/
│   ├── robotType.ts            ✅ Day 2 新建
│   └── brandRegistry.ts        ✅ Day 2 新建
├── components/
│   ├── RobotCard.tsx           ✅ Day 2 修改（加 onClick）
│   ├── HealthGauge.tsx         ✅ Day 2 新建
│   ├── JointTable.tsx          ✅ Day 2 新建
│   ├── AlarmHistory.tsx        ✅ Day 2 新建
│   ├── ExtensionPanel.tsx      ✅ Day 2 新建
│   ├── TrendChart.tsx          ✅ Day 3 新建
│   └── AlarmStream.tsx         ✅ Day 3 新建/修改
├── pages/
│   ├── Dashboard.tsx           ✅ Day 3 修改（加告警流）
│   └── RobotDetail.tsx         ✅ Day 2 新建
├── App.tsx                     ✅ Day 2 修改（加路由）
└── styles.css                  ✅ Day 2+3 追加样式

roboticsops-edge/
├── fanuc_mock.py               ✅ Day 3 修改（加告警池）
├── kuka_mock.py                ✅ Day 3 修改（加告警池）
└── common.py                   ✅ Day 3 新建（共用工具）
```

---

## 启动验证全流程（Day 3 收工后）

```bash
# 终端 1：Mosquitto
/opt/homebrew/opt/mosquitto/sbin/mosquitto -c /tmp/mosquitto-ws.conf -v

# 终端 2：FANUC Mock
cd ~/Desktop/robot-ops-solo/roboticsops-edge
source venv/bin/activate
python fanuc_mock.py

# 终端 3：KUKA Mock
cd ~/Desktop/robot-ops-solo/roboticsops-edge
source venv/bin/activate
python kuka_mock.py

# 终端 4：前端
cd ~/Desktop/robot-ops-solo
pnpm dev
```

浏览器打开 `http://localhost:5173`：
1. ✅ 看到 6 台机器人卡片
2. ✅ 右侧告警流滚动（FANUC + KUKA 混合）
3. ✅ 点击 `FANUC_M20iD_001` → 进入详情页
4. ✅ 看到 4 张趋势图在动
5. ✅ 看到 R 寄存器扩展数据
6. ✅ 看到告警历史表格
7. ✅ 点"← 返回" → 回到 Dashboard
8. ✅ 点击 `KUKA_KR210_002` → 看到安全门状态
9. ✅ 点击告警流里一条 → 跳转到对应机器人

---

## 常见问题排查

| 问题 | 排查方向 |
|------|---------|
| 趋势图不更新 | 检查 `useEffect` 依赖 `robot?.state.timestamp` 是否在变 |
| Chart.js 报 "Canvas is already in use" | 确保每个 `TrendChart` 实例有唯一 key |
| 告警流只有 KUKA | 检查 FANUC mock 的 `alarms` 字段是否生成 |
| 详情页空白 | 检查 `useParams` 的 `robotId` 和 store 里的 key 是否一致 |
| 点击卡片没反应 | 检查 `react-router-dom` 是否安装：`pnpm list react-router-dom` |
| 品牌颜色不生效 | 检查 `brandRegistry.ts` 的 key 和 mock 里的 `brand` 大小写一致 |

---

*文档版本：v1.0 | 2026-08-19 | Robot-Ops Solo 项目 Day 2–3 开发指南*
