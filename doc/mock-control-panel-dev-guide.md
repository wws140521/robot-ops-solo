# Mock 操作页面开发文档

> **版本**：v1.0  
> **日期**：2026-09-07  
> **关联**：README.md · mock-ws-server.js · adapter-kit · robotStore  
> **用途**：路演 Demo 双向控制 + 开发调试 + 验收测试

---

## 1. 设计目标

### 1.1 核心诉求

现有一键演示剧本（`mock-ws-server.js` 的 `:8082` 端口）是**单向广播**——服务端按预设脚本推进状态，前端被动接收。路演时无法"人机互动"，评审看不到"运维人员下发指令 → 机器人响应 → 状态实时回传"的完整闭环。

**Mock 操作页面**要解决的是：**让任何浏览器都能成为"指挥中心"，点击按钮/拖动滑块 → MQTT 指令下发 → 控制服务修改状态 → telemetry 重新广播 → Dashboard 实时刷新**，形成完整的双向控制链路。

### 1.2 设计原则

| 原则 | 说明 |
|------|------|
| **不污染生产代码** | 操作页面独立部署，不侵入 `apps/web-console/` 路由和组件 |
| **双向闭环** | 每个操作都有"指令→状态变更→telemetry→Dashboard 刷新"的完整链路 |
| **协议对齐** | MQTT Topic 和 payload 格式严格对齐 `python-edge/` 和 `roboticsops-edge/` 的实际协议 |
| **断网可用** | 支持直连 `mock-ws-server.js`（WebSocket）和本地 MQTT broker（mosquitto）两种模式 |
| **路演优先** | 30 秒内能完成"启动→告警→停止→复位"完整剧本 |
| **类型安全** | 指令/状态/遥测全部对齐 `adapter-kit/src/types/unified.ts` 的 `UnifiedRobotState` |

### 1.3 不做的事

- ❌ 不实现真实机器人控制协议（FOCAS/OPC UA 等）——那是 `python-edge/` 的事
- ❌ 不修改 `web-console` 的 `wsHub.ts` 控制流——操作页面走独立通道
- ❌ 不做用户认证——操作页面是开发/路演工具，无鉴权
- ❌ 不做持久化——指令无状态，刷新即重置

---

## 2. 系统架构

### 2.1 组件关系图

```
┌─────────────────────────────────────────────────────────────────────┐
│                        Mock 操作页面架构                             │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌──────────────┐    HTTP/WS    ┌──────────────────┐               │
│  │  Control UI  │ ◄──────────► │  Control Service  │               │
│  │  (浏览器)     │   REST API    │  (Node.js :3000) │               │
│  │              │               │                  │               │
│  │ · 设备选择器  │               │ · 状态权威       │               │
│  │ · 指令按钮   │               │ · 指令校验       │               │
│  │ · 参数滑块   │               │ · 场景脚本引擎   │               │
│  │ · 场景一键   │               │ · MQTT 发布器    │               │
│  └──────────────┘               └────────┬─────────┘               │
│         │                               │                          │
│         │ 指令                           │ MQTT: control/+/command │
│         ▼                               ▼                          │
│  ┌──────────────┐    MQTT     ┌──────────────────┐                │
│  │   Dashboard   │ ◄────────► │  Mock WS Server  │                │
│  │  (现有前端)    │ telemetry   │  (:8080/:8081/   │                │
│  │              │               │   :8082)         │                │
│  │ robotStore   │               │                  │                │
│  │ alertStore   │               │ · 订阅 control   │                │
│  └──────────────┘               │ · 修改内部状态   │                │
│         │                       │ · 重发 telemetry │                │
│         ▼                       └──────────────────┘                │
│  ┌──────────────┐                                               │
│  │ 3D 孪生/图表  │                                               │
│  │ (TwinPage)   │                                               │
│  └──────────────┘                                               │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### 2.2 数据流（完整闭环）

```
[1] 用户在 Control UI 点击「⚠ 触发告警」
        │
        ▼
[2] POST http://localhost:3000/api/command
    Body: { robotId: "FANUC-001", type: "trigger_alarm", params: { code: "SRVO-001" } }
        │
        ▼
[3] Control Service 校验 → 更新内部状态机 → 写入 alarm 队列
        │
        ▼
[4] MQTT Publish: topic = "industrial/robot/FANUC-001/command"
    Payload: { type: "trigger_alarm", code: "SRVO-001", ts: 1234567890 }
        │
        ▼
[5] Mock WS Server (:8082) 订阅该 topic → 修改 FANUC-001 的 alarm 列表
        │
        ▼
[6] Mock WS Server 下次 telemetry tick 推送更新后的 UnifiedRobotState
    WebSocket frame → ws://localhost:8082/industrial
        │
        ▼
[7] Dashboard wsHub.ts 接收 → adaptByBrandEnhanced → robotStore.updateRobot
        │
        ▼
[8] React 组件重渲染：AlertsPage 新增告警、TwinPage 关节闪烁红光
```

### 2.3 与现有架构的集成点

| 集成点 | 现有代码 | 操作页面对接方式 |
|--------|---------|----------------|
| **状态类型** | `adapter-kit/src/types/unified.ts` → `UnifiedRobotState` | Control Service 内存状态完全对齐 `UnifiedRobotState` 结构 |
| **工业告警** | `adapter-kit/src/types/industrial.ts` → `IndustrialAlarm` | 指令触发的告警构造为 `IndustrialAlarm`（含 `raw_code` + `zh_desc`） |
| **MQTT Topic** | `python-edge/` → `industrial/robot/+/telemetry` | 控制指令走 `industrial/robot/+/command`（新增，不冲突） |
| **WS 分流** | `wsHub.ts` 商用/工业/OTA 三分流 | 操作页面通过 Control Service REST API 间接触发，不直连 wsHub |
| **品牌路由** | `adaptByBrandEnhanced(brand, raw)` | Control Service 按 `robotId` 前缀路由（FANUC-/KUKA-/UNITREE-） |
| **健康分** | `adapter-kit/src/health/` → `calcHealthScore` | 操作页面修改 `joints[].temperature` → 健康分自动重算 |
| **Dashboard 渲染** | `RobotsPage` / `TwinPage` / `AlertsPage` | 无需任何修改——telemetry 格式不变，前端无感 |

---

## 3. 项目结构

### 3.1 目录布局

```
robot-ops-solo/
├── mock-control/                        # 🆕 Mock 操作页面（独立子项目）
│   ├── server/
│   │   ├── index.js                     #   入口 · Express + MQTT 客户端
│   │   ├── state-engine.js              #   状态引擎 · 6 台设备完整状态树
│   │   ├── command-handler.js           #   指令处理器 · 校验 + 路由 + 执行
│   │   ├── scenario-engine.js           #   场景脚本引擎 · 预设剧本（路演用）
│   │   ├── mqtt-bridge.js               #   MQTT 双向桥接 · 订阅指令 + 发布 telemetry
│   │   └── routes/
│   │       ├── devices.js               #   GET /api/devices · 设备列表 + 当前状态
│   │       ├── command.js               #   POST /api/command · 单条指令下发
│   │       ├── batch.js                 #   POST /api/batch · 批量指令
│   │       ├── scenario.js              #   POST /api/scenario · 场景剧本启停
│   │       └── telemetry.js             #   GET /api/telemetry/stream · SSE 实时状态流
│   ├── web/                            #   操作页面前端（独立 HTML，无构建）
│   │   ├── index.html                   #   主页面 · 设备网格 + 控制面板
│   │   ├── css/
│   │   │   └── control-panel.css        #   样式 · 深色 HUD 风格（对齐 globals.css）
│   │   └── js/
│   │       ├── app.js                   #   入口 · 初始化 + 事件绑定
│   │       ├── device-grid.js           #   设备卡片网格 · 实时状态渲染
│   │       ├── control-panel.js         #   控制面板 · 按钮 + 滑块 + 输入框
│   │       ├── scenario-runner.js       #   场景执行器 · 一键剧本
│   │       └── api-client.js            #   API 客户端 · fetch 封装 + 错误处理
│   ├── config/
│   │   ├── devices.yaml                 #   设备定义（6 台：商用 2 + 工业 4）
│   │   └── topics.yaml                  #   MQTT Topic 模板（对齐 python-edge）
│   ├── test/
│   │   ├── unit/
│   │   │   ├── state-engine.test.js     #   状态引擎单元测试
│   │   │   ├── command-handler.test.js  #   指令处理器单元测试
│   │   │   └── scenario-engine.test.js  #   场景引擎单元测试
│   │   └── integration/
│   │       └── control-loop.test.js     #   端到端闭环测试（UI→API→MQTT→telemetry）
│   ├── package.json                     #   依赖 · express/mqtt/axios/vitest
│   └── README.md                        #   使用说明
│
├── mock-ws-server.js                    # 既有 · 需小幅改造（增加 command 订阅）
├── apps/web-console/                    # 不修改
└── packages/adapter-kit/                # 不修改
```

### 3.2 为什么独立子项目而非嵌入 web-console

| 维度 | 独立子项目（选择） | 嵌入 web-console |
|------|------------------|----------------|
| 启动复杂度 | 1 条命令 `pnpm --filter mock-control dev` | 需改路由、加页面、改构建 |
| 路演部署 | 单独开一个浏览器 Tab 即可 | 需登录、需路由权限 |
| 代码侵入 | 零 | 需改 wsHub、加 store、加路由 |
| 复用性 | 任何项目都能用（只要 MQTT 协议对齐） | 绑定 web-console |
| 类型对齐 | 手动对齐 `UnifiedRobotState`（文档化） | 直接 import 类型（更严格） |

> **结论**：路演场景下"独立、快速、不污染"优先于"类型严格"。

---

## 4. 设备数据模型

### 4.1 对齐 UnifiedRobotState

操作页面的内部状态树严格对齐 `adapter-kit/src/types/unified.ts` 的 `UnifiedRobotState`，确保 Control Service 发布的 telemetry 能被 `adaptByBrandEnhanced` 正确解析。

```typescript
// 操作页面内部状态（对齐 UnifiedRobotState 子集）
interface MockDeviceState {
  // ── 基础标识（UnifiedRobotState 对齐）
  robotId: string;                    // "FANUC-001"
  name: string;                       // "FANUC M-20iD #1"
  brand: 'unitree' | 'keenon' | 'pudutech' | 'agibot'
        | 'fanuc' | 'kuka' | 'estun' | 'yaskawa'
        | 'dji' | 'autel' | 'vertiport';
  deviceClass: 'ground_robot' | 'industrial_arm' | 'aerial_dock' | 'vertiport';
  online: boolean;

  // ── 运行状态
  status: 'idle' | 'moving' | 'working' | 'charging' | 'error' | 'offline';
  battery: number;                    // 0-100
  healthScore: number;                // 0-100（对接 health/ 算法）
  mode: 'auto' | 'manual' | 'maintenance';

  // ── 位置（地面机器人用）
  position?: { x: number; y: number; z: number };
  heading?: number;                   // 0-360

  // ── 工业关节遥测（工业机械臂用 · 对齐 IndustrialExtension）
  joints?: JointState[];              // 6 轴
  alarms?: IndustrialAlarm[];         // 对齐 IndustrialAlarm[]

  // ── 低空设备（机巢/起降场用 · 对齐 aerial adapter）
  dockState?: {
    doorOpen: boolean;
    charging: boolean;
    liftPosition: number;             // 0-100
    temperature: number;              // 舱内温度
    uavBattery: number;               // 无人机电量
  };
  vertiportState?: {
    chargingPadOnline: boolean;
    fireSuppressionArmed: boolean;
    lightingActive: boolean;
  };

  // ── 元数据
  lastUpdate: number;                 // timestamp
  source: 'mock-control';             // 标识来源
}
```

### 4.2 预设设备清单（6 台 + 扩展）

对齐 `mock-ws-server.js` 的 `:8082` 工业 4 品牌 + `:8080/:8081` 商用 2 台：

| robotId | brand | deviceClass | 初始状态 | 可控维度 |
|---------|-------|-------------|---------|---------|
| `UNITREE-G1-01` | unitree | ground_robot | moving | 移动/速度/姿态 |
| `KEENON-T9-01` | keenon | ground_robot | idle | 移动/送餐任务 |
| `FANUC-001` | fanuc | industrial_arm | working | 6 轴关节/温度/告警 |
| `KUKA-001` | kuka | industrial_arm | working | 6 轴关节/温度/告警 |
| `ESTUN-001` | estun | industrial_arm | idle | 6 轴关节/温度/告警 |
| `YASKAWA-001` | yaskawa | industrial_arm | error | 6 轴关节/温度/告警 |

> **低空设备（`DJI-DOCK-01` / `VERTIPORT-01`）已在 `adapter-kit/adapters/aerial/` 实现 adapter，操作页面 v1.1 扩展支持。

### 4.3 关节状态模型（工业机械臂）

```typescript
interface JointState {
  axis: number;          // 1-6
  name: string;          // "J1" | "J2" ...
  angle: number;         // 当前角度（度）
  temperature: number;   // 温度（℃）· 可调整 → 触发健康分变化
  load: number;          // 负载率 0-100
  current: number;       // 电流（A）
  status: 'normal' | 'warning' | 'fault';
}
```

---

## 5. 控制指令协议

### 5.1 指令格式

所有指令通过 REST API 下发，Control Service 转换为 MQTT 消息。

```typescript
interface ControlCommand {
  robotId: string;                    // 目标设备 ID
  type: CommandType;                   // 指令类型（见下表）
  params?: Record<string, unknown>;    // 指令参数
  source?: 'control-panel' | 'scenario' | 'api';  // 来源标记
  ts?: number;                        // 客户端时间戳（服务端覆盖）
}

type CommandType =
  // ── 通用生命周期
  | 'start' | 'stop' | 'pause' | 'resume' | 'reset'
  // ── 商用机器人运动
  | 'move_to'                         // params: { x, y, speed }
  | 'set_velocity'                    // params: { linear, angular }
  | 'return_to_charge'                // params: {}
  | 'set_mode'                        // params: { mode: 'auto' | 'manual' }
  // ── 工业机械臂
  | 'set_joint_angle'                 // params: { axis: number, angle: number }
  | 'set_joint_temperature'            // params: { axis: number, temperature: number }
  | 'trigger_alarm'                   // params: { code: string, severity?: 'info' | 'warn' | 'error' }
  | 'clear_alarm'                     // params: { code?: string }（不填=清空全部）
  | 'set_load'                        // params: { axis: number, load: number }
  // ── 低空设备（v1.1）
  | 'open_dock_door'                  // params: {}
  | 'close_dock_door'                 // params: {}
  | 'dispatch_uav'                    // params: { mission: string }
  | 'recall_uav'                      // params: {}
  // ── 全局
  | 'set_battery'                     // params: { level: number }（所有类型通用）
  | 'set_health_score'                // params: { score: number }（调试用）
  | 'inject_fault'                    // params: { type: string }（模拟硬件故障）
  | 'simulate_offline'                // params: { duration_ms: number }
  | 'custom_telemetry';                // params: { patch: Partial<UnifiedRobotState> }
```

### 5.2 MQTT Topic 规范

对齐 `python-edge/` 和 `roboticsops-edge/` 的命名约定：

| 方向 | Topic 模板 | Payload | 发布者 | 订阅者 |
|------|-----------|---------|--------|--------|
| **下行（控制）** | `industrial/robot/{robotId}/command` | `ControlCommand` | Control Service | Mock WS Server / python-edge |
| **上行（遥测）** | `industrial/robot/{robotId}/telemetry` | `UnifiedRobotState` | Mock WS Server / python-edge | adapter-kit mqtt-client |
| **下行（OTA）** | `ota/{robotId}/command` | `{ action, version }` | OtaPage / Control Service | python-edge |
| **上行（OTA 状态）** | `ota/{robotId}/status` | `OtaState` | python-edge | otaStore |
| **告警广播** | `alerts/broadcast` | `UnifiedAlert` | Control Service | alertStore |

> **关键设计**：操作页面只发布 `command` 和 `alerts/broadcast`，不发布 `telemetry`。telemetry 始终由 `mock-ws-server.js` 或 `python-edge/` 发布——这保证了**单一数据源**原则。

### 5.3 指令处理流程

```
POST /api/command
  │
  ▼
[1] command-handler.js → validateCommand()
    · robotId 是否存在
    · type 是否合法
    · params 类型校验（zod schema）
  │
  ▼
[2] command-handler.js → routeCommand()
    · 按 deviceClass 路由到对应处理器
    · commercial → handleCommercialCommand()
    · industrial  → handleIndustrialCommand()
    · aerial      → handleAerialCommand()
  │
  ▼
[3] state-engine.js → applyCommand()
    · 修改内存状态树
    · 触发衍生计算（健康分重算、告警状态联动）
    · 生成事件 → eventEmitter
  │
  ▼
[4] mqtt-bridge.js → publishCommand()
    · topic: industrial/robot/{robotId}/command
    · payload: ControlCommand（JSON）
  │
  ▼
[5] mock-ws-server.js 收到 command → 修改内部 mock 状态
    · 下次 telemetry tick → 发布更新后的 telemetry
    · Dashboard 无感接收
  │
  ▼
[6] 响应返回 UI：{ success: true, state: MockDeviceState }
```

---

## 6. 前端操作页面设计

### 6.1 页面布局

```
┌─────────────────────────────────────────────────────────────────────┐
│  🎮 Mock 控制面板 · Robot-Ops-Solo                    [连接状态] 🟢  │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌─ 场景剧本 ────────────────────────────────────────────────────┐ │
│  │  [🚀 一键演示] [⚠️ 级联告警] [🔧 故障恢复] [🔄 全部复位]      │ │
│  │  ● 进度: ████████░░ 80% · Phase 4/5 · "AI 诊断完成"            │ │
│  └───────────────────────────────────────────────────────────────┘ │
│                                                                     │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌─ 设备网格 ────────────────────────────────────────────────────┐ │
│  │                                                                │ │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐          │ │
│  │  │ 🤖 G1-01    │  │ 🍜 T9-01    │  │ 🏭 FANUC-001│          │ │
│  │  │ Unitree G1  │  │ Keenon T9   │  │ FANUC M-20iD│          │ │
│  │  │ ● moving    │  │ ● idle      │  │ ● working   │          │ │
│  │  │ ⚡ 78%      │  │ ⚡ 92%      │  │ ⚡ 65%      │          │ │
│  │  │ ❤️ 88       │  │ ❤️ 95       │  │ ❤️ 72       │          │ │
│  │  │ [选中]      │  │             │  │             │          │ │
│  │  └─────────────┘  └─────────────┘  └─────────────┘          │ │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐          │ │
│  │  │ 🏭 KUKA-001 │  │ 🏭 ESTUN-001│  │ 🏭 YASKAWA-01│          │ │
│  │  │ ...         │  │ ...         │  │ ...         │          │ │
│  │  └─────────────┘  └─────────────┘  └─────────────┘          │ │
│  └───────────────────────────────────────────────────────────────┘ │
│                                                                     │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌─ 控制面板（选中 FANUC-001）───────────────────────────────────┐ │
│  │                                                                │ │
│  │  生命周期:  [▶ 启动] [⏸ 暂停] [⏹ 停止] [⏵ 恢复] [↺ 复位]    │ │
│  │                                                                │ │
│  │  电量:  ════════●━━━━  65%  [───●───]                        │ │
│  │                                                                │ │
│  │  关节温度:                                                     │ │
│  │    J1: ═════●━━━ 45℃  [───●───]  J4: ═══●━━━ 38℃           │ │
│  │    J2: ═══●━━━ 52℃   [───●───]  J5: ═══●━━━ 41℃           │ │
│  │    J3: ═━━━━●━━ 68℃⚠️ [───●───]  J6: ═══●━━━ 39℃           │ │
│  │                                                                │ │
│  │  告警:                                                         │ │
│  │    [⚠️ 触发 SRVO-001] [⚠️ 触发 OH-002] [🧹 清空全部]          │ │
│  │    Active: [SRVO-001 伺服过流] [OH-002 变频器过热]             │ │
│  │                                                                │ │
│  │  高级:                                                         │ │
│  │    [📡 模拟离线 30s] [💉 注入故障: __] [🎯 自定义 telemetry]  │ │
│  └───────────────────────────────────────────────────────────────┘ │
│                                                                     │
│  ┌─ 实时日志 ────────────────────────────────────────────────────┐ │
│  │  [12:34:56] → FANUC-001: trigger_alarm(SRVO-001)  ✅          │ │
│  │  [12:34:56] ← FANUC-001: telemetry updated (alarms: 1)        │ │
│  │  [12:34:57] → FANUC-001: set_joint_temperature(J3, 82)  ✅    │ │
│  │  [12:34:57] ← FANUC-001: healthScore: 72 → 58                 │ │
│  └───────────────────────────────────────────────────────────────┘ │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### 6.2 组件设计

#### 6.2.1 DeviceGrid（设备网格）

```javascript
// web/js/device-grid.js
class DeviceGrid {
  constructor(container, apiClient) {
    this.container = container;
    this.api = apiClient;
    this.devices = new Map();
    this.selectedId = null;
  }

  async init() {
    // 拉取设备列表
    const devices = await this.api.getDevices();
    devices.forEach(d => this.devices.set(d.robotId, d));
    this.render();

    // SSE 订阅实时状态流
    this.api.subscribeTelemetry((state) => {
      this.devices.set(state.robotId, state);
      this.updateCard(state.robotId);
    });
  }

  render() {
    this.container.innerHTML = '';
    this.devices.forEach(device => {
      const card = this.createCard(device);
      this.container.appendChild(card);
    });
  }

  createCard(device) {
    const card = document.createElement('div');
    card.className = `device-card device-card--${device.status}`;
    card.innerHTML = `
      <div class="device-card__header">
        <span class="device-card__icon">${getBrandIcon(device.brand)}</span>
        <span class="device-card__id">${device.robotId}</span>
        <span class="device-card__status status-dot status-dot--${device.online ? 'online' : 'offline'}"></span>
      </div>
      <div class="device-card__name">${device.name}</div>
      <div class="device-card__metrics">
        <span>⚡ ${device.battery}%</span>
        <span>❤️ ${device.healthScore}</span>
        <span class="status-text">${device.status}</span>
      </div>
    `;
    card.onclick = () => this.selectDevice(device.robotId);
    return card;
  }

  selectDevice(robotId) {
    this.selectedId = robotId;
    // 通知 ControlPanel 切换设备
    window.dispatchEvent(new CustomEvent('device:select', { detail: { robotId } }));
    // 高亮选中卡片
    this.container.querySelectorAll('.device-card').forEach(el => el.classList.remove('selected'));
    this.container.querySelector(`[data-robot-id="${robotId}"]`)?.classList.add('selected');
  }

  updateCard(robotId) {
    const device = this.devices.get(robotId);
    const card = this.container.querySelector(`[data-robot-id="${robotId}"]`);
    if (!card || !device) return;
    // 只更新变化的 DOM 节点（避免整卡重绘闪烁）
    card.querySelector('.device-card__status').className = `status-text ${device.status}`;
    card.querySelector('.metric-battery').textContent = `⚡ ${device.battery}%`;
    card.querySelector('.metric-health').textContent = `❤️ ${device.healthScore}`;
    card.className = `device-card device-card--${device.status}`;
  }
}
```

#### 6.2.2 ControlPanel（控制面板）

```javascript
// web/js/control-panel.js
class ControlPanel {
  constructor(container, apiClient) {
    this.container = container;
    this.api = apiClient;
    this.currentDevice = null;
  }

  init() {
    window.addEventListener('device:select', (e) => {
      this.currentDevice = e.detail.robotId;
      this.render();
    });
    this.bindLifecycleButtons();
    this.bindParameterSliders();
    this.bindAlarmButtons();
  }

  bindLifecycleButtons() {
    const actions = ['start', 'stop', 'pause', 'resume', 'reset'];
    actions.forEach(action => {
      this.container.querySelector(`[data-action="${action}"]`)
        ?.addEventListener('click', () => this.sendCommand(action));
    });
  }

  bindParameterSliders() {
    // 电量滑块
    this.container.querySelector('[data-param="battery"]')
      ?.addEventListener('input', (e) => {
        this.sendCommand('set_battery', { level: Number(e.target.value) });
      });

    // 关节温度滑块（6 轴）
    [1,2,3,4,5,6].forEach(axis => {
      this.container.querySelector(`[data-param="temp-j${axis}"]`)
        ?.addEventListener('input', (e) => {
          this.sendCommand('set_joint_temperature', {
            axis, temperature: Number(e.target.value)
          });
        });
    });
  }

  bindAlarmButtons() {
    this.container.querySelector('[data-action="trigger_alarm"]')
      ?.addEventListener('click', () => {
        const code = this.container.querySelector('[data-input="alarm-code"]').value;
        this.sendCommand('trigger_alarm', { code: code || 'SRVO-001' });
      });

    this.container.querySelector('[data-action="clear_alarms"]')
      ?.addEventListener('click', () => {
        this.sendCommand('clear_alarm');
      });
  }

  async sendCommand(type, params = {}) {
    if (!this.currentDevice) {
      this.log('⚠️ 请先选择设备', 'warn');
      return;
    }
    try {
      const result = await this.api.sendCommand(this.currentDevice, type, params);
      this.log(`→ ${this.currentDevice}: ${type}(${JSON.stringify(params)}) ✅`, 'success');
      // 乐观更新（telemetry 到达后会校正）
      this.optimisticUpdate(type, params, result.state);
    } catch (err) {
      this.log(`→ ${type} ❌ ${err.message}`, 'error');
    }
  }

  optimisticUpdate(type, params, serverState) {
    // 立即更新 UI（不等 telemetry 到达）
    if (type === 'set_battery') {
      this.container.querySelector('[data-param="battery"]').value = params.level;
    }
    if (type === 'set_joint_temperature') {
      // 触发健康分实时变化
      this.updateHealthPreview(params.axis, params.temperature);
    }
  }

  updateHealthPreview(axis, temp) {
    // 温度 > 70℃ → 健康分下降（对齐 health/index.ts 算法逻辑）
    const healthEl = this.container.querySelector('[data-metric="health"]');
    if (temp > 70) {
      healthEl.classList.add('warning');
      healthEl.textContent = `❤️ ~${Math.max(0, 100 - (temp - 40) * 2)}`;
    }
  }
}
```

#### 6.2.3 ScenarioRunner（场景剧本执行器）

```javascript
// web/js/scenario-runner.js
class ScenarioRunner {
  constructor(apiClient, logger) {
    this.api = apiClient;
    this.logger = logger;
    this.scenarios = {
      // 一键演示（对齐 mock-ws-server.js 现有剧本）
      'full-demo': [
        { delay: 0,    command: { robotId: 'FANUC-001', type: 'start' } },
        { delay: 2000, command: { robotId: 'FANUC-001', type: 'set_joint_temperature', params: { axis: 3, temperature: 68 } } },
        { delay: 3000, command: { robotId: 'FANUC-001', type: 'set_joint_temperature', params: { axis: 3, temperature: 78 } } },
        { delay: 4000, command: { robotId: 'FANUC-001', type: 'trigger_alarm', params: { code: 'OH-002', severity: 'warn' } } },
        { delay: 5000, command: { robotId: 'FANUC-001', type: 'set_joint_temperature', params: { axis: 3, temperature: 88 } } },
        { delay: 6000, command: { robotId: 'FANUC-001', type: 'trigger_alarm', params: { code: 'SRVO-001', severity: 'error' } } },
        // ... 后续：Agent 诊断 → 匹配 SOP → webhook 推送
      ],
      // 级联告警（多设备同时异常）
      'cascade-alarm': [
        { delay: 0,    command: { robotId: 'FANUC-001', type: 'trigger_alarm', params: { code: 'SRVO-001' } } },
        { delay: 500,  command: { robotId: 'KUKA-001',  type: 'trigger_alarm', params: { code: 'KSS-004' } } },
        { delay: 1000, command: { robotId: 'ESTUN-001', type: 'trigger_alarm', params: { code: 'EST-007' } } },
        { delay: 1500, command: { robotId: 'YASKAWA-001', type: 'trigger_alarm', params: { code: 'ALM-201' } } },
      ],
      // 故障恢复（验证告警清除 + 健康分回升）
      'fault-recovery': [
        { delay: 0,    command: { robotId: 'FANUC-001', type: 'trigger_alarm', params: { code: 'SRVO-001' } } },
        { delay: 2000, command: { robotId: 'FANUC-001', type: 'set_joint_temperature', params: { axis: 3, temperature: 45 } } },
        { delay: 3000, command: { robotId: 'FANUC-001', type: 'clear_alarm' } },
        { delay: 4000, command: { robotId: 'FANUC-001', type: 'resume' } },
      ],
    };
  }

  async run(name) {
    const steps = this.scenarios[name];
    if (!steps) throw new Error(`Scenario "${name}" not found`);

    this.logger.log(`🎬 开始场景: ${name} (${steps.length} 步)`);
    this.updateProgress(0, steps.length);

    for (let i = 0; i < steps.length; i++) {
      const step = steps[i];
      await this.sleep(step.delay);
      await this.api.sendCommand(step.command.robotId, step.command.type, step.command.params);
      this.logger.log(`  [${i+1}/${steps.length}] ${step.command.type}`, 'success');
      this.updateProgress(i + 1, steps.length);
    }

    this.logger.log(`✅ 场景完成: ${name}`);
  }

  async stop() { /* 中断执行 */ }
  sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
  updateProgress(current, total) { /* 更新进度条 */ }
}
```

### 6.3 API 客户端

```javascript
// web/js/api-client.js
class ControlApiClient {
  constructor(baseUrl = 'http://localhost:3000') {
    this.baseUrl = baseUrl;
    this.eventSource = null;
  }

  async getDevices() {
    const res = await fetch(`${this.baseUrl}/api/devices`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  }

  async sendCommand(robotId, type, params = {}) {
    const res = await fetch(`${this.baseUrl}/api/command`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ robotId, type, params, source: 'control-panel' }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || `HTTP ${res.status}`);
    }
    return res.json();
  }

  async runScenario(name) {
    const res = await fetch(`${this.baseUrl}/api/scenario/${name}`, { method: 'POST' });
    return res.json();
  }

  // SSE 实时状态流（替代 WebSocket，更简单）
  subscribeTelemetry(onState) {
    this.eventSource = new EventSource(`${this.baseUrl}/api/telemetry/stream`);
    this.eventSource.onmessage = (e) => {
      const state = JSON.parse(e.data);
      onState(state);
    };
    this.eventSource.onerror = () => {
      console.warn('[ControlPanel] SSE disconnected, retrying...');
    };
  }

  disconnect() {
    this.eventSource?.close();
  }
}
```

---

## 7. 后端服务设计

### 7.1 入口与中间件

```javascript
// mock-control/server/index.js
import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { StateEngine } from './state-engine.js';
import { CommandHandler } from './command-handler.js';
import { MqttBridge } from './mqtt-bridge.js';
import { ScenarioEngine } from './scenario-engine.js';
import { devicesRouter } from './routes/devices.js';
import { commandRouter } from './routes/command.js';
import { scenarioRouter } from './scenario.js';
import { telemetryRouter } from './routes/telemetry.js';

const app = express();
app.use(cors());
app.use(express.json({ limit: '1mb' }));

// 依赖注入
const stateEngine = new StateEngine();
await stateEngine.init();                          // 加载 config/devices.yaml
const mqttBridge = new MqttBridge(stateEngine);    // MQTT 客户端（发布指令）
const commandHandler = new CommandHandler(stateEngine, mqttBridge);
const scenarioEngine = new ScenarioEngine(stateEngine, commandHandler);

// 路由
app.use('/api/devices', devicesRouter(stateEngine));
app.use('/api/command', commandRouter(commandHandler));
app.use('/api/scenario', scenarioRouter(scenarioEngine));
app.use('/api/telemetry', telemetryRouter(stateEngine));

// 健康检查
app.get('/health', (req, res) => res.json({ ok: true, devices: stateEngine.size() }));

const server = createServer(app);

// 与 mock-ws-server.js 集成：订阅其 telemetry 更新本地状态
mqttBridge.subscribeTelemetry();

server.listen(3000, () => {
  console.log('🎮 Mock Control Service running on http://localhost:3000');
  console.log(`   MQTT Broker: ${process.env.MQTT_BROKER || 'localhost:1883'}`);
});
```

### 7.2 状态引擎

```javascript
// mock-control/server/state-engine.js
import { readFileSync } from 'fs';
import YAML from 'yaml';
import { EventEmitter } from 'events';

export class StateEngine extends EventEmitter {
  constructor() {
    super();
    this.devices = new Map();    // robotId → MockDeviceState
    this.config = null;
  }

  async init() {
    const raw = readFileSync('./config/devices.yaml', 'utf-8');
    this.config = YAML.parse(raw);
    this.config.devices.forEach(def => {
      this.devices.set(def.robotId, this.createInitialState(def));
    });
  }

  createInitialState(def) {
    const state = {
      robotId: def.robotId,
      name: def.name,
      brand: def.brand,
      deviceClass: def.deviceClass,
      online: true,
      status: def.initialStatus || 'idle',
      battery: def.initialBattery ?? 80,
      healthScore: def.initialHealth ?? 90,
      mode: 'auto',
      lastUpdate: Date.now(),
      source: 'mock-control',
    };

    // 工业机械臂：初始化 6 轴关节
    if (def.deviceClass === 'industrial_arm') {
      state.joints = [1,2,3,4,5,6].map(axis => ({
        axis, name: `J${axis}`,
        angle: 0, temperature: 35 + Math.random() * 15,
        load: Math.random() * 40, current: 2 + Math.random() * 3,
        status: 'normal',
      }));
      state.alarms = [];
    }

    // 低空设备：初始化机巢/起降场状态
    if (def.deviceClass === 'aerial_dock') {
      state.dockState = {
        doorOpen: false, charging: true,
        liftPosition: 0, temperature: 25, uavBattery: 100,
      };
    }
    if (def.deviceClass === 'vertiport') {
      state.vertiportState = {
        chargingPadOnline: true, fireSuppressionArmed: true, lightingActive: true,
      };
    }

    return state;
  }

  get(robotId) { return this.devices.get(robotId); }
  getAll() { return Array.from(this.devices.values()); }
  size() { return this.devices.size; }

  // 应用指令 → 修改状态 → 触发事件
  apply(command) {
    const device = this.devices.get(command.robotId);
    if (!device) throw new Error(`Device "${command.robotId}" not found`);

    switch (command.type) {
      case 'start':      device.status = 'working'; break;
      case 'stop':       device.status = 'idle'; break;
      case 'pause':      device.status = 'idle'; break;
      case 'resume':     device.status = 'working'; break;
      case 'reset':      this.resetDevice(device); break;

      case 'set_battery':
        device.battery = Math.max(0, Math.min(100, command.params.level));
        break;

      case 'set_joint_temperature': {
        const { axis, temperature } = command.params;
        const joint = device.joints?.find(j => j.axis === axis);
        if (joint) {
          joint.temperature = temperature;
          joint.status = temperature > 75 ? 'fault' : temperature > 60 ? 'warning' : 'normal';
        }
        this.recalcHealthScore(device);
        break;
      }

      case 'trigger_alarm': {
        const { code, severity = 'warn' } = command.params;
        device.alarms = device.alarms || [];
        device.alarms.push({
          code, severity,
          zh_desc: this.getAlarmDescription(code),
          ts: Date.now(),
        });
        device.status = severity === 'error' ? 'error' : device.status;
        break;
      }

      case 'clear_alarm':
        device.alarms = [];
        if (device.status === 'error') device.status = 'working';
        break;

      case 'simulate_offline':
        device.online = false;
        setTimeout(() => { device.online = true; this.emitChange(device); }, command.params.duration_ms || 30000);
        break;

      default:
        throw new Error(`Unknown command type: ${command.type}`);
    }

    device.lastUpdate = Date.now();
    this.emitChange(device);
    return device;
  }

  recalcHealthScore(device) {
    if (!device.joints) return;
    const avgTemp = device.joints.reduce((s, j) => s + j.temperature, 0) / device.joints.length;
    // 对齐 health/index.ts 逻辑：温度越高健康分越低
    device.healthScore = Math.max(0, Math.round(100 - Math.max(0, avgTemp - 40) * 2));
  }

  getAlarmDescription(code) {
    const map = {
      'SRVO-001': '伺服放大器过流',
      'OH-002': '变频器散热器过热',
      'KSS-004': 'KSS 轴工作范围超限',
      'EST-007': 'Estun 通信超时',
      'ALM-201': 'Yaskawa 绝对位置丢失',
    };
    return map[code] || `未知告警: ${code}`;
  }

  resetDevice(device) {
    device.status = 'idle';
    device.battery = 100;
    device.healthScore = 90;
    device.alarms = [];
    if (device.joints) {
      device.joints.forEach(j => { j.temperature = 35; j.status = 'normal'; });
    }
  }

  emitChange(device) {
    this.emit('change', device);
  }
}
```

### 7.3 指令处理器

```javascript
// mock-control/server/command-handler.js
import { z } from 'zod';

// Zod 校验 Schema（对齐指令格式文档）
const CommandSchema = z.object({
  robotId: z.string().min(1),
  type: z.enum([
    'start','stop','pause','resume','reset',
    'move_to','set_velocity','return_to_charge','set_mode',
    'set_joint_angle','set_joint_temperature','trigger_alarm','clear_alarm','set_load',
    'open_dock_door','close_dock_door','dispatch_uav','recall_uav',
    'set_battery','set_health_score','inject_fault','simulate_offline','custom_telemetry',
  ]),
  params: z.record(z.unknown()).optional().default({}),
  source: z.enum(['control-panel','scenario','api']).optional(),
});

export class CommandHandler {
  constructor(stateEngine, mqttBridge) {
    this.state = stateEngine;
    this.mqtt = mqttBridge;
  }

  async execute(rawCommand) {
    // [1] 校验
    const command = CommandSchema.parse(rawCommand);
    command.ts = Date.now();

    // [2] 执行状态变更
    const newState = this.state.apply(command);

    // [3] 发布 MQTT 指令（通知 mock-ws-server 同步）
    await this.mqtt.publishCommand(command);

    // [4] 如果是告警类，额外发布到 alerts/broadcast
    if (command.type === 'trigger_alarm') {
      await this.mqtt.publishAlert({
        robotId: command.robotId,
        code: command.params.code,
        severity: command.params.severity || 'warn',
        zh_desc: this.state.getAlarmDescription(command.params.code),
        ts: command.ts,
      });
    }

    return { success: true, state: newState };
  }
}
```

### 7.4 MQTT 桥接

```javascript
// mock-control/server/mqtt-bridge.js
import mqtt from 'mqtt';

export class MqttBridge {
  constructor(stateEngine) {
    this.state = stateEngine;
    this.client = null;
  }

  connect() {
    const broker = process.env.MQTT_BROKER || 'mqtt://localhost:1883';
    this.client = mqtt.connect(broker, {
      clientId: `mock-control-${Math.random().toString(16).slice(2)}`,
      clean: true,
      reconnectPeriod: 2000,
    });

    this.client.on('connect', () => console.log('[MQTT] Connected to', broker));
    this.client.on('error', (e) => console.error('[MQTT] Error:', e.message));
  }

  // 发布控制指令（下行）
  async publishCommand(command) {
    if (!this.client?.connected) return;  // 无 broker 时降级为直连模式
    const topic = `industrial/robot/${command.robotId}/command`;
    this.client.publish(topic, JSON.stringify(command), { qos: 1 });
  }

  // 发布告警广播
  async publishAlert(alert) {
    if (!this.client?.connected) return;
    this.client.publish('alerts/broadcast', JSON.stringify(alert), { qos: 1 });
  }

  // 订阅 telemetry（上行）— 同步 mock-ws-server 的状态到本地
  subscribeTelemetry() {
    if (!this.client?.connected) return;
    this.client.subscribe('industrial/robot/+/telemetry', { qos: 0 });
    this.client.on('message', (topic, payload) => {
      try {
        const state = JSON.parse(payload.toString());
        const device = this.state.get(state.robotId);
        if (device) {
          // 仅同步 mock-ws-server 推进的状态（电池衰减等）
          device.battery = state.battery ?? device.battery;
          device.status = state.status || device.status;
          device.lastUpdate = Date.now();
          this.state.emitChange(device);
        }
      } catch (e) { /* ignore malformed */ }
    });
  }

  disconnect() { this.client?.end(); }
}
```

### 7.5 路由模块

```javascript
// mock-control/server/routes/command.js
import { Router } from 'express';

export function commandRouter(handler) {
  const router = Router();

  router.post('/', async (req, res) => {
    try {
      const result = await handler.execute(req.body);
      res.json(result);
    } catch (err) {
      // Zod 校验错误 → 400
      if (err.name === 'ZodError') {
        return res.status(400).json({ error: 'VALIDATION_ERROR', details: err.errors });
      }
      res.status(500).json({ error: err.message });
    }
  });

  return router;
}
```

```javascript
// mock-control/server/routes/telemetry.js
import { Router } from 'express';

export function telemetryRouter(stateEngine) {
  const router = Router();

  // SSE 实时状态流
  router.get('/stream', (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    const send = (device) => {
      res.write(`data: ${JSON.stringify(device)}\n\n`);
    };

    // 初始全量推送
    stateEngine.getAll().forEach(send);

    // 后续增量推送
    stateEngine.on('change', send);

    req.on('close', () => {
      stateEngine.off('change', send);
    });
  });

  return router;
}
```

---

## 8. mock-ws-server.js 改造

### 8.1 改造内容（最小化）

为了让 `mock-ws-server.js` 响应操作页面的控制指令，**仅需增加 command 订阅 + 状态覆盖逻辑**，不修改现有 telemetry 广播。

```javascript
// mock-ws-server.js — 在现有代码基础上追加

// ══════════════════════════════════════════════════════════════════
// 🆕 Mock Control Integration（操作页面双向控制支持）
// ══════════════════════════════════════════════════════════════════

let mqttClient = null;
const externalStateOverrides = new Map();  // robotId → partial state patch

function initMockControl() {
  const broker = process.env.MQTT_BROKER || 'mqtt://localhost:1883';
  try {
    mqttClient = mqtt.connect(broker, { clientId: 'mock-ws-control', clean: true });

    // 订阅所有设备的控制指令
    mqttClient.subscribe('industrial/robot/+/command', { qos: 1 });

    mqttClient.on('message', (topic, payload) => {
      try {
        const command = JSON.parse(payload.toString());
        applyExternalCommand(command);
      } catch (e) {
        console.error('[MockControl] Failed to parse command:', e.message);
      }
    });

    console.log('[MockControl] ✓ Subscribed to control commands');
  } catch (e) {
    console.warn('[MockControl] MQTT unavailable, running in standalone mode');
  }
}

function applyExternalCommand(command) {
  const { robotId, type, params } = command;
  console.log(`[MockControl] ← ${robotId}: ${type}`, params || '');

  // 构造状态补丁（下次 telemetry tick 合并到广播帧）
  const patch = {};

  switch (type) {
    case 'stop':       patch.status = 'idle'; break;
    case 'start':      patch.status = 'working'; break;
    case 'pause':      patch.status = 'idle'; break;
    case 'resume':     patch.status = 'working'; break;
    case 'reset':      patch.status = 'idle'; patch.battery = 100; break;
    case 'set_battery':  patch.battery = params.level; break;
    case 'trigger_alarm':
      patch._alarms = patch._alarms || [];
      patch._alarms.push({ code: params.code, severity: params.severity || 'warn' });
      break;
    case 'clear_alarm':  patch._clearAlarms = true; break;
  }

  externalStateOverrides.set(robotId, {
    ...externalStateOverrides.get(robotId),
    ...patch,
  });
}

// 在现有 telemetry tick 函数中调用（伪代码示意）
function buildTelemetryFrame(robotId, baseState) {
  const override = externalStateOverrides.get(robotId) || {};

  // 合并外部指令覆盖
  const frame = { ...baseState, ...override };

  // 清理临时字段
  delete frame._alarms;
  delete frame._clearAlarms;

  // 告警合并（如果有外部注入的告警）
  if (override._alarms?.length) {
    frame.alarms = [...(frame.alarms || []), ...override._alarms];
  }
  if (override._clearAlarms) {
    frame.alarms = [];
  }

  // 清除已消费的覆盖（电池/状态类持续保留，告警类一次性）
  if (!override._alarms?.length && !override._clearAlarms) {
    externalStateOverrides.delete(robotId);
  }

  return frame;
}

// 在 server 启动时调用
initMockControl();
```

### 8.2 改造原则

| 原则 | 说明 |
|------|------|
| **最小化侵入** | 仅追加 ~80 行代码，不改现有函数签名 |
| **状态覆盖模式** | 操作页面不直接修改 mock 内部状态，而是通过"补丁"在下个 tick 合并 |
| **降级兼容** | MQTT 不可用时 `initMockControl` 静默失败，现有功能不受影响 |
| **告警一次性** | `trigger_alarm` 合并后清除补丁，`set_battery`/`status` 持续保留 |

---

## 9. 配置文件

### 9.1 devices.yaml

```yaml
# mock-control/config/devices.yaml
devices:
  # ── 商用机器人（对齐 :8080 / :8081）
  - robotId: UNITREE-G1-01
    name: 宇树 G1 人形 #1
    brand: unitree
    deviceClass: ground_robot
    initialStatus: moving
    initialBattery: 78
    initialHealth: 88

  - robotId: KEENON-T9-01
    name: 擎朗 T9 递送 #1
    brand: keenon
    deviceClass: ground_robot
    initialStatus: idle
    initialBattery: 92
    initialHealth: 95

  # ── 工业机械臂（对齐 :8082）
  - robotId: FANUC-001
    name: FANUC M-20iD #1
    brand: fanuc
    deviceClass: industrial_arm
    initialStatus: working
    initialBattery: 65
    initialHealth: 72

  - robotId: KUKA-001
    name: KUKA KR6 #1
    brand: kuka
    deviceClass: industrial_arm
    initialStatus: working
    initialBattery: 70
    initialHealth: 80

  - robotId: ESTUN-001
    name: 埃斯顿 PRO-06 #1
    brand: estun
    deviceClass: industrial_arm
    initialStatus: idle
    initialBattery: 85
    initialHealth: 90

  - robotId: YASKAWA-001
    name: 安川 GP8 #1
    brand: yaskawa
    deviceClass: industrial_arm
    initialStatus: error
    initialBattery: 45
    initialHealth: 55

# 路演场景剧本
scenarios:
  full-demo:
    description: 完整演示剧本（负载爬升→告警→AI诊断→SOP→webhook）
    steps:
      - { delay: 0,    robotId: FANUC-001, type: start }
      - { delay: 2000, robotId: FANUC-001, type: set_joint_temperature, params: { axis: 3, temperature: 68 } }
      - { delay: 3000, robotId: FANUC-001, type: set_joint_temperature, params: { axis: 3, temperature: 78 } }
      - { delay: 4000, robotId: FANUC-001, type: trigger_alarm, params: { code: OH-002, severity: warn } }
      - { delay: 5000, robotId: FANUC-001, type: set_joint_temperature, params: { axis: 3, temperature: 88 } }
      - { delay: 6000, robotId: FANUC-001, type: trigger_alarm, params: { code: SRVO-001, severity: error } }
      # ... Agent 诊断 + SOP 匹配 + webhook（由前端 ScenarioRunner 编排）
```

### 9.2 topics.yaml

```yaml
# mock-control/config/topics.yaml
# MQTT Topic 规范（对齐 python-edge/ 和 roboticsops-edge/）

topics:
  # 下行（控制指令）
  command: "industrial/robot/{robotId}/command"
  command_wildcard: "industrial/robot/+/command"

  # 上行（遥测数据）
  telemetry: "industrial/robot/{robotId}/telemetry"
  telemetry_wildcard: "industrial/robot/+/telemetry"

  # OTA（对齐 robot-ops-solo-轻量OTA开发文档.md）
  ota_command: "ota/{robotId}/command"
  ota_status: "ota/{robotId}/status"

  # 告警广播（对齐 alertStore.addAlert）
  alert: "alerts/broadcast"

  # 语音播报（对齐 speakStore）
  speak: "speak/broadcast"

# 载荷规范
payloads:
  command:
    required: [robotId, type]
    optional: [params, source, ts]
  telemetry:
    # 对齐 UnifiedRobotState（adapter-kit/src/types/unified.ts）
    required: [robotId, brand, deviceClass, online, status, battery, healthScore]
    optional: [position, joints, alarms, dockState, vertiportState]
  alert:
    # 对齐 IndustrialAlarm（adapter-kit/src/types/industrial.ts）
    required: [robotId, code, severity]
    optional: [zh_desc, ts]
```

---

## 10. 路演使用指南

### 10.1 启动顺序

```bash
# 1. 启动 MQTT Broker（mosquitto · 1883 + WebSocket 9001）
docker run -d --name mosquitto -p 1883:1883 -p 9001:9001 \
  -v $(pwd)/mosquitto.conf:/mosquitto/config/mosquitto.conf \
  eclipse-mosquitto

# 2. 启动 Mock WS Server（现有 · :8080/:8081/:8082）
node mock-ws-server.js

# 3. 启动 Mock Control Service（🆕 :3000）
cd mock-control
pnpm install
pnpm dev

# 4. 打开 Dashboard
#    浏览器 A: http://localhost:5173  (web-console · Dashboard)
#    浏览器 B: http://localhost:3000  (Mock 控制面板)

# 5. 验证双向通信
#    在控制面板点击「⚠ 触发告警」→ Dashboard AlertsPage 立即出现新告警
```

### 10.2 mosquitto 配置

```ini
# mosquitto.conf
listener 1883
listener 9001
protocol websockets

allow_anonymous true
persistence false
connection_messages true
log_type error
log_type warning
log_type notice
```

### 10.3 30 秒路演剧本

| 时间 | 操作 | Dashboard 响应 | 评审感知 |
|------|------|---------------|---------| 
| 0s | 开场：Dashboard 展示 6 台设备实时数据 | 电量/温度/健康分滚动 | "系统活着" |
| 3s | 点击「🚀 一键演示」 | FANUC-001 状态 idle→working | "能控制设备" |
| 6s | 场景自动：J3 温度 68→78→88℃ | TwinPage J3 关节颜色变化 | "数据实时联动" |
| 9s | 场景自动：触发 OH-002 告警 | AlertsPage 新增黄色告警 | "告警接入正常" |
| 12s | 场景自动：触发 SRVO-001 错误 | AlertsPage 红色告警 + TwinPage 红光环 | "故障可视化" |
| 15s | 点击「💬 询问 Agent」| ChatPanel: "FANUC-001 J3 温度过高，建议检查散热风扇" | "AI 诊断能力" |
| 18s | 点击「📋 匹配 SOP」| SopPage 高亮 "伺服过流处置流程" | "SOP 联动" |
| 21s | 场景自动：J3 温度降至 45℃ | TwinPage 关节恢复 | "执行处置后恢复" |
| 24s | 点击「🧹 清空告警」| AlertsPage 清空 | "告警可清除" |
| 27s | 点击「🔄 全部复位」| 6 台设备全部回到初始状态 | "系统可控" |

### 10.4 备用方案（录屏兜底）

如果现场网络/投影故障，使用预录 30 秒视频：

```bash
# 录制（一次）
# 1. 启动完整环境
# 2. 使用 OBS 或 QuickTime 录制 1920x1080 区域
# 3. 按 10.3 剧本完整执行一遍
# 4. 导出 webm/mp4

# 存放
mock-control/docs/roadshow-demo-30s.webm

# 路演时
# 如果现场 Demo 失败，直接播放录屏 + 口头解说
```

---

## 11. 测试策略

### 11.1 单元测试

```javascript
// mock-control/test/unit/command-handler.test.js
import { describe, it, expect } from 'vitest';
import { CommandHandler } from '../../server/command-handler.js';
import { StateEngine } from '../../server/state-engine.js';
import { MqttBridge } from '../../server/mqtt-bridge.js';

describe('CommandHandler', () => {
  let handler, state;

  beforeEach(() => {
    state = new StateEngine();
    await state.init();
    const mqtt = new MqttBridge(state);  // 不连接真实 broker
    handler = new CommandHandler(state, mqtt);
  });

  it('should set battery level', async () => {
    const result = await handler.execute({
      robotId: 'FANUC-001', type: 'set_battery', params: { level: 42 },
    });
    expect(result.state.battery).toBe(42);
  });

  it('should clamp battery to 0-100', async () => {
    const r1 = await handler.execute({ robotId: 'FANUC-001', type: 'set_battery', params: { level: 150 }});
    expect(r1.state.battery).toBe(100);
    const r2 = await handler.execute({ robotId: 'FANUC-001', type: 'set_battery', params: { level: -10 }});
    expect(r2.state.battery).toBe(0);
  });

  it('should trigger alarm with zh_desc', async () => {
    const result = await handler.execute({
      robotId: 'FANUC-001', type: 'trigger_alarm', params: { code: 'SRVO-001' },
    });
    expect(result.state.alarms).toHaveLength(1);
    expect(result.state.alarms[0].zh_desc).toBe('伺服放大器过流');
  });

  it('should recalculate health score when joint temperature rises', async () => {
    const before = state.get('FANUC-001').healthScore;
    await handler.execute({
      robotId: 'FANUC-001', type: 'set_joint_temperature',
      params: { axis: 3, temperature: 90 },
    });
    const after = state.get('FANUC-001').healthScore;
    expect(after).toBeLessThan(before);
  });

  it('should reject unknown command type (Zod validation)', async () => {
    await expect(handler.execute({
      robotId: 'FANUC-001', type: 'fly_to_moon', params: {},
    })).rejects.toThrow();
  });

  it('should reject command for non-existent device', async () => {
    await expect(handler.execute({
      robotId: 'NOPE-999', type: 'start', params: {},
    })).rejects.toThrow('not found');
  });
});
```

### 11.2 集成测试（端到端闭环）

```javascript
// mock-control/test/integration/control-loop.test.js
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { startMockBroker, stopMockBroker } from './helpers/mosquitto.js';
import { spawnMockWsServer } from './helpers/mock-ws.js';
import { ControlApiClient } from '../../web/js/api-client.js';

describe('Control Loop (UI → API → MQTT → telemetry → Dashboard)', () => {
  let broker, mockWs, api;

  beforeAll(async () => {
    broker = await startMockBroker();     // 本地 mosquitto 测试实例
    mockWs = await spawnMockWsServer();    // :8082 模拟工业遥测
    api = new ControlApiClient('http://localhost:3000');
  });

  afterAll(async () => {
    await broker.stop();
    await mockWs.kill();
  });

  it('should propagate battery change to telemetry', async () => {
    // [1] UI 下发指令
    await api.sendCommand('FANUC-001', 'set_battery', { level: 33 });

    // [2] 等待 MQTT → mock-ws-server 处理 → telemetry 广播
    await new Promise(r => setTimeout(r, 500));

    // [3] 验证 Dashboard 侧接收到更新
    const telemetry = await mockWs.getLastTelemetry('FANUC-001');
    expect(telemetry.battery).toBe(33);
  });

  it('should propagate alarm to alerts/broadcast topic', async () => {
    const alertPromise = broker.waitForMessage('alerts/broadcast');
    await api.sendCommand('FANUC-001', 'trigger_alarm', { code: 'SRVO-001' });
    const alert = await alertPromise;
    expect(alert.code).toBe('SRVO-001');
    expect(alert.zh_desc).toBe('伺服放大器过流');
  });

  it('should execute full-demo scenario end-to-end', async () => {
    await api.runScenario('full-demo');
    // 验证 FANUC-001 最终状态为 error（SRVO-001）
    await new Promise(r => setTimeout(r, 7000));
    const state = await api.getDevices().then(d => d.find(x => x.robotId === 'FANUC-001'));
    expect(state.status).toBe('error');
    expect(state.alarms.length).toBeGreaterThan(0);
  }, 15000);
});
```

### 11.3 测试覆盖率目标

| 模块 | 覆盖率目标 | 说明 |
|------|-----------|------|
| `state-engine.js` | 90% | 核心逻辑，必须全覆盖 |
| `command-handler.js` | 85% | 所有指令类型至少 1 条用例 |
| `scenario-engine.js` | 80% | 每个预设剧本至少 1 条 E2E |
| `mqtt-bridge.js` | 70% | MQTT 不可用时降级逻辑 |

---

## 12. 与现有架构的对齐清单

### 12.1 类型对齐

| 操作页面类型 | 对齐的现有类型 | 文件 |
|-------------|--------------|------|
| `MockDeviceState` | `UnifiedRobotState` | `adapter-kit/src/types/unified.ts` |
| `JointState` | `JointTelemetry` | `adapter-kit/src/types/industrial.ts` |
| `IndustrialAlarm` | `IndustrialAlarm` | `adapter-kit/src/types/industrial.ts` |
| `ControlCommand` | `CommandPayload`（MQTT） | `python-edge/` 协议约定 |
| `deviceClass` | `DeviceClass` | `adapter-kit/adapters/*/index.ts` |

### 12.2 Topic 对齐

| 操作页面 Topic | 对齐现有代码 | 说明 |
|---------------|-------------|------|
| `industrial/robot/{id}/command` | 🆕 新增 | 下行控制，不与现有冲突 |
| `industrial/robot/{id}/telemetry` | `mqtt-client.ts` 订阅 | 上行遥测，现有已实现 |
| `ota/{id}/command` | `otaStore` + `OTA-README.md` | OTA 指令通道 |
| `ota/{id}/status` | `otaStore.updateFromBackend` | OTA 状态回传 |
| `alerts/broadcast` | `alertStore.addAlert` | 告警广播 |

### 12.3 品牌路由对齐

操作页面按 `robotId` 前缀路由，与 `adaptByBrandEnhanced` 的 brand 参数一一对应：

```javascript
// mock-control 的 brand 推断（从 robotId 前缀）
function inferBrand(robotId) {
  const prefix = robotId.split('-')[0];
  const map = {
    'UNITREE': 'unitree', 'KEENON': 'keenon', 'PUDUTECH': 'pudutech', 'AGIBOT': 'agibot',
    'FANUC': 'fanuc', 'KUKA': 'kuka', 'ESTUN': 'estun', 'YASKAWA': 'yaskawa',
    'DJI': 'dji', 'AUTEL': 'autel', 'VERTIPORT': 'vertiport',
  };
  return map[prefix] || 'unknown';
}
```

> 此推断仅用于操作页面的 UI 展示（品牌图标、控制按钮显隐），**不影响 `wsHub.ts` 的 brand 路由**——`wsHub` 始终以 telemetry payload 中的 `brand` 字段为准。

---

## 13. 安全与合规

### 13.1 已知限制（开发工具，非生产）

| 风险 | 说明 | 缓解 |
|------|------|------|
| 无认证 | 任何能访问 :3000 的人都能控制设备 | 仅本地/内网使用，不暴露公网 |
| 无速率限制 | 可高频发送指令 | 路演场景无需限制 |
| MQTT 匿名 | mosquitto 允许匿名连接 | 仅本地 broker |
| 指令无审计 | 未持久化指令历史 | 前端日志面板仅内存 |

### 13.2 生产迁移路径

如果未来需要将"控制能力"产品化：

1. **认证**：接入 Supabase Auth，`/api/command` 加 JWT 中间件
2. **授权**：按 tenant + role 限制可控制的设备范围（对齐 RLS）
3. **审计**：指令写入 `command_logs` 表（Supabase）
4. **安全**：MQTT 改用 TLS + SASL/SCRAM 认证
5. **限流**：Redis + Token Bucket 限流
6. **工业只读**：生产环境工业机械臂**始终保持只读**，控制仅限商用机器人

> ⚠️ **重要**：操作页面的"控制能力"是 Demo 演示用。真实工业机器人对接时，**控制指令必须由 `python-edge/` 的 FOCAS/OPC UA 客户端执行**，且需通过安全联锁（急停、围栏、权限矩阵）。

---

## 14. 开发任务分解

### 14.1 Phase 1：MVP（路演可用）

| # | 任务 | 工时 | 文件 |
|---|------|------|------|
| 1 | 初始化 mock-control 子项目 + 依赖 | 1h | `package.json` |
| 2 | StateEngine 核心（6 台设备状态树） | 3h | `state-engine.js` |
| 3 | CommandHandler + Zod 校验 | 2h | `command-handler.js` |
| 4 | Express REST API（devices/command/scenario） | 2h | `routes/*.js` |
| 5 | MQTT Bridge（发布指令 + 订阅 telemetry） | 3h | `mqtt-bridge.js` |
| 6 | 操作页面 HTML + 设备网格 | 3h | `web/index.html` + `device-grid.js` |
| 7 | 控制面板（按钮 + 滑块） | 3h | `control-panel.js` |
| 8 | mock-ws-server.js 改造（command 订阅） | 2h | `mock-ws-server.js` 追加 |
| 9 | 联调：UI→API→MQTT→Dashboard | 2h | — |
| 10 | **路演 30 秒剧本** | 1h | `ScenarioRunner` |

**合计：~22 小时 → 3 个工作日**

### 14.2 Phase 2：完善

| # | 任务 | 工时 |
|---|------|------|
| 11 | 场景脚本引擎（多剧本 + 可暂停） | 4h |
| 12 | SSE 实时状态流 | 2h |
| 13 | 低空设备控制（机巢/起降场） | 4h |
| 14 | 单元测试（state-engine + command-handler） | 4h |
| 15 | 集成测试（E2E 闭环） | 4h |
| 16 | 录屏兜底方案 | 1h |

### 14.3 Phase 3：产品化（可选，Y2+）

| # | 任务 | 工时 |
|---|------|------|
| 17 | Supabase Auth 接入 | 1d |
| 18 | 指令审计日志 | 0.5d |
| 19 | TLS MQTT + SASL 认证 | 1d |
| 20 | 速率限制 | 0.5d |

---

## 15. 常见问题

### Q1：操作页面和 mock-ws-server 的关系？

**A**：`mock-ws-server.js` 是"数据源"（发布 telemetry），操作页面是"控制源"（发布 command）。两者通过 MQTT 解耦：
- 操作页面 → MQTT `command` topic → mock-ws-server 接收 → 修改内部状态 → 下次 tick 发布更新后的 telemetry
- Dashboard 只订阅 telemetry，不关心指令从哪来

### Q2：没有 MQTT broker 能用吗？

**A**：能。MQTT Bridge 连接失败时会降级——操作页面直接修改 Control Service 内存状态，并通过 SSE 推送给前端。但 Dashboard（另一个 Tab）不会同步变化。**路演强烈建议启动 mosquitto**。

### Q3：为什么不改 web-console 加控制按钮？

**A**：三个原因：
1. 路演时 Dashboard Tab 已在展示数据，再开一个控制 Tab 更符合"指挥中心"的叙事
2. 不污染 web-console 代码（OPC 补贴申报的代码冻结原则）
3. 操作页面可作为独立产品对外演示（贴牌给客户看）

### Q4：操作页面能控制真实机器人吗？

**A**：不能直接控制。操作页面的指令只影响 mock 数据和 Dashboard 展示。**真实控制路径**是：
```
操作页面 → Control Service → MQTT command
                                ↓
python-edge/ 订阅 → FOCAS/OPC UA 下发 → 真实机器人
```
这条路径在 Phase 3 产品化时实现。

### Q5：路演时断网了怎么办？

**A**：三级兜底：
1. **优先**：确保 mosquitto 本地运行，不依赖外网
2. **备选 A**：使用录屏（30s webm）
3. **备选 B**：Dashboard 已有 `demoStore` 一键演示剧本，不依赖外部控制

### Q6：指令下发后 Dashboard 没反应？

**A**：排查清单：
1. mosquitto 是否在运行？`docker ps | grep mosquitto`
2. Control Service 日志是否有 `→ FANUC-001: ...`？
3. mock-ws-server 日志是否有 `[MockControl] ← FANUC-001: ...`？
4. Dashboard 的 `wsHub.ts` 是否连接了 `:8082`？
5. MQTT topic 是否匹配？`mosquitto_sub -t 'industrial/robot/+/command' -v`

---

## 附录 A：API 参考

### A.1 REST Endpoints

| Method | Path | Body | Response |
|--------|------|------|----------|
| GET | `/api/devices` | — | `MockDeviceState[]` |
| GET | `/api/devices/:id` | — | `MockDeviceState` |
| POST | `/api/command` | `ControlCommand` | `{ success, state }` |
| POST | `/api/command/batch` | `ControlCommand[]` | `{ success, results[] }` |
| POST | `/api/scenario/:name/start` | — | `{ started: true }` |
| POST | `/api/scenario/:name/stop` | — | `{ stopped: true }` |
| GET | `/api/telemetry/stream` | — | SSE stream |
| GET | `/health` | — | `{ ok, devices }` |

### A.2 SSE 事件格式

```
event: state
data: {"robotId":"FANUC-001","status":"working","battery":65,"healthScore":72,...}

event: alert
data: {"robotId":"FANUC-001","code":"SRVO-001","severity":"error","zh_desc":"伺服放大器过流"}

event: scenario
data: {"name":"full-demo","phase":3,"total":6,"label":"AI 诊断完成"}
```

---

## 附录 B：与现有文档的关系

| 文档 | 关系 |
|------|------|
| `README.md` | 本项目架构总纲（操作页面为新增子系统） |
| `robot-ops-solo-CODE-RULES.md` | 代码风格约束（操作页面需遵守 human-coder 风格） |
| `robot-ops-solo-软著提过率规则.md` | 软著合规（操作页面代码也需去 AI 化注释） |
| `robot-ops-solo-多品牌接入开发文档.md` | 品牌 adapter 参考（操作页面 brand 推断对齐此文档） |
| `robot-ops-solo-industrial-dev-guide.md` | 工业扩展架构（操作页面工业控制对齐 13 章设计） |
| `robot-ops-solo-轻量OTA开发文档.md` | OTA MQTT Topic 规范（操作页面 OTA 指令复用） |
| `低空机巢接入完整开发文档.md` | 低空 adapter 参考（Phase 2 低空控制对齐） |
| `robot-ops-solo-Agent开发指南.md` | Agent 工具集（路演剧本中 Agent 诊断环节） |
| `POC-现场执行清单.md` | POC 现场操作清单（路演 Demo 部分对齐） |

---

> **文档维护**：本文件随操作页面开发同步更新，架构变更后需重新核对"§12 对齐清单"。
