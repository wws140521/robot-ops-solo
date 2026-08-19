# robot-ops-solo 多品牌接入开发文档

> **目标**：把 FANUC + KUKA 两套 mock 数据，通过 MQTT 接入你自己的 React 前端，Dashboard 上同屏显示、自动识别品牌、数据实时刷新。
> **预计耗时**：30–60 分钟（含安装依赖）
> **前置条件**：你的项目已能 `pnpm dev` 跑起来，本地已装 mosquitto 并能启动

---

## 一、整体架构（先看清全貌）

```
┌──────────────────────────────────────────────────────────────┐
│                     数据产生层（边缘）                        │
│                                                              │
│  fanuc_mock.py ──┐                                          │
│  kuka_mock.py  ──┼──→ MQTT Broker (localhost:1883)         │
│                   │         + WebSocket (localhost:9001)     │
│                   │                  │                       │
└──────────────────────────────────────────────────────────────┘
                                        │ MQTT over WebSocket
                                        ▼
┌──────────────────────────────────────────────────────────────┐
│                     前端接入层（浏览器）                      │
│                                                              │
│  mqtt-client.ts ──→ adaptByBrand() ──→ robotStore.ts        │
│       │                              └──→ alertStore.ts     │
│       │                                                      │
│       ▼                                                      │
│  Dashboard 组件（按 robot_id 渲染多张卡片）                    │
└──────────────────────────────────────────────────────────────┘
```

**数据流一句话**：mock 脚本发 JSON → mosquitto 转发 → 浏览器 mqtt-client 收 → 适配器按 brand 解析 → store 更新 → 组件重渲染。

---

## 二、目录结构（改动前后对比）

```
robot-ops-solo/
├── docs/
│   ├── POC-现场执行清单.md          ← 已有
│   ├── 网关选型与容量规划.md         ← 已有
│   └── 多品牌接入开发文档.md         ← 本文档（新建）
│
├── roboticsops-edge/                 ← Python 边缘侧
│   ├── venv/                        ← 已有
│   ├── fanuc_mock.py                ← 已有
│   └── kuka_mock.py                 ← ✅ 新建（本文第三节）
│
└── packages/
    └── adapter-kit/
        └── src/
            ├── types/
            │   └── unified.ts               ← 已有（UDM 定义）
            ├── adapters/
            │   ├── index.ts                 ← ✅ 修改（加 adaptByBrand）
            │   └── industrial/
            │       └── adapter-fanuc.ts     ← 已有
            │       └── adapter-kuka.ts      ← ✅ 新建（本文第四节）
            ├── store/
            │   └── robotStore.ts            ← ✅ 新建（本文第五节）
            └── protocol/
                └── mqtt-client.ts           ← ✅ 新建（本文第六节）
```

**改动总结**：新建 5 个文件 + 修改 1 个文件。

---

## 三、边缘侧：KUKA Mock 脚本

> 文件：`roboticsops-edge/kuka_mock.py`

### 3.1 完整代码（直接复制）

```python
#!/usr/bin/env python3
"""
kuka_mock.py — KUKA KR 系列机器人数据模拟器
发布主题: roboticsops/telemetry
品牌标识: brand = "KUKA"
协议: OPC_UA (模拟)
"""

import json
import random
import time
import uuid
from datetime import datetime, timezone, timedelta

import paho.mqtt.client as mqtt

# ── 配置 ──────────────────────────────────────────────
BROKER_HOST = "localhost"
BROKER_PORT = 1883
TOPIC = "roboticsops/telemetry"
PUBLISH_INTERVAL = 5  # 秒

ROBOT_ID = "KUKA_KR210_002"
MODEL = "KR210_R3100"
BRAND = "KUKA"
PROTOCOL = "OPC_UA"

# 时区（北京时间）
TZ = timezone(timedelta(hours=8))

# KUKA 告警码池（真实 KUKA 告警码格式）
KUKA_ALARMS = [
    None,  # 60% 概率无告警
    None,
    None,
    {"code": "KSS01005", "severity": "warning", "desc": "Axis 2 motor temperature high"},
    {"code": "KSS01111", "severity": "info",    "desc": "Battery voltage low"},
    {"code": "KSS01040", "severity": "error",   "desc": "Safety gate open during auto mode"},
    {"code": "KSS00404", "severity": "warning", "desc": "Axis 4 velocity limit approached"},
]


def now_iso():
    """返回北京时间 ISO 格式时间戳"""
    return datetime.now(TZ).strftime("%Y-%m-%dT%H:%M:%S+08:00")


def gen_kuka_payload():
    """生成一条 KUKA 格式的 UDM JSON"""
    joints = []
    for j in range(1, 7):  # KUKA KR210 有 6 个轴
        base_temp = 35 + j * 3  # 各轴基础温度不同
        base_load = 40 + j * 5
        joints.append({
            "j": j,
            "name": f"Axis{j}",
            "load_pct": round(base_load + random.uniform(-10, 15), 1),
            "temp_c": round(base_temp + random.uniform(-3, 8), 1),
            "current_a": round(8 + j * 1.5 + random.uniform(-2, 3), 2),
            "torque_nm": round(120 + j * 20 + random.uniform(-30, 40), 1),
            "health_score": random.randint(55, 95),
        })

    # 随机选一个告警（含 None = 无告警）
    alarm = random.choice(KUKA_ALARMS)

    payload = {
        "schema_version": "1.0",
        "robot_id": ROBOT_ID,
        "brand": BRAND,
        "model": MODEL,
        "protocol": PROTOCOL,
        "timestamp": now_iso(),
        "joints": joints,
        "alarms": [
            {
                "raw_code": alarm["code"],
                "severity": alarm["severity"],
                "zh_desc": alarm["desc"],
                "occurred_at": now_iso(),
                "cleared": False,
            }
        ] if alarm else [],
        "runtime": {
            "power_on_hours": random.randint(2000, 8000),
            "cycle_count": random.randint(50000, 200000),
            "mode": random.choice(["AUT", "MAN", "EXT"]),
        },
        "extensions": {
            "kuka": {
                "safety_gate_open": random.choice([False, False, False, True]),
                "robroot_offset_x": round(random.uniform(-2, 2), 3),
                "robroot_offset_y": round(random.uniform(-2, 2), 3),
                "robroot_offset_z": round(random.uniform(-5, 5), 3),
                "opcua_node_count": random.randint(120, 180),
                "workvisual_project": "KR210_Line3_v2.1",
            }
        }
    }
    return payload


def on_connect(client, userdata, flags, rc):
    if rc == 0:
        print(f"✅ KUKA mock connected to {BROKER_HOST}:{BROKER_PORT}")
    else:
        print(f"❌ KUKA mock connect failed, rc={rc}")


def main():
    client = mqtt.Client(client_id=f"kuka-mock-{uuid.uuid4().hex[:6]}")
    client.on_connect = on_connect
    client.connect(BROKER_HOST, BROKER_PORT, keepalive=10)
    client.loop_start()

    print(f"📡 Publishing to topic: {TOPIC}")
    print(f"🤖 Mock robot: {ROBOT_ID} (Ctrl+C to stop)\n")

    try:
        while True:
            payload = gen_kuka_payload()
            json_str = json.dumps(payload, ensure_ascii=False)
            client.publish(TOPIC, json_str, qos=1)
            print(f"[{now_iso()}] ✅ Published KUKA JSON ({len(json_str)} bytes)")
            time.sleep(PUBLISH_INTERVAL)
    except KeyboardInterrupt:
        print("\n👋 KUKA mock stopped")
        client.loop_stop()
        client.disconnect()


if __name__ == "__main__":
    main()
```

### 3.2 验证 KUKA mock 能跑

```bash
cd ~/Desktop/robot-ops-solo/roboticsops-edge
source venv/bin/activate
python kuka_mock.py
```

期望输出：
```
✅ KUKA mock connected to localhost:1883
📡 Publishing to topic: roboticsops/telemetry
🤖 Mock robot: KUKA_KR210_002 (Ctrl+C to stop)

[2026-08-18T15:30:05+08:00] ✅ Published KUKA JSON (1456 bytes)
[2026-08-18T15:30:10+08:00] ✅ Published KUKA JSON (1423 bytes)
```

---

## 四、适配器：KUKA 解析 + 工厂分发

### 4.1 新建 `adapter-kuka.ts`

> 文件：`packages/adapter-kit/src/adapters/industrial/adapter-kuka.ts`

```typescript
import type { UnifiedRobotState, UnifiedAlert } from '../../types/unified';

/**
 * 解析 KUKA OPC UA 格式的原始数据 → 统一数据模型
 */
export function adaptKuka(raw: any): { state: UnifiedRobotState; alerts: UnifiedAlert[] } {
  const joints = (raw.joints || []).map((j: any) => ({
    j: j.j ?? j.joint_index ?? 0,
    name: j.name ?? `Axis${j.j}`,
    load_pct: j.load_pct ?? 0,
    temp_c: j.temp_c ?? 0,
    current_a: j.current_a ?? 0,
    torque_nm: j.torque_nm ?? 0,
    health_score: j.health_score ?? 70,
  }));

  const overall_health = joints.length > 0
    ? Math.round(joints.reduce((s: number, j: any) => s + j.health_score, 0) / joints.length)
    : 70;

  const alerts: UnifiedAlert[] = (raw.alarms || []).map((a: any) => ({
    id: `${raw.robot_id}-${a.raw_code}-${raw.timestamp}`,
    robot_id: raw.robot_id,
    raw_code: a.raw_code,
    severity: a.severity ?? 'info',
    zh_desc: a.zh_desc ?? a.desc ?? 'Unknown alarm',
    occurred_at: a.occurred_at ?? raw.timestamp,
    cleared: a.cleared ?? false,
  }));

  const state: UnifiedRobotState = {
    robot_id: raw.robot_id,
    brand: 'KUKA',
    model: raw.model ?? 'Unknown',
    protocol: raw.protocol ?? 'OPC_UA',
    timestamp: raw.timestamp,
    joints,
    overall_health,
    runtime: {
      power_on_hours: raw.runtime?.power_on_hours ?? 0,
      cycle_count: raw.runtime?.cycle_count ?? 0,
      mode: raw.runtime?.mode ?? 'UNKNOWN',
    },
    extensions: raw.extensions ?? {},
  };

  return { state, alerts };
}
```

### 4.2 修改 `adapters/index.ts`（加工厂函数）

> 文件：`packages/adapter-kit/src/adapters/index.ts`

在文件**末尾**追加以下内容（保留原有代码不动）：

```typescript
import { adaptFanuc } from './industrial/adapter-fanuc';
import { adaptKuka } from './industrial/adapter-kuka';

/**
 * 品牌适配器工厂
 * 根据 raw.brand 自动分发到对应适配器
 */
export function adaptByBrand(brand: string, raw: any) {
  const lower = (brand || '').toLowerCase();

  switch (lower) {
    case 'fanuc':
      return adaptFanuc(raw);
    case 'kuka':
      return adaptKuka(raw);
    // 后续扩展：
    // case 'yaskawa': return adaptYaskawa(raw);
    // case 'estun':   return adaptEstun(raw);
    // case 'abb':     return adaptAbb(raw);
    default:
      console.warn(`[adapter] unknown brand: ${brand}, falling back to generic`);
      return adaptGeneric(raw);
  }
}

/**
 * 通用兜底适配器（未知品牌走这里）
 */
function adaptGeneric(raw: any) {
  const joints = (raw.joints || []).map((j: any) => ({
    j: j.j ?? 0,
    name: j.name ?? `Joint${j.j}`,
    load_pct: j.load_pct ?? 0,
    temp_c: j.temp_c ?? 0,
    current_a: j.current_a ?? 0,
    torque_nm: j.torque_nm ?? 0,
    health_score: j.health_score ?? 70,
  }));

  const alerts: any[] = (raw.alarms || []).map((a: any) => ({
    id: `${raw.robot_id}-${a.raw_code}-${raw.timestamp}`,
    robot_id: raw.robot_id,
    raw_code: a.raw_code ?? 'UNKNOWN',
    severity: a.severity ?? 'info',
    zh_desc: a.zh_desc ?? a.desc ?? 'Unknown',
    occurred_at: a.occurred_at ?? raw.timestamp,
    cleared: a.cleared ?? false,
  }));

  return {
    state: {
      robot_id: raw.robot_id ?? 'UNKNOWN',
      brand: raw.brand ?? 'UNKNOWN',
      model: raw.model ?? 'Unknown',
      protocol: raw.protocol ?? 'UNKNOWN',
      timestamp: raw.timestamp ?? new Date().toISOString(),
      joints,
      overall_health: raw.overall_health ?? 70,
      runtime: raw.runtime ?? {},
      extensions: raw.extensions ?? {},
    },
    alerts,
  };
}
```

---

## 五、状态管理：多机器人 Store

> 文件：`packages/adapter-kit/src/store/robotStore.ts`

```typescript
import { create } from 'zustand';
import type { UnifiedRobotState } from '../types/unified';

interface RobotStore {
  /** 以 robot_id 为 key 存储所有机器人最新状态 */
  robots: Record<string, UnifiedRobotState>;
  /** 更新单台机器人状态（新数据覆盖旧数据） */
  updateRobot: (state: UnifiedRobotState) => void;
  /** 批量更新 */
  updateRobots: (states: UnifiedRobotState[]) => void;
  /** 获取某台机器人 */
  getRobot: (robotId: string) => UnifiedRobotState | undefined;
  /** 获取所有机器人列表 */
  getAllRobots: () => UnifiedRobotState[];
  /** 清空 */
  clearAll: () => void;
}

export const useRobotStore = create<RobotStore>((set, get) => ({
  robots: {},

  updateRobot: (state) =>
    set((prev) => ({
      robots: { ...prev.robots, [state.robot_id]: state },
    })),

  updateRobots: (states) =>
    set((prev) => {
      const next = { ...prev.robots };
      for (const s of states) next[s.robot_id] = s;
      return { robots: next };
    }),

  getRobot: (robotId) => get().robots[robotId],

  getAllRobots: () => Object.values(get().robots),

  clearAll: () => set({ robots: {} }),
}));
```

> 💡 **zustand 安装**：`pnpm add zustand`（如果项目还没装的话）

---

## 六、协议层：MQTT 客户端（WebSocket 版）

> 文件：`packages/adapter-kit/src/protocol/mqtt-client.ts`

```typescript
import mqtt from 'mqtt';
import type { UnifiedRobotState, UnifiedAlert } from '../types/unified';
import { adaptByBrand } from '../adapters';

/**
 * MQTT over WebSocket 客户端
 * 连接本地 mosquitto (ws://localhost:9001)
 * 订阅 roboticsops/telemetry
 * 收到消息 → adaptByBrand → 回调
 */

const MQTT_BROKER = 'ws://localhost:9001';
const TELEMETRY_TOPIC = 'roboticsops/telemetry';

type TelemetryCallback = (state: UnifiedRobotState, alerts: UnifiedAlert[]) => void;

let client: mqtt.MqttClient | null = null;
let callback: TelemetryCallback | null = null;

export function connectMqtt(cb: TelemetryCallback) {
  callback = cb;

  if (client && client.connected) {
    console.log('[mqtt-client] already connected');
    return;
  }

  client = mqtt.connect(MQTT_BROKER, {
    clientId: `robotops-web-${Math.random().toString(16).slice(2, 8)}`,
    clean: true,
    reconnectPeriod: 3000,
  });

  client.on('connect', () => {
    console.log(`[mqtt-client] ✅ connected to ${MQTT_BROKER}`);
    client!.subscribe(TELEMETRY_TOPIC, (err) => {
      if (err) console.error('[mqtt-client] subscribe error:', err);
      else console.log(`[mqtt-client] 📡 subscribed to ${TELEMETRY_TOPIC}`);
    });
  });

  client.on('message', (_topic, payload) => {
    try {
      const raw = JSON.parse(payload.toString());
      const brand = raw.brand || 'UNKNOWN';
      const { state, alerts } = adaptByBrand(brand, raw);
      callback?.(state, alerts);
    } catch (e) {
      console.error('[mqtt-client] parse error:', e);
    }
  });

  client.on('error', (err) => {
    console.error('[mqtt-client] error:', err);
  });

  client.on('offline', () => {
    console.warn('[mqtt-client] offline, reconnecting...');
  });
}

export function disconnectMqtt() {
  if (client) {
    client.end();
    client = null;
    console.log('[mqtt-client] disconnected');
  }
}
```

---

## 七、接入入口：在 wsHub 或 App 初始化时启动

> 假设你的入口在 `apps/web-console/src/lib/wsHub.ts` 或 `App.tsx`

### 方式 A：在 wsHub.ts 里接入

```typescript
// apps/web-console/src/lib/wsHub.ts
import { connectMqtt } from '@robot-ops-solo/adapter-kit/protocol/mqtt-client';
import { useRobotStore } from '@robot-ops-solo/adapter-kit/store/robotStore';
import { useAlertStore } from '@robot-ops-solo/adapter-kit/store/alertStore'; // 如果有的话

let started = false;

export function startMqtt() {
  if (started) return;
  started = true;

  connectMqtt((state, alerts) => {
    // 更新机器人状态
    useRobotStore.getState().updateRobot(state);

    // 更新告警（如果有 alertStore）
    if (alerts.length > 0) {
      useAlertStore.getState().addAlerts(alerts);
    }

    console.log(`[wsHub] 🤖 ${state.robot_id} | brand=${state.brand} | health=${state.overall_health} | joints=${state.joints.length}`);
  });
}
```

### 方式 B：在 React App.tsx 里直接调

```typescript
// apps/web-console/src/App.tsx
import { useEffect } from 'react';
import { startMqtt } from './lib/wsHub';

export default function App() {
  useEffect(() => {
    startMqtt(); // 应用启动即连 MQTT
  }, []);

  return <YourDashboard />;
}
```

---

## 八、Dashboard 组件：渲染多台机器人卡片

> 示例组件，放到你的 `apps/web-console/src/components/` 下

```tsx
// RobotCards.tsx
import { useRobotStore } from '@robot-ops-solo/adapter-kit/store/robotStore';

const BRAND_COLORS: Record<string, string> = {
  FANUC: '#0050A0',
  KUKA:  '#E2001A',
  YASKAWA: '#FF6600',
  ABB:  '#CC0000',
  ESTUN: '#009944',
};

const HEALTH_COLORS = {
  good: '#22c55e',
  warn: '#eab308',
  bad:  '#ef4444',
};

function healthColor(score: number) {
  if (score >= 80) return HEALTH_COLORS.good;
  if (score >= 60) return HEALTH_COLORS.warn;
  return HEALTH_COLORS.bad;
}

export function RobotCards() {
  const robots = useRobotStore((s) => s.getAllRobots());

  if (robots.length === 0) {
    return <div style={{ padding: 20 }}>等待 MQTT 数据接入...</div>;
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 16, padding: 16 }}>
      {robots.map((r) => {
        const brandColor = BRAND_COLORS[r.brand] || '#666';
        return (
          <div key={r.robot_id} style={{ border: `2px solid ${brandColor}`, borderRadius: 12, padding: 16, background: '#fff' }}>
            {/* 头部：品牌 + 型号 */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <div>
                <span style={{ background: brandColor, color: '#fff', padding: '2px 8px', borderRadius: 4, fontSize: 12, fontWeight: 700 }}>
                  {r.brand}
                </span>
                <span style={{ marginLeft: 8, fontSize: 14, color: '#666' }}>{r.model}</span>
              </div>
              <div style={{ fontSize: 12, color: '#999' }}>{r.robot_id}</div>
            </div>

            {/* 健康分 */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
              <div style={{ width: 60, height: 60, borderRadius: '50%', background: healthColor(r.overall_health), color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, fontWeight: 700 }}>
                {r.overall_health}
              </div>
              <div>
                <div style={{ fontSize: 13, color: '#666' }}>健康分</div>
                <div style={{ fontSize: 12, color: '#999' }}>协议: {r.protocol}</div>
              </div>
            </div>

            {/* 关节表格 */}
            <table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#f5f5f5' }}>
                  <th style={th}>轴</th>
                  <th style={th}>负载%</th>
                  <th style={th}>温度℃</th>
                  <th style={th}>电流A</th>
                  <th style={th}>健康</th>
                </tr>
              </thead>
              <tbody>
                {r.joints.map((j) => (
                  <tr key={j.j}>
                    <td style={td}>{j.name}</td>
                    <td style={td}>{j.load_pct.toFixed(1)}</td>
                    <td style={td}>{j.temp_c.toFixed(1)}</td>
                    <td style={td}>{j.current_a.toFixed(1)}</td>
                    <td style={{ ...td, color: healthColor(j.health_score) }}>{j.health_score}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* 告警条 */}
            {r.extensions?.[r.brand.toLowerCase()] && (
              <div style={{ marginTop: 10, padding: 8, background: '#f9f9f9', borderRadius: 6, fontSize: 11, color: '#666' }}>
                {r.brand === 'KUKA' && (
                  <>安全门: {r.extensions.kuka.safety_gate_open ? '🔴 开启' : '🟢 关闭'} | 项目: {r.extensions.kuka.workvisual_project}</>
                )}
                {r.brand === 'FANUC' && (
                  <>刀具寿命: {r.extensions.fanuc.tool_life_pct}% | 宏: {r.extensions.fanuc.macro_status}</>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

const th: React.CSSProperties = { padding: '4px 6px', textAlign: 'left', fontSize: 11, color: '#666' };
const td: React.CSSProperties = { padding: '3px 6px', borderBottom: '1px solid #eee' };
```

---

## 九、Mosquitto 配置（开启 WebSocket）

### 9.1 创建配置文件

```bash
cat > /tmp/mosquitto-ws.conf << 'EOF'
listener 1883
listener 9001
protocol websockets
allow_anonymous true
EOF
```

### 9.2 启动

```bash
/opt/homebrew/opt/mosquitto/sbin/mosquitto -c /tmp/mosquitto-ws.conf -v
```

期望看到：
```
Opening ipv4 listen socket on port 1883.
Opening websockets listen socket on port 9001.
```

---

## 十、完整启动流程（照着做）

### 终端 1：启动 Mosquitto

```bash
/opt/homebrew/opt/mosquitto/sbin/mosquitto -c /tmp/mosquitto-ws.conf -v
```

### 终端 2：启动 FANUC Mock

```bash
cd ~/Desktop/robot-ops-solo/roboticsops-edge
source venv/bin/activate
python fanuc_mock.py
```

### 终端 3：启动 KUKA Mock

```bash
cd ~/Desktop/robot-ops-solo/roboticsops-edge
source venv/bin/activate
python kuka_mock.py
```

### 终端 4：启动前端

```bash
cd ~/Desktop/robot-ops-solo
pnpm --filter web-console dev
```

浏览器打开 `http://localhost:5173` → 看到 **两张机器人卡片** 同时刷新 ✅

---

## 十一、验证清单

| 检查项 | 怎么看 | 通过了什么样 |
|--------|--------|-------------|
| Mosquitto 双端口 | `lsof -i :1883` + `lsof -i :9001` | 都有 LISTEN |
| FANUC 在发数据 | 终端 2 每 5 秒输出 | `Published FANUC JSON` |
| KUKA 在发数据 | 终端 3 每 5 秒输出 | `Published KUKA JSON` |
| 前端连上 MQTT | 浏览器 Console | `[mqtt-client] ✅ connected` |
| 订阅成功 | 浏览器 Console | `[mqtt-client] 📡 subscribed` |
| Dashboard 有数据 | 页面渲染 | 看到 2 张卡片 |
| 品牌识别正确 | 卡片 badge 颜色 | FANUC 蓝、KUKA 红 |
| 数据在动 | 每 5 秒刷新 | 数字变化、时间戳更新 |
| 告警出现 | 随机弹告警条 | KSSxxxxx / SRVO-xxx |
| 停一台 mock | Ctrl+C 终端 2 | 对应卡片停更，另一台继续 |

---

## 十二、常见问题排查

| 问题 | 原因 | 解决 |
|------|------|------|
| 浏览器连不上 ws:9001 | mosquitto 没开 ws | 重做第九节，确认 9001 在 LISTEN |
| `Cannot find module 'mqtt'` | 没装依赖 | `pnpm add mqtt` |
| `Cannot find module 'zustand'` | 没装依赖 | `pnpm add zustand` |
| Dashboard 空白 | MQTT 没连上 | Console 看报错，先确认 mosquitto 在跑 |
| 只看到 1 张卡片 | 另一个 mock 没跑 | 确认两个终端都在跑 |
| 数据格式错 | adapter 解析字段对不上 | Console 看 `parse error`，核对 mock JSON key |
| 端口被占用 | 之前 mosquitto 没退干净 | `killall mosquitto` 再启动 |

---

## 十三、后续扩展路线

| 阶段 | 动作 | 效果 |
|------|------|------|
| ✅ 现在 | FANUC + KUKA mock 同屏 | 路演够用 |
| 🔜 下一步 | 加 YASKAWA / ABB mock + adapter | 3–4 品牌同屏 |
| 🔜 真机 | 边缘网关替换 mock | 真实数据采集 |
| 🔜 AI | 健康分算法 + RUL 预测 | 差异化价值 |
| 🔜 部署 | 云端 MQTT + 多租户 | SaaS 化 |

---

*文档版本: v1.0 | 2026-08-19 | robot-ops-solo 多品牌接入完整开发指南*
