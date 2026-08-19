# Robot-Ops Solo · 下一步开发文档

> **当前状态**：多品牌 Dashboard 已跑通，FANUC/KUKA/ESTUN/Keenon/Unitree 同屏显示 ✅  
> **下一步目标**：修复已知问题 → 完善详情页 → 生产级告警流 → POC 可用  
> **预计工作量**：3–5 天（一人）  
> **文档版本**：v1.0 | 2026-08-19

---

## 一、已知问题清单（按优先级排序）

### 🔴 P0 — 必须修（影响 POC 演示）

| # | 问题 | 现象 | 根因推测 | 修复方案 |
|---|------|------|---------|---------|
| 1 | WebSocket 频繁重连 | 左下角 `WS RECONNECTING` | MQTT.js 重连参数未配置 / Broker 心跳超时 | 见第二节 |
| 2 | 部分机器人显示离线 | 在线 2/6，但 mock 在发 | `online` 判定逻辑未统一：store 里没更新 `last_seen_ts` | 见第三节 |
| 3 | 电量显示 0% | 工业机器人没有电池概念 | 工业适配器返回 `battery: 0`，UI 无差别渲染 | 见第四节 |
| 4 | 坐标显示 (0,0,0) | mock 没发 pose 或适配器没映射 | `pose` 字段在 UDM 里可能缺失 | 见第五节 |

### 🟡 P1 — 应该修（影响专业度）

| # | 问题 | 修复方向 |
|---|------|---------|
| 5 | 告警流只有 KUKA 一条 | 确认 FANUC/ESTUN mock 也发告警 |
| 6 | 机器人卡片无点击交互 | 加 `onClick` → 跳转详情页 |
| 7 | 没有历史趋势图 | 加 Chart.js / Recharts 折线图 |
| 8 | 品牌图标/颜色不统一 | 建 brand registry |

### 🟢 P2 — 可以后做（锦上添花）

| # | 问题 | 修复方向 |
|---|------|---------|
| 9 | 移动机器人（peanut/g1）和工业臂混排 | 加 robot_type 筛选 tab |
| 10 | 无暗色主题 | 加 CSS 变量切换 |
| 11 | 无多语言 | i18n（中文/英文） |

---

## 二、修复 P0-1：WebSocket 频繁重连

### 根因
MQTT.js 默认 `reconnectPeriod: 1000ms`，但 mosquitto 默认 `keepalive 60s`。  
如果前端网络抖动，1 秒就重连一次，看起来像"一直断"。

### 修复代码（`mqtt-client.ts`）

```typescript
import mqtt, { MqttClient } from 'mqtt';

const WS_URL = 'ws://localhost:9001';

export function connectMqtt(): MqttClient {
  const client = mqtt.connect(WS_URL, {
    // ✅ 关键参数
    reconnectPeriod: 5000,        // 5 秒重连一次（别太频繁）
    connectTimeout: 10000,        // 10 秒连接超时
    keepalive: 30,                // 30 秒心跳（mosquitto 默认 60）
    clean: true,                  // 每次新会话
    resubscribe: true,            // 重连后自动重新订阅
    
    // ✅ 可选：断线缓冲
    // queueQoSZero: true,        // QoS 0 消息也排队
  });

  client.on('connect', () => {
    console.log('[mqtt-client] ✅ connected');
    client.subscribe('roboticsops/telemetry', (err) => {
      if (!err) console.log('[mqtt-client] 📡 subscribed to roboticsops/telemetry');
    });
  });

  client.on('reconnect', () => {
    console.log('[mqtt-client] 🔄 reconnecting...');
  });

  client.on('offline', () => {
    console.log('[mqtt-client] ⚠️ offline');
  });

  client.on('error', (err) => {
    console.error('[mqtt-client] ❌ error:', err.message);
  });

  client.on('message', (topic, payload) => {
    try {
      const raw = JSON.parse(payload.toString());
      const { adaptByBrand } = require('../adapters');
      const { useRobotStore } = require('../store/robotStore');
      
      const { state, alerts } = adaptByBrand(raw.brand, raw);
      const store = useRobotStore.getState();
      store.updateRobot(raw.robot_id, state);
      
      if (alerts.length > 0) {
        store.addAlerts(raw.robot_id, alerts);
      }
    } catch (e) {
      console.error('[mqtt-client] parse error:', e);
    }
  });

  return client;
}
```

### 验证
- 打开浏览器 DevTools → Console
- 应该只看到 1 次 `✅ connected`，偶尔 `🔄 reconnecting`（拔网线测试）
- **不应该每秒都重连**

---

## 三、修复 P0-2：在线状态判定

### 根因
`online` 字段没有自动更新。MQTT 消息来了 → 更新 `state` → 但 `online` 还是 `false`。

### 修复代码（`robotStore.ts`）

```typescript
import { create } from 'zustand';

interface RobotState {
  robot_id: string;
  brand: string;
  model: string;
  online: boolean;
  last_seen_ts: number;       // ✅ 关键字段
  battery?: number;
  pose?: { x: number; y: number; z: number };
  joints: any[];
  alerts: any[];
  // ... 其他字段
}

interface StoreState {
  robots: Map<string, RobotState>;
  alerts: any[];
  updateRobot: (robotId: string, data: Partial<RobotState>) => void;
  addAlerts: (robotId: string, alerts: any[]) => void;
  markOfflineIfStale: () => void;  // ✅ 定时检查
}

export const useRobotStore = create<StoreState>((set, get) => ({
  robots: new Map(),
  alerts: [],

  updateRobot: (robotId, data) => set((state) => {
    const robots = new Map(state.robots);
    const existing = robots.get(robotId) || {} as RobotState;
    robots.set(robotId, {
      ...existing,
      ...data,
      robot_id: robotId,
      online: true,                    // ✅ 收到消息 = 在线
      last_seen_ts: Date.now(),        // ✅ 更新时间戳
    });
    return { robots };
  }),

  addAlerts: (robotId, alerts) => set((state) => ({
    alerts: [...alerts.map(a => ({ ...a, robot_id: robotId })), ...state.alerts].slice(0, 100),
  })),

  markOfflineIfStale: () => set((state) => {
    const robots = new Map(state.robots);
    const now = Date.now();
    const TIMEOUT = 15000; // 15 秒没消息 = 离线
    robots.forEach((r, id) => {
      if (now - r.last_seen_ts > TIMEOUT) {
        robots.set(id, { ...r, online: false });
      }
    });
    return { robots };
  }),
}));
```

### 在 App.tsx 里加定时器

```typescript
import { useEffect } from 'react';
import { useRobotStore } from './store/robotStore';
import { connectMqtt } from './protocol/mqtt-client';

export default function App() {
  useEffect(() => {
    // 1. 启动 MQTT
    const client = connectMqtt();

    // 2. 每 5 秒检查离线状态
    const timer = setInterval(() => {
      useRobotStore.getState().markOfflineIfStale();
    }, 5000);

    return () => {
      client.end();
      clearInterval(timer);
    };
  }, []);

  // ... 渲染
}
```

### 验证
- 所有 mock 在跑 → 6/6 在线
- 停掉某个 mock → 15 秒后变灰/红点
- 重新启动 mock → 立刻变绿

---

## 四、修复 P0-3：电量/位置按机器人类型差异化

### 设计思路

| 机器人类型 | 核心指标 | UI 展示 |
|-----------|---------|---------|
| **工业机械臂** (FANUC/KUKA/ESTUN) | 负载率、温度、运行时间 | 不显示电量，显示 `负载: 72%` `温度: 45°C` |
| **移动机器人** (peanut/g1) | 电量、位置坐标 | 显示 `电量: 68%` `位置: (3.2, 1.5)` |

### 类型判断工具（`utils/robotType.ts`）

```typescript
export type RobotCategory = 'industrial_arm' | 'mobile_robot' | 'collaborative';

export function getRobotCategory(brand: string): RobotCategory {
  const industrial = ['fanuc', 'kuka', 'estun', 'yaskawa', 'abb'];
  const mobile = ['keenon', 'unitree', 'agv', 'amr'];
  
  const b = brand.toLowerCase();
  if (industrial.includes(b)) return 'industrial_arm';
  if (mobile.includes(b)) return 'mobile_robot';
  return 'collaborative'; // UR / 未知默认协作
}
```

### Dashboard 卡片差异化渲染

```tsx
import { getRobotCategory } from '../utils/robotType';

function RobotCard({ robot }: { robot: RobotState }) {
  const category = getRobotCategory(robot.brand);

  return (
    <div className={`card ${robot.online ? 'online' : 'offline'}`}>
      <h3>{robot.robot_id}</h3>
      <span className={`badge brand-${robot.brand.toLowerCase()}`}>{robot.brand}</span>

      {/* ✅ 工业机械臂：显示负载 + 温度 */}
      {category === 'industrial_arm' && (
        <div className="metrics">
          <Metric label="负载率" value={`${robot.joints[0]?.load_pct ?? 0}%`} />
          <Metric label="温度" value={`${robot.joints[0]?.temp_c ?? 0}°C`} />
          <Metric label="运行" value={`${robot.runtime?.power_on_hours ?? 0}h`} />
        </div>
      )}

      {/* ✅ 移动机器人：显示电量 + 位置 */}
      {category === 'mobile_robot' && (
        <div className="metrics">
          <Metric label="电量" value={`${robot.battery ?? 0}%`} />
          <Metric label="位置" value={`(${robot.pose?.x ?? 0}, ${robot.pose?.y ?? 0})`} />
          <Metric label="状态" value={robot.mode ?? 'IDLE'} />
        </div>
      )}

      {/* ✅ 协作机器人：显示力控 + 电量 */}
      {category === 'collaborative' && (
        <div className="metrics">
          <Metric label="电量" value={`${robot.battery ?? 0}%`} />
          <Metric label="外力" value={`${robot.force ?? 0}N`} />
        </div>
      )}
    </div>
  );
}
```

### CSS 补充（`styles.css`）

```css
/* 按类型隐藏/显示 */
.card.industrial_arm .battery-bar { display: none; }
.card.mobile_robot .load-bar { display: none; }

/* 在线/离线状态 */
.card.online { border-left: 4px solid #22c55e; }
.card.offline { border-left: 4px solid #ef4444; opacity: 0.6; }
```

---

## 五、修复 P0-4：Pose 坐标数据

### Mock 补充（`fanuc_mock.py` / `kuka_mock.py`）

在 payload 里加 `pose` 字段：

```python
# fanuc_mock.py 的 payload 里加
"pose": {
    "x": round(random.uniform(-500, 500), 1),
    "y": round(random.uniform(-500, 500), 1),
    "z": round(random.uniform(0, 1500), 1),
    "rx": round(random.uniform(-180, 180), 1),
    "ry": round(random.uniform(-180, 180), 1),
    "rz": round(random.uniform(-180, 180), 1),
}
```

### 适配器映射（`adapter-fanuc.ts`）

```typescript
// 在 adaptIndustrial 里加
pose: raw.pose ? {
  x: raw.pose.x,
  y: raw.pose.y,
  z: raw.pose.z,
  rx: raw.pose.rx,
  ry: raw.pose.ry,
  rz: raw.pose.rz,
} : undefined,
```

### 验证
- 工业臂卡片显示 `X: 123.4 Y: -56.7 Z: 890.1`
- 移动机器人显示 `X: 3.2 Y: 1.5`（2D 平面）

---

## 六、P1-1：机器人详情页（点击卡片跳转）

### 路由配置（`App.tsx`）

```tsx
import { BrowserRouter, Routes, Route, useParams } from 'react-router-dom';
import RobotDetail from './pages/RobotDetail';

function App() {
  return (
    <BrowserRouter>
      <Layout>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/robot/:robotId" element={<RobotDetail />} />
          <Route path="/alarms" element={<AlarmPage />} />
          <Route path="/sop" element={<SopPage />} />
        </Routes>
      </Layout>
    </BrowserRouter>
  );
}
```

### 详情页组件（`pages/RobotDetail.tsx`）

```tsx
import { useParams } from 'react-router-dom';
import { useRobotStore } from '../store/robotStore';
import { getRobotCategory } from '../utils/robotType';
import JointTable from '../components/JointTable';
import AlarmHistory from '../components/AlarmHistory';
import HealthGauge from '../components/HealthGauge';
import TrendChart from '../components/TrendChart'; // 后面加

export default function RobotDetail() {
  const { robotId } = useParams();
  const robot = useRobotStore(s => s.robots.get(robotId!));

  if (!robot) return <div>机器人不存在或离线</div>;

  const category = getRobotCategory(robot.brand);

  return (
    <div className="detail-page">
      {/* 头部信息 */}
      <header>
        <h1>{robot.robot_id}</h1>
        <span className={`badge brand-${robot.brand.toLowerCase()}`}>{robot.brand}</span>
        <span className="model">{robot.model}</span>
        <span className={robot.online ? 'status-online' : 'status-offline'}>
          {robot.online ? '🟢 在线' : '🔴 离线'}
        </span>
      </header>

      {/* 健康分仪表盘 */}
      <section className="health-section">
        <HealthGauge score={robot.health_score ?? 85} />
      </section>

      {/* 关节数据表格 */}
      <section>
        <h2>关节状态</h2>
        <JointTable joints={robot.joints} brand={robot.brand} />
      </section>

      {/* 品牌特有扩展数据 */}
      <section>
        <h2>品牌特有数据 ({robot.brand})</h2>
        <ExtensionPanel extensions={robot.extensions} brand={robot.brand} />
      </section>

      {/* 告警历史 */}
      <section>
        <h2>告警历史</h2>
        <AlarmHistory robotId={robotId!} />
      </section>

      {/* 趋势图（占位） */}
      <section>
        <h2>历史趋势</h2>
        <TrendChartPlaceholder />
      </section>
    </div>
  );
}
```

### 品牌扩展面板（`components/ExtensionPanel.tsx`）

```tsx
export function ExtensionPanel({ extensions, brand }: { extensions: any; brand: string }) {
  if (!extensions || !extensions[brand.toLowerCase()]) {
    return <p>暂无品牌特有数据</p>;
  }

  const data = extensions[brand.toLowerCase()];

  return (
    <div className="extension-panel">
      {Object.entries(data).map(([key, value]) => (
        <div key={key} className="ext-item">
          <span className="ext-key">{key}</span>
          <span className="ext-value">{String(value)}</span>
        </div>
      ))}
    </div>
  );
}
```

### 验证
- 点击 `FANUC_M20iD_001` → URL 变 `/robot/FANUC_M20iD_001`
- 看到 FANUC 专属 R 寄存器数据
- 点击 `KUKA_KR210_002` → 看到 KUKA 安全门状态
- 点击 `peanut-001` → 看到电量 + 位置

---

## 七、P1-2：告警流完善

### 所有 mock 都发告警

在 `fanuc_mock.py` 里加随机告警生成：

```python
import random

ALARM_POOL = [
    {"code": "SRVO-062", "severity": "WARNING", "desc": "伺服放大器过热"},
    {"code": "SRVO-075", "severity": "ERROR", "desc": "关节 2 超速"},
    {"code": "SRVO-214", "severity": "WARNING", "desc": "制动器温度高"},
    {"code": "INTP-311", "severity": "INFO", "desc": "程序暂停"},
]

def generate_alarm():
    if random.random() < 0.15:  # 15% 概率发一条告警
        return [random.choice(ALARM_POOL)]
    return []
```

在 payload 里：
```python
"alarms": generate_alarm(),
```

### 告警流组件（`components/AlarmStream.tsx`）

```tsx
import { useRobotStore } from '../store/robotStore';

export function AlarmStream() {
  const alerts = useRobotStore(s => s.alerts);

  return (
    <div className="alarm-stream">
      <h2>实时告警流</h2>
      <div className="alarm-list">
        {alerts.slice(0, 20).map((a, i) => (
          <div key={i} className={`alarm-item severity-${a.severity}`}>
            <span className="alarm-time">{new Date(a.occurred_at).toLocaleTimeString()}</span>
            <span className="alarm-robot">{a.robot_id}</span>
            <span className="alarm-code">{a.raw_code}</span>
            <span className="alarm-desc">{a.zh_desc}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
```

### CSS 告警颜色

```css
.alarm-item.severity-ERROR { border-left: 4px solid #ef4444; }
.alarm-item.severity-WARNING { border-left: 4px solid #f59e0b; }
.alarm-item.severity-INFO { border-left: 4px solid #3b82f6; }
```

---

## 八、P1-3：趋势图（Chart.js 集成）

### 安装依赖

```bash
cd ~/Desktop/robot-ops-solo
pnpm add chart.js react-chartjs-2
```

### 趋势图组件（`components/TrendChart.tsx`）

```tsx
import { Line } from 'react-chartjs-2';
import { useEffect, useState } from 'react';
import { useRobotStore } from '../store/robotStore';

export function TrendChart({ robotId, metric }: { robotId: string; metric: 'temp_c' | 'load_pct' | 'current_a' }) {
  const robot = useRobotStore(s => s.robots.get(robotId));
  const [history, setHistory] = useState<number[]>([]);
  const [labels, setLabels] = useState<string[]>([]);

  useEffect(() => {
    if (!robot) return;
    const val = robot.joints[0]?.[metric] ?? 0;
    const time = new Date().toLocaleTimeString();
    setHistory(h => [...h.slice(-30), val]); // 保留最近 30 个点
    setLabels(l => [...l.slice(-30), time]);
  }, [robot?.joints]);

  const data = {
    labels,
    datasets: [{
      label: metric,
      data: history,
      borderColor: '#3b82f6',
      backgroundColor: 'rgba(59, 130, 246, 0.1)',
      fill: true,
      tension: 0.3,
    }],
  };

  const options = {
    responsive: true,
    scales: { y: { beginAtZero: true } },
    plugins: { legend: { display: false } },
  };

  return <Line data={data} options={options} />;
}
```

### 在详情页使用

```tsx
<TrendChart robotId={robotId!} metric="temp_c" />
<TrendChart robotId={robotId!} metric="load_pct" />
```

---

## 九、P1-4：品牌 Registry（统一管理品牌样式）

### 文件（`utils/brandRegistry.ts`）

```typescript
export interface BrandConfig {
  name: string;
  color: string;       // 主题色
  badgeBg: string;     // 标签背景
  icon: string;        // emoji 或图标路径
  protocol: string;    // 默认协议
  category: 'industrial_arm' | 'mobile_robot' | 'collaborative';
}

export const BRAND_REGISTRY: Record<string, BrandConfig> = {
  fanuc:  { name: 'FANUC',  color: '#1e40af', badgeBg: '#dbeafe', icon: '🤖', protocol: 'FOCAS', category: 'industrial_arm' },
  kuka:   { name: 'KUKA',   color: '#dc2626', badgeBg: '#fee2e2', icon: '🦾', protocol: 'OPC_UA', category: 'industrial_arm' },
  estun:  { name: 'ESTUN',  color: '#ea580c', badgeBg: '#ffedd5', icon: '🏭', protocol: 'MODBUS', category: 'industrial_arm' },
  yaskawa:{ name: 'YASKAWA',color: '#16a34a', badgeBg: '#dcfce7', icon: '⚙️', protocol: 'HSE', category: 'industrial_arm' },
  abb:    { name: 'ABB',    color: '#7c3aed', badgeBg: '#ede9fe', icon: '🔧', protocol: 'OPC_UA', category: 'industrial_arm' },
  keenon: { name: 'Keenon', color: '#0891b2', badgeBg: '#cffafe', icon: '🚶', protocol: 'REST', category: 'mobile_robot' },
  unitree:{ name: 'Unitree',color: '#9333ea', badgeBg: '#f3e8ff', icon: '🐕', protocol: 'ROS2', category: 'mobile_robot' },
  ur:     { name: 'Universal Robots', color: '#0d9488', badgeBg: '#ccfbf1', icon: '🤝', protocol: 'REST', category: 'collaborative' },
};

export function getBrandConfig(brand: string): BrandConfig {
  return BRAND_REGISTRY[brand.toLowerCase()] || {
    name: brand.toUpperCase(),
    color: '#6b7280',
    badgeBg: '#f3f4f6',
    icon: '❓',
    protocol: 'UNKNOWN',
    category: 'collaborative',
  };
}
```

### 使用方式

```tsx
import { getBrandConfig } from '../utils/brandRegistry';

function RobotCard({ robot }) {
  const brand = getBrandConfig(robot.brand);
  return (
    <div className="card" style={{ borderLeftColor: brand.color }}>
      <h3>{brand.icon} {robot.robot_id}</h3>
      <span style={{ background: brand.badgeBg, color: brand.color }}>
        {brand.name}
      </span>
    </div>
  );
}
```

---

## 十、完整文件改动汇总

| 文件 | 操作 | 说明 |
|------|------|------|
| `protocol/mqtt-client.ts` | **修改** | 加重连参数 + 错误处理 |
| `store/robotStore.ts` | **修改** | 加 `last_seen_ts` + `markOfflineIfStale` |
| `utils/robotType.ts` | **新建** | 机器人类型判断 |
| `utils/brandRegistry.ts` | **新建** | 品牌配置统一管理 |
| `components/RobotCard.tsx` | **修改** | 按类型差异化渲染 |
| `components/ExtensionPanel.tsx` | **新建** | 品牌扩展数据面板 |
| `components/AlarmStream.tsx` | **修改** | 多品牌告警聚合 |
| `components/TrendChart.tsx` | **新建** | Chart.js 趋势图 |
| `pages/RobotDetail.tsx` | **新建** | 机器人详情页 |
| `App.tsx` | **修改** | 加路由 + 定时器 |
| `roboticsops-edge/fanuc_mock.py` | **修改** | 加 pose + 告警 |
| `roboticsops-edge/kuka_mock.py` | **修改** | 加 pose + 告警 |
| `styles.css` | **修改** | 品牌色 + 状态样式 |

---

## 十一、开发顺序建议（3–5 天）

```
Day 1（上午）：修复 P0 四个问题
  ├── WebSocket 重连参数 ✅
  ├── 在线状态判定 ✅
  ├── 电量/位置差异化 ✅
  └── Pose 数据补全 ✅

Day 1（下午）：品牌 Registry + 路由
  ├── brandRegistry.ts ✅
  ├── robotType.ts ✅
  └── App.tsx 加路由 ✅

Day 2：详情页
  ├── RobotDetail.tsx ✅
  ├── ExtensionPanel.tsx ✅
  ├── JointTable.tsx（完善）✅
  └── AlarmHistory.tsx ✅

Day 3：趋势图 + 告警流
  ├── Chart.js 集成 ✅
  ├── TrendChart.tsx ✅
  └── 所有 mock 发告警 ✅

Day 4：打磨 + 测试
  ├── 暗色主题（可选）
  ├── 响应式布局
  ├── 断网/重连压力测试
  └── 6 台机器人同时跑 30 分钟无内存泄漏

Day 5：截图 + 录屏
  ├── 6 台同屏截图
  ├── 点进 FANUC 详情录屏
  ├── 点进 KUKA 详情录屏
  └── 告警触发 + 恢复录屏
```

---

## 十二、验证 Checklist（每天收工时过一遍）

### Day 1 收工标准
- [ ] 6/6 机器人显示在线（mock 全开）
- [ ] 停 1 台 mock → 15 秒后变离线
- [ ] 工业臂不显示电量，移动机器人不显示负载
- [ ] 坐标不是 (0,0,0)
- [ ] WS 不频繁重连

### Day 2 收工标准
- [ ] 点击任何卡片 → 进入详情页
- [ ] URL 变成 `/robot/{robot_id}`
- [ ] FANUC 详情显示 R 寄存器
- [ ] KUKA 详情显示安全门状态
- [ ] 品牌颜色统一

### Day 3 收工标准
- [ ] 趋势图实时滚动（30 个点）
- [ ] 所有品牌都发告警
- [ ] 告警流显示品牌 + 时间 + 描述
- [ ] 告警颜色按严重等级区分

### Day 5 收工标准
- [ ] 有 3 段以上演示录屏
- [ ] 截图能放进 BP / 路演 PPT
- [ ] 浏览器开 2 小时不崩
- [ ] 断网恢复后自动重连成功

---

*文档版本：v1.0 | 2026-08-19 | 适用于 robot-ops-solo 项目下一步开发*
