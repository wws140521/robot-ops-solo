# Robot-Ops-Solo 工业机器人模块开发文档

> 版本：v1.0  
> 日期：2026-08-18  
> 目标：在现有商用机器人运维平台基础上，新增跨品牌工业机器人运维能力（FANUC / KUKA / 埃斯顿 / 安川）

---

## 目录

- [一、模块总览](#一模块总览)
- [二、目录结构变更](#二目录结构变更)
- [三、类型定义](#三类型定义)
- [四、适配器实现](#四适配器实现)
- [五、3D 数字孪生模型](#五3d-数字孪生模型)
- [六、SOP 新节点](#六sop-新节点)
- [七、wsHub 消息分流改造](#七wshub-消息分流改造)
- [八、AI SaaS 对接](#八ai-saas-对接)
- [九、Mock 数据扩展](#九mock-数据扩展)
- [十、页面层改造](#十页面层改造)
- [十一、开发顺序与验证](#十一开发顺序与验证)
- [十二、关键原则](#十二关键原则)

---

## 一、模块总览

| 能力 | 商用（已有） | 工业（新增） |
|------|-------------|-------------|
| 品牌适配 | 宇树/擎朗/普渡/智元 | FANUC / KUKA / 埃斯顿 / 安川 |
| 遥测数据 | 电量/位置/速度 | 关节负载/温度/电流/报警码/运行时间 |
| 3D 模型 | G1Dog / PeanutBot | FanucArm / KukaArm（简易连杆） |
| 控制方式 | 启动/停止/回充 | **只读监控**（不下发控制指令） |
| AI 分析 | 无 | 告警摘要 + 预测性维护（调 AI SaaS） |
| SOP 节点 | Move/Speak/Wait/Loop | ReadAlarm / Predict / Maintenance / Log |

### 架构不变性

- 现有商用机器人代码**零破坏**：所有工业扩展使用 `industrial?` 可选字段
- `adaptByBrand()` 工厂函数统一入口，新增品牌 = 新增文件 + 注册一行
- Mock 先行：开发阶段全用 `mock-ws-server.js` 模拟工业数据，Python FOCAS 驱动是"现场交付工具"不是开发依赖

---

## 二、目录结构变更

### 2.1 adapter-kit 变更

```
packages/adapter-kit/src/
├── types/
│   ├── unified.ts              # 🔧 扩展：加 IndustrialExtension（可选字段）
│   └── industrial.ts           # 🆕 新建：工业专有类型定义
├── adapters/
│   ├── index.ts                # 🔧 改：按 brand 分发到 commercial/ 或 industrial/
│   ├── commercial/             # 不动
│   │   ├── adapter-unitree.ts
│   │   ├── adapter-keenon.ts
│   │   ├── adapter-pudutech.ts
│   │   └── adapter-agibot.ts
│   └── industrial/             # 🆕 新建目录
│       ├── _registry.ts        # 🆕 工业品牌注册表
│       ├── adapter-fanuc.ts    # 🆕 FANUC FOCAS → UnifiedRobotState
│       ├── adapter-kuka.ts     # 🆕 KUKA OPC UA → UnifiedRobotState
│       ├── adapter-estun.ts    # 🆕 埃斯顿 Modbus-TCP → UnifiedRobotState
│       └── adapter-yaskawa.ts  # 🆕 安川 Ethernet → UnifiedRobotState
├── protocol/
│   ├── ws-client.ts            # 不动
│   └── mqtt-client.ts          # 🔧 扩展：订阅 industrial/robot/+/telemetry
└── __tests__/
    ├── adapter-fanuc.test.ts   # 🆕
    ├── adapter-kuka.test.ts    # 🆕
    └── adapter-estun.test.ts   # 🆕
```

### 2.2 digital-twin 变更

```
packages/digital-twin/src/robots/
├── G1Dog.tsx                   # 不动
├── PeanutBot.tsx               # 不动
├── FanucArm.tsx                # 🆕 6 轴连杆简易模型
└── KukaArm.tsx                 # 🆕 6 轴连杆简易模型
```

### 2.3 sop-editor 变更

```
packages/sop-editor/src/nodes/
├── MoveNode.tsx                # 不动
├── SpeakNode.tsx               # 不动
├── WaitNode.tsx                # 不动
├── LoopNode.tsx                # 不动
├── BootNode.tsx                # 不动
├── ShutdownNode.tsx            # 不动
├── PickupNode.tsx              # 不动
├── ConditionNode.tsx            # 不动
├── NodeEditButton.tsx           # 不动
├── ReadAlarmNode.tsx           # 🆕 读报警码节点
├── PredictNode.tsx             # 🆕 AI 预测节点
└── MaintenanceNode.tsx         # 🆕 维护工单节点
```

### 2.4 web-console 变更

```
apps/web-console/src/
├── components/
│   └── overlays/
│       ├── SpeakBubble.tsx     # 不动
│       └── AIInsightPanel.tsx  # 🆕 AI 告警摘要面板
├── routes/
│   ├── RobotsPage.tsx          # 🔧 改：brand 判断隐藏控制按钮
│   ├── TwinPage.tsx            # 🔧 改：按 brand 加载 FanucArm/KukaArm
│   └── AlertsPage.tsx          # 🔧 改：显示工业告警 raw_code + zh_desc
└── lib/
    ├── wsHub.ts                # 🔧 改：industrial 消息分流
    └── aiSaaSApi.ts            # 🆕 AI SaaS API 封装
```

### 2.5 根目录变更

```
robot-ops-solo/
├── mock-ws-server.js           # 🔧 改：加工业数据模拟
└── python-edge/                # 🆕 新建：Python 边缘驱动（现场交付用）
    ├── fanuc_focas/
    │   ├── config.yaml
    │   ├── focas_client.py
    │   ├── karel_bridge.py
    │   └── parser.py
    ├── kuka_opcua/
    │   ├── config.yaml
    │   ├── opcua_client.py
    │   └── parser.py
    ├── estun_modbus/
    │   ├── config.yaml
    │   ├── modbus_client.py
    │   └── parser.py
    └── edge-poller.py          # 主轮询入口
```

---

## 三、类型定义

### 3.1 🆕 `packages/adapter-kit/src/types/industrial.ts`

```typescript
/**
 * 工业机器人专有类型定义
 * 所有字段对应 UDM（Unified Data Model）JSON Schema v1.0
 */

// ─── 单关节遥测 ─────────────────────────────────
export interface JointTelemetry {
  j: number;              // 关节号 1-6
  load_pct: number;       // 转矩负载率 %（0-200）
  temp_c?: number;        // 电机温度 ℃
  current_a?: number;     // 伺服电流 A
  speed_rpm?: number;     // 转速
  health_score?: number;  // 健康分 0-100
  rul_days?: number;      // 剩余使用寿命预测（天）
}

// ─── 告警严重级别 ───────────────────────────────
export type AlarmSeverity = 'info' | 'warn' | 'error' | 'critical';

// ─── 工业告警 ───────────────────────────────────
export interface IndustrialAlarm {
  raw_code: string;       // 原厂报警号，如 "SRVO-023"
  udm_code: string;       // 统一编码，如 "OVER_TEMP_J2"
  severity: AlarmSeverity;
  zh_desc: string;        // 中文描述
  occurred_at: string;    // ISO 8601 时间戳
  cleared: boolean;       // 是否已清除
}

// ─── 运行时统计 ─────────────────────────────────
export interface IndustrialRuntime {
  power_on_hours: number;     // 通电总时长
  operating_hours?: number;   // 实际运行时长
  cycle_count: number;        // 运行周期计数
  last_maintenance_at?: string; // 末次保养时间 ISO 8601
  payload_kg?: number;        // 当前负载重量
}

// ─── 工业扩展（嵌入 UnifiedRobotState） ──────────
export interface IndustrialExtension {
  joints: JointTelemetry[];
  alarms: IndustrialAlarm[];
  runtime: IndustrialRuntime;
  protocol: string;       // "FOCAS" | "OPC_UA" | "MODBUS_TCP" | "ETHERNET_KRL"
}

// ─── 协议适配配置（YAML 映射源） ────────────────
export interface ProtocolConfig {
  brand: string;
  model: string;
  host: string;
  port: number;
  protocol: string;
  sample_interval_sec: number;
  r_map?: Record<string, number>;       // R 寄存器映射（FANUC KAREL 桥接）
  alarm_dict?: Record<string, {         // 报警码字典
    udm_code: string;
    severity: AlarmSeverity;
    zh_desc: string;
  }>;
}
```

### 3.2 🔧 `packages/adapter-kit/src/types/unified.ts` 扩展

在文件末尾追加以下内容（**不修改现有接口**）：

```typescript
import type { IndustrialExtension } from './industrial';

/**
 * 在 UnifiedRobotState 接口末尾加可选字段：
 *   industrial?: IndustrialExtension;
 *
 * 示例（不要直接覆盖原文件，用声明合并）：
 */
export interface UnifiedRobotState {
  // ... 现有字段不动 ...

  /**
   * 工业扩展字段
   * - 商用机器人（宇树/擎朗/普渡/智元）不传此字段
   * - 工业机器人（FANUC/KUKA/埃斯顿/安川）必传
   */
  industrial?: IndustrialExtension;
}
```

> **实操提示**：如果原 `UnifiedRobotState` 是 `interface` 且在同一文件，直接在末尾加 `industrial?: IndustrialExtension;` 一行即可。如果是 `type`，改用交叉类型扩展。

---

## 四、适配器实现

### 4.1 🆕 `packages/adapter-kit/src/adapters/industrial/_registry.ts`

```typescript
/**
 * 工业品牌注册表
 * 新增品牌只需在此注册 + 创建 adapter 文件
 */
import type { UnifiedRobotState, UnifiedAlert } from '../types/unified';
import { adaptFanuc } from './adapter-fanuc';
import { adaptKuka } from './adapter-kuka';
import { adaptEstun } from './adapter-estun';
import { adaptYaskawa } from './adapter-yaskawa';

export type AdapterFn = (raw: any) => {
  state: UnifiedRobotState;
  alerts: UnifiedAlert[];
};

const registry: Record<string, AdapterFn> = {
  fanuc: adaptFanuc,
  kuka: adaptKuka,
  estun: adaptEstun,
  yaskawa: adaptYaskawa,
  // 未来扩展：'abb': adaptAbb, 'ur': adaptUR
};

export function adaptIndustrial(
  brand: string,
  raw: any
): { state: UnifiedRobotState; alerts: UnifiedAlert[] } {
  const fn = registry[brand.toLowerCase()];
  if (!fn) {
    throw new Error(
      `[adapter-kit] Unknown industrial brand: "${brand}". ` +
      `Registered: ${Object.keys(registry).join(', ')}`
    );
  }
  return fn(raw);
}

export function getRegisteredIndustrialBrands(): string[] {
  return Object.keys(registry);
}
```

### 4.2 🆕 `packages/adapter-kit/src/adapters/industrial/adapter-fanuc.ts`

```typescript
/**
 * FANUC FOCAS → UnifiedRobotState 适配器
 *
 * 输入：Python FOCAS 驱动输出的 UDM JSON
 *   {
 *     "robot_id": "FANUC_M20iD_001",
 *     "model": "M-20iD/25",
 *     "timestamp": "2026-08-18T09:26:00+08:00",
 *     "joints": [{ "j": 1, "load_pct": 62, "temp_c": 41, ... }],
 *     "alarms": [{ "raw_code": "SRVO-023", ... }],
 *     "runtime": { "power_on_hours": 18432, ... }
 *   }
 *
 * 输出：{ state: UnifiedRobotState, alerts: UnifiedAlert[] }
 */
import type { UnifiedRobotState, UnifiedAlert } from '../types/unified';
import type {
  JointTelemetry,
  IndustrialAlarm,
  IndustrialRuntime,
  IndustrialExtension,
} from '../types/industrial';

export function adaptFanuc(
  raw: any
): { state: UnifiedRobotState; alerts: UnifiedAlert[] } {
  // ─── 1. 解析关节数据 ───────────────────────
  const joints: JointTelemetry[] = (raw.joints || []).map((j: any) => ({
    j: j.j,
    load_pct: typeof j.load_pct === 'number' ? j.load_pct : 0,
    temp_c: j.temp_c,
    current_a: j.current_a,
    speed_rpm: j.speed_rpm,
    health_score: j.health_score ?? 100,
    rul_days: j.rul_days,
  }));

  // ─── 2. 解析告警 ───────────────────────────
  const alarms: IndustrialAlarm[] = (raw.alarms || []).map((a: any) => ({
    raw_code: a.raw_code || 'UNKNOWN',
    udm_code: a.udm_code || 'UNKNOWN',
    severity: a.severity || 'warn',
    zh_desc: a.zh_desc || '',
    occurred_at: a.occurred_at || new Date().toISOString(),
    cleared: a.cleared ?? false,
  }));

  // ─── 3. 运行时统计 ─────────────────────────
  const runtime: IndustrialRuntime = {
    power_on_hours: raw.runtime?.power_on_hours ?? 0,
    operating_hours: raw.runtime?.operating_hours,
    cycle_count: raw.runtime?.cycle_count ?? 0,
    last_maintenance_at: raw.runtime?.last_maintenance_at,
    payload_kg: raw.runtime?.payload_kg,
  };

  // ─── 4. 组装 IndustrialExtension ────────────
  const industrial: IndustrialExtension = {
    joints,
    alarms,
    runtime,
    protocol: 'FOCAS',
  };

  // ─── 5. 组装 UnifiedRobotState ──────────────
  const state: UnifiedRobotState = {
    robotId: raw.robot_id || `fanuc-${Date.now()}`,
    brand: 'FANUC',
    model: raw.model || 'Unknown',
    online: true,
    industrial,
    // 商用字段留 undefined（不破坏现有逻辑）
    battery: undefined,
    position: undefined,
    velocity: undefined,
  };

  // ─── 6. 转 UnifiedAlert[]（wsHub 消费用）───
  const unifiedAlerts: UnifiedAlert[] = alarms.map((a) => ({
    id: `${state.robotId}-${a.raw_code}-${a.occurred_at}`,
    robotId: state.robotId,
    level: a.severity,
    message: `[${a.raw_code}] ${a.zh_desc}`,
    timestamp: a.occurred_at,
    acknowledged: false,
  }));

  return { state, alerts: unifiedAlerts };
}
```

### 4.3 🆕 `packages/adapter-kit/src/adapters/industrial/adapter-kuka.ts`

```typescript
/**
 * KUKA OPC UA → UnifiedRobotState 适配器
 *
 * 输入：Python OPC UA 客户端采集的 KUKA 数据
 *   {
 *     "robot_id": "KUKA_KR6_001",
 *     "model": "KR 6 R900 sixx",
 *     "timestamp": "...",
 *     "joints": [{ "j": 1, "load_pct": 45, "temp_c": 38, ... }],
 *     "alarms": [{ "raw_code": "KSS15002", ... }],
 *     "runtime": { ... }
 *   }
 */
import type { UnifiedRobotState, UnifiedAlert } from '../types/unified';
import type {
  JointTelemetry,
  IndustrialAlarm,
  IndustrialRuntime,
  IndustrialExtension,
} from '../types/industrial';

// KUKA KSS 报警码 → UDM 映射（示例，按需扩展）
const KUKA_ALARM_MAP: Record<string, { udm_code: string; severity: any; zh_desc: string }> = {
  KSS15002: { udm_code: 'DRIVE_FAULT', severity: 'error', zh_desc: '驱动器故障' },
  KSS15012: { udm_code: 'COMM_LOST', severity: 'error', zh_desc: '通信中断' },
  KSS15103: { udm_code: 'OVER_TEMP', severity: 'warn', zh_desc: '轴温过高' },
  KSS15202: { udm_code: 'BREAKER_OPEN', severity: 'critical', zh_desc: '断路器断开' },
};

export function adaptKuka(
  raw: any
): { state: UnifiedRobotState; alerts: UnifiedAlert[] } {
  const joints: JointTelemetry[] = (raw.joints || []).map((j: any) => ({
    j: j.j,
    load_pct: j.load_pct ?? 0,
    temp_c: j.temp_c,
    current_a: j.current_a,
    speed_rpm: j.speed_rpm,
    health_score: j.health_score ?? 100,
    rul_days: j.rul_days,
  }));

  const alarms: IndustrialAlarm[] = (raw.alarms || []).map((a: any) => {
    const mapped = KUKA_ALARM_MAP[a.raw_code] || {
      udm_code: 'UNKNOWN',
      severity: 'warn',
      zh_desc: a.zh_desc || '未知告警',
    };
    return {
      raw_code: a.raw_code,
      udm_code: mapped.udm_code,
      severity: mapped.severity,
      zh_desc: mapped.zh_desc,
      occurred_at: a.occurred_at || new Date().toISOString(),
      cleared: a.cleared ?? false,
    };
  });

  const runtime: IndustrialRuntime = {
    power_on_hours: raw.runtime?.power_on_hours ?? 0,
    cycle_count: raw.runtime?.cycle_count ?? 0,
    last_maintenance_at: raw.runtime?.last_maintenance_at,
  };

  const industrial: IndustrialExtension = {
    joints,
    alarms,
    runtime,
    protocol: 'OPC_UA',
  };

  const state: UnifiedRobotState = {
    robotId: raw.robot_id || `kuka-${Date.now()}`,
    brand: 'KUKA',
    model: raw.model || 'Unknown',
    online: true,
    industrial,
    battery: undefined,
    position: undefined,
    velocity: undefined,
  };

  const unifiedAlerts: UnifiedAlert[] = alarms.map((a) => ({
    id: `${state.robotId}-${a.raw_code}-${a.occurred_at}`,
    robotId: state.robotId,
    level: a.severity,
    message: `[${a.raw_code}] ${a.zh_desc}`,
    timestamp: a.occurred_at,
    acknowledged: false,
  }));

  return { state, alerts: unifiedAlerts };
}
```

### 4.4 🆕 `packages/adapter-kit/src/adapters/industrial/adapter-estun.ts`

```typescript
/**
 * 埃斯顿 Modbus-TCP → UnifiedRobotState 适配器
 *
 * 输入：Python Modbus 客户端采集的埃斯顿数据
 *   {
 *     "robot_id": "ESTUN_ER3A_001",
 *     "model": "ER3A-C60",
 *     "timestamp": "...",
 *     "joints": [{ "j": 1, "load_pct": 35, ... }],
 *     "alarms": [{ "raw_code": "EST-3001", ... }],
 *     "runtime": { ... }
 *   }
 */
import type { UnifiedRobotState, UnifiedAlert } from '../types/unified';
import type {
  JointTelemetry,
  IndustrialAlarm,
  IndustrialRuntime,
  IndustrialExtension,
} from '../types/industrial';

const ESTUN_ALARM_MAP: Record<string, { udm_code: string; severity: any; zh_desc: string }> = {
  'EST-3001': { udm_code: 'OVER_LOAD', severity: 'warn', zh_desc: '关节过载' },
  'EST-3002': { udm_code: 'ENCODER_ERR', severity: 'error', zh_desc: '编码器错误' },
  'EST-3003': { udm_code: 'OVER_TEMP', severity: 'warn', zh_desc: '驱动器过热' },
  'EST-3004': { udm_code: 'COMM_ERR', severity: 'error', zh_desc: '通信异常' },
};

export function adaptEstun(
  raw: any
): { state: UnifiedRobotState; alerts: UnifiedAlert[] } {
  const joints: JointTelemetry[] = (raw.joints || []).map((j: any) => ({
    j: j.j,
    load_pct: j.load_pct ?? 0,
    temp_c: j.temp_c,
    current_a: j.current_a,
    speed_rpm: j.speed_rpm,
    health_score: j.health_score ?? 100,
    rul_days: j.rul_days,
  }));

  const alarms: IndustrialAlarm[] = (raw.alarms || []).map((a: any) => {
    const mapped = ESTUN_ALARM_MAP[a.raw_code] || {
      udm_code: 'UNKNOWN',
      severity: 'warn',
      zh_desc: a.zh_desc || '未知告警',
    };
    return {
      raw_code: a.raw_code,
      udm_code: mapped.udm_code,
      severity: mapped.severity,
      zh_desc: mapped.zh_desc,
      occurred_at: a.occurred_at || new Date().toISOString(),
      cleared: a.cleared ?? false,
    };
  });

  const runtime: IndustrialRuntime = {
    power_on_hours: raw.runtime?.power_on_hours ?? 0,
    cycle_count: raw.runtime?.cycle_count ?? 0,
    last_maintenance_at: raw.runtime?.last_maintenance_at,
  };

  const industrial: IndustrialExtension = {
    joints,
    alarms,
    runtime,
    protocol: 'MODBUS_TCP',
  };

  const state: UnifiedRobotState = {
    robotId: raw.robot_id || `estun-${Date.now()}`,
    brand: 'ESTUN',
    model: raw.model || 'Unknown',
    online: true,
    industrial,
    battery: undefined,
    position: undefined,
    velocity: undefined,
  };

  const unifiedAlerts: UnifiedAlert[] = alarms.map((a) => ({
    id: `${state.robotId}-${a.raw_code}-${a.occurred_at}`,
    robotId: state.robotId,
    level: a.severity,
    message: `[${a.raw_code}] ${a.zh_desc}`,
    timestamp: a.occurred_at,
    acknowledged: false,
  }));

  return { state, alerts: unifiedAlerts };
}
```

### 4.5 🆕 `packages/adapter-kit/src/adapters/industrial/adapter-yaskawa.ts`

```typescript
/**
 * 安川 Ethernet → UnifiedRobotState 适配器
 *
 * 输入：Python 安川以太网客户端采集的数据
 *   {
 *     "robot_id": "YASKAWA_GP8_001",
 *     "model": "GP8 (YRC1000)",
 *     "timestamp": "...",
 *     "joints": [{ "j": 1, "load_pct": 50, ... }],
 *     "alarms": [{ "raw_code": "4100", ... }],
 *     "runtime": { ... }
 *   }
 */
import type { UnifiedRobotState, UnifiedAlert } from '../types/unified';
import type {
  JointTelemetry,
  IndustrialAlarm,
  IndustrialRuntime,
  IndustrialExtension,
} from '../types/industrial';

const YASKAWA_ALARM_MAP: Record<string, { udm_code: string; severity: any; zh_desc: string }> = {
  '4100': { udm_code: 'SERVO_ALARM', severity: 'error', zh_desc: '伺服报警' },
  '4110': { udm_code: 'OVER_TEMP', severity: 'warn', zh_desc: '伺服过热' },
  '4200': { udm_code: 'COMM_ERR', severity: 'error', zh_desc: '通信错误' },
  '4300': { udm_code: 'BREAKER_OPEN', severity: 'critical', zh_desc: '主回路断路器断开' },
  '4400': { udm_code: 'ENCODER_ERR', severity: 'error', zh_desc: '编码器异常' },
};

export function adaptYaskawa(
  raw: any
): { state: UnifiedRobotState; alerts: UnifiedAlert[] } {
  const joints: JointTelemetry[] = (raw.joints || []).map((j: any) => ({
    j: j.j,
    load_pct: j.load_pct ?? 0,
    temp_c: j.temp_c,
    current_a: j.current_a,
    speed_rpm: j.speed_rpm,
    health_score: j.health_score ?? 100,
    rul_days: j.rul_days,
  }));

  const alarms: IndustrialAlarm[] = (raw.alarms || []).map((a: any) => {
    const mapped = YASKAWA_ALARM_MAP[a.raw_code] || {
      udm_code: 'UNKNOWN',
      severity: 'warn',
      zh_desc: a.zh_desc || '未知告警',
    };
    return {
      raw_code: a.raw_code,
      udm_code: mapped.udm_code,
      severity: mapped.severity,
      zh_desc: mapped.zh_desc,
      occurred_at: a.occurred_at || new Date().toISOString(),
      cleared: a.cleared ?? false,
    };
  });

  const runtime: IndustrialRuntime = {
    power_on_hours: raw.runtime?.power_on_hours ?? 0,
    cycle_count: raw.runtime?.cycle_count ?? 0,
    last_maintenance_at: raw.runtime?.last_maintenance_at,
  };

  const industrial: IndustrialExtension = {
    joints,
    alarms,
    runtime,
    protocol: 'ETHERNET_YASKAWA',
  };

  const state: UnifiedRobotState = {
    robotId: raw.robot_id || `yaskawa-${Date.now()}`,
    brand: 'YASKAWA',
    model: raw.model || 'Unknown',
    online: true,
    industrial,
    battery: undefined,
    position: undefined,
    velocity: undefined,
  };

  const unifiedAlerts: UnifiedAlert[] = alarms.map((a) => ({
    id: `${state.robotId}-${a.raw_code}-${a.occurred_at}`,
    robotId: state.robotId,
    level: a.severity,
    message: `[${a.raw_code}] ${a.zh_desc}`,
    timestamp: a.occurred_at,
    acknowledged: false,
  }));

  return { state, alerts: unifiedAlerts };
}
```

### 4.6 🔧 `packages/adapter-kit/src/adapters/index.ts` 改造

在现有文件末尾追加（**不删除现有 commercial 逻辑**）：

```typescript
// ─── 现有 commercial 导出保持不变 ───────────────
export { adaptByBrand as adaptCommercial } from './commercial';

// ─── 🆕 工业品牌分发 ─────────────────────────────
import { adaptIndustrial, getRegisteredIndustrialBrands } from './industrial/_registry';

const INDUSTRIAL_BRANDS = new Set([
  'fanuc', 'kuka', 'estun', 'yaskawa',
  // 未来扩展：'abb', 'ur'
]);

/**
 * 增强版 adaptByBrand
 * - 工业品牌 → 走 industrial/_registry
 * - 商用品牌 → 走原有 commercial 逻辑
 */
export function adaptByBrandEnhanced(
  brand: string,
  raw: any
): { state: any; alerts: any[] } {
  const lower = brand.toLowerCase();

  if (INDUSTRIAL_BRANDS.has(lower)) {
    return adaptIndustrial(lower, raw);
  }

  // 商用品牌走原有逻辑
  return adaptCommercial(brand, raw);
}

export { adaptIndustrial, getRegisteredIndustrialBrands };
```

> **注意**：如果现有 `index.ts` 已经导出了 `adaptByBrand`，你可以在调用处改为 `adaptByBrandEnhanced`，或者直接将原函数改名替换。保持向后兼容的话，建议保留原名、内部改实现。

---

## 五、3D 数字孪生模型

### 5.1 🆕 `packages/digital-twin/src/robots/FanucArm.tsx`

```tsx
/**
 * FANUC 6 轴工业机器人简易 3D 模型
 * POC 阶段用圆柱体+长方体表示连杆，关节角度驱动旋转
 * 负载率高时颜色偏红，正常时橙色
 */
import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import type { JointTelemetry } from '../../../../adapter-kit/src/types/industrial';

interface Props {
  joints: JointTelemetry[];
  scale?: number;
}

const JOINT_COLORS = {
  normal: '#FF6600',   // FANUC 橙
  warning: '#FFCC00',   // 黄
  danger: '#FF2222',    // 红
};

function getLoadColor(loadPct: number): string {
  if (loadPct > 100) return JOINT_COLORS.danger;
  if (loadPct > 80) return JOINT_COLORS.warning;
  return JOINT_COLORS.normal;
}

export function FanucArm({ joints, scale = 1 }: Props) {
  // 6 个关节的 ref
  const refs = [
    useRef<any>(), useRef<any>(), useRef<any>(),
    useRef<any>(), useRef<any>(), useRef<any>(),
  ];

  useFrame((_, delta) => {
    joints.forEach((j, i) => {
      const ref = refs[i].current;
      if (!ref) return;

      // 用负载率驱动颜色
      ref.material.color.set(getLoadColor(j.load_pct));

      // 简易旋转动画（实际应接真实关节角度）
      const speed = (j.speed_rpm || 0) * 0.01;
      ref.rotation.z += speed * delta;
    });
  });

  return (
    <group scale={scale}>
      {/* 基座 */}
      <mesh position={[0, 0.1, 0]}>
        <cylinderGeometry args={[0.18, 0.22, 0.2, 24]} />
        <meshStandardMaterial color="#333" metalness={0.6} roughness={0.4} />
      </mesh>

      {/* J1 - 旋转底座 */}
      <group position={[0, 0.22, 0]} ref={refs[0]}>
        <mesh position={[0, 0.15, 0]}>
          <cylinderGeometry args={[0.1, 0.12, 0.3, 16]} />
          <meshStandardMaterial color={JOINT_COLORS.normal} />
        </mesh>

        {/* J2 - 大臂 */}
        <group position={[0, 0.3, 0]} ref={refs[1]}>
          <mesh position={[0, 0.25, 0]} rotation={[0.3, 0, 0]}>
            <boxGeometry args={[0.1, 0.5, 0.1]} />
            <meshStandardMaterial color={JOINT_COLORS.normal} />
          </mesh>

          {/* J3 - 小臂 */}
          <group position={[0, 0.5, 0]} ref={refs[2]}>
            <mesh position={[0, 0.2, 0]}>
              <boxGeometry args={[0.08, 0.4, 0.08]} />
              <meshStandardMaterial color={JOINT_COLORS.normal} />
            </mesh>

            {/* J4-J6 简化 */}
            <group position={[0, 0.4, 0]} ref={refs[3]}>
              <mesh>
                <sphereGeometry args={[0.06, 12, 12]} />
                <meshStandardMaterial color={JOINT_COLORS.normal} />
              </mesh>
            </group>
          </group>
        </group>
      </group>

      {/* 品牌标签 */}
      <mesh position={[0, -0.05, 0]}>
        <ringGeometry args={[0.25, 0.3, 32]} />
        <meshBasicMaterial color="#FF6600" transparent opacity={0.3} />
      </mesh>
    </group>
  );
}
```

### 5.2 🆕 `packages/digital-twin/src/robots/KukaArm.tsx`

```tsx
/**
 * KUKA 6 轴工业机器人简易 3D 模型
 * 风格偏白色机身（KUKA 经典配色）
 */
import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import type { JointTelemetry } from '../../../../adapter-kit/src/types/industrial';

interface Props {
  joints: JointTelemetry[];
  scale?: number;
}

const KUKA_ORANGE = '#FF6600';
const KUKA_WHITE = '#F5F5F5';

export function KukaArm({ joints, scale = 1 }: Props) {
  const refs = [
    useRef<any>(), useRef<any>(), useRef<any>(),
    useRef<any>(), useRef<any>(), useRef<any>(),
  ];

  useFrame((_, delta) => {
    joints.forEach((j, i) => {
      const ref = refs[i].current;
      if (!ref) return;
      const intensity = Math.min(j.load_pct / 100, 1);
      ref.material.color.setRGB(1, 1 - intensity * 0.6, 1 - intensity);
      const speed = (j.speed_rpm || 0) * 0.01;
      ref.rotation.z += speed * delta;
    });
  });

  return (
    <group scale={scale}>
      {/* 方形底座（KUKA 特征） */}
      <mesh position={[0, 0.15, 0]}>
        <boxGeometry args={[0.35, 0.3, 0.35]} />
        <meshStandardMaterial color={KUKA_WHITE} metalness={0.3} />
      </mesh>

      {/* J1 */}
      <group position={[0, 0.35, 0]} ref={refs[0]}>
        <mesh position={[0, 0.15, 0]}>
          <cylinderGeometry args={[0.08, 0.1, 0.3, 16]} />
          <meshStandardMaterial color={KUKA_ORANGE} />
        </mesh>

        {/* J2 */}
        <group position={[0, 0.3, 0]} ref={refs[1]}>
          <mesh position={[0, 0.2, 0]} rotation={[0.4, 0, 0]}>
            <boxGeometry args={[0.08, 0.4, 0.08]} />
            <meshStandardMaterial color={KUKA_WHITE} />
          </mesh>

          {/* J3 */}
          <group position={[0, 0.4, 0]} ref={refs[2]}>
            <mesh position={[0, 0.15, 0]}>
              <boxGeometry args={[0.06, 0.3, 0.06]} />
              <meshStandardMaterial color={KUKA_WHITE} />
            </mesh>

            {/* J4-J6 末端 */}
            <group position={[0, 0.3, 0]} ref={refs[3]}>
              <mesh>
                <coneGeometry args={[0.05, 0.15, 8]} />
                <meshStandardMaterial color={KUKA_ORANGE} />
              </mesh>
            </group>
          </group>
        </group>
      </group>
    </group>
  );
}
```

### 5.3 🆕 `packages/digital-twin/src/robots/index.ts` 扩展

```typescript
// 在现有 index.ts 中追加导出
export { FanucArm } from './FanucArm';
export { KukaArm } from './KukaArm';
```

---

## 六、SOP 新节点

### 6.1 🆕 `packages/sop-editor/src/nodes/ReadAlarmNode.tsx`

```tsx
/**
 * ReadAlarmNode - 读取机器人当前报警码
 * 输入：机器人状态
 * 输出：报警码 → 传递给下一个节点做条件分支
 */
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { useState } from 'react';

export interface ReadAlarmNodeData {
  robotId?: string;
  condition?: string;   // 触发条件，如 "severity >= warn"
  label?: string;
}

export function ReadAlarmNode({ data }: NodeProps) {
  const [editing, setEditing] = useState(false);
  const d = data as ReadAlarmNodeData;

  return (
    <div
      className="bg-red-50 border-2 border-red-300 rounded-lg p-3 min-w-[160px] shadow-sm"
      onDoubleClick={() => setEditing(true)}
    >
      <Handle type="target" position={Position.Top} className="!bg-red-400" />
      <div className="text-xs font-bold text-red-700 mb-1 flex items-center gap-1">
        🚨 读报警码
      </div>
      {editing ? (
        <input
          className="text-xs w-full border rounded px-1"
          placeholder="robotId"
          defaultValue={d.robotId || ''}
          onBlur={() => setEditing(false)}
        />
      ) : (
        <div className="text-xs text-gray-600">
          {d.robotId || '点击选择机器人'}
        </div>
      )}
      <div className="text-xs text-gray-500 mt-1">
        条件: {d.condition || '任意报警'}
      </div>
      <Handle type="source" position={Position.Bottom} className="!bg-red-400" />
    </div>
  );
}
```

### 6.2 🆕 `packages/sop-editor/src/nodes/PredictNode.tsx`

```tsx
/**
 * PredictNode - 调用 AI SaaS 预测健康分 / 剩余寿命
 * 输入：机器人遥测数据
 * 输出：health_score + rul_days → 传递给下一个节点
 */
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { useState } from 'react';

export interface PredictNodeData {
  target?: string;       // 预测目标：health_score | rul_days | both
  apiEndpoint?: string;  // AI SaaS API 地址
  robotId?: string;
  label?: string;
}

export function PredictNode({ data }: NodeProps) {
  const [editing, setEditing] = useState(false);
  const d = data as PredictNodeData;

  return (
    <div
      className="bg-purple-50 border-2 border-purple-300 rounded-lg p-3 min-w-[160px] shadow-sm"
      onDoubleClick={() => setEditing(true)}
    >
      <Handle type="target" position={Position.Top} className="!bg-purple-400" />
      <div className="text-xs font-bold text-purple-700 mb-1 flex items-center gap-1">
        🧠 AI 预测
      </div>
      {editing ? (
        <select
          className="text-xs w-full border rounded px-1"
          defaultValue={d.target || 'both'}
          onBlur={() => setEditing(false)}
        >
          <option value="health_score">健康分</option>
          <option value="rul_days">剩余寿命</option>
          <option value="both">全部</option>
        </select>
      ) : (
        <>
          <div className="text-xs text-gray-600">
            目标: {d.target || '健康分+寿命'}
          </div>
          <div className="text-xs text-gray-500 mt-1">
            机器人: {d.robotId || '未指定'}
          </div>
        </>
      )}
      <Handle type="source" position={Position.Bottom} className="!bg-purple-400" />
    </div>
  );
}
```

### 6.3 🆕 `packages/sop-editor/src/nodes/MaintenanceNode.tsx`

```tsx
/**
 * MaintenanceNode - 生成维护工单 / 推送企微通知
 * 输入：PredictNode 输出的健康分 / 告警信息
 * 输出：工单创建结果
 */
import { Handle, Position, type NodeProps } from '@xyflow/react';

export interface MaintenanceNodeData {
  priority?: 'low' | 'medium' | 'high' | 'critical';
  notifyChannel?: 'wecom' | 'dingtalk' | 'feishu' | 'email';
  assignee?: string;
  label?: string;
}

export function MaintenanceNode({ data }: NodeProps) {
  const d = data as MaintenanceNodeData;
  const priorityColors: Record<string, string> = {
    low: 'bg-green-50 border-green-300 text-green-700',
    medium: 'bg-yellow-50 border-yellow-300 text-yellow-700',
    high: 'bg-orange-50 border-orange-300 text-orange-700',
    critical: 'bg-red-50 border-red-300 text-red-700',
  };
  const cls = priorityColors[d.priority || 'medium'];

  return (
    <div className={`${cls} border-2 rounded-lg p-3 min-w-[160px] shadow-sm`}>
      <Handle type="target" position={Position.Top} />
      <div className="text-xs font-bold mb-1 flex items-center gap-1">
        🔧 维护工单
      </div>
      <div className="text-xs">
        优先级: {d.priority || 'medium'}
      </div>
      <div className="text-xs text-gray-500 mt-1">
        通知: {d.notifyChannel || 'wecom'}
      </div>
      <div className="text-xs text-gray-500">
        负责人: {d.assignee || '未指定'}
      </div>
      <Handle type="source" position={Position.Bottom} />
    </div>
  );
}
```

### 6.4 🆕 `packages/sop-editor/src/nodes/LogNode.tsx`

```tsx
/**
 * LogNode - 记录运维日志到 Supabase
 * 输入：任意上游节点输出
 * 输出：日志写入确认
 */
import { Handle, Position, type NodeProps } from '@xyflow/react';

export interface LogNodeData {
  level?: 'info' | 'warn' | 'error';
  message?: string;
  label?: string;
}

export function LogNode({ data }: NodeProps) {
  const d = data as LogNodeData;
  return (
    <div className="bg-gray-50 border-2 border-gray-300 rounded-lg p-3 min-w-[140px] shadow-sm">
      <Handle type="target" position={Position.Top} />
      <div className="text-xs font-bold text-gray-700 mb-1 flex items-center gap-1">
        📋 运维日志
      </div>
      <div className="text-xs text-gray-600">
        级别: {d.level || 'info'}
      </div>
      <div className="text-xs text-gray-500 mt-1 truncate max-w-[120px]">
        {d.message || '自动记录上游事件'}
      </div>
      <Handle type="source" position={Position.Bottom} />
    </div>
  );
}
```

### 6.5 🆕 `packages/sop-editor/src/nodes/index.ts` 扩展

```typescript
// 在现有 nodes/index.ts 中追加导出
export { ReadAlarmNode } from './ReadAlarmNode';
export { PredictNode } from './PredictNode';
export { MaintenanceNode } from './MaintenanceNode';
export { LogNode } from './LogNode';
```

### 6.6 🆕 `packages/sop-editor/src/sidebar/NodePalette.tsx` 扩展

在现有节点面板中追加工业节点分组：

```tsx
// 在 NodePalette.tsx 的节点列表中追加
const industrialNodes = [
  {
    type: 'readAlarm',
    label: '🚨 读报警码',
    component: ReadAlarmNode,
    defaultData: { robotId: '', condition: '任意报警' },
  },
  {
    type: 'predict',
    label: '🧠 AI 预测',
    component: PredictNode,
    defaultData: { target: 'both', apiEndpoint: '' },
  },
  {
    type: 'maintenance',
    label: '🔧 维护工单',
    component: MaintenanceNode,
    defaultData: { priority: 'medium', notifyChannel: 'wecom' },
  },
  {
    type: 'log',
    label: '📋 运维日志',
    component: LogNode,
    defaultData: { level: 'info' },
  },
];

// 在渲染时分组显示
<details open>
  <summary className="font-semibold text-sm text-gray-700 mb-2">⚙️ 工业运维节点</summary>
  <div className="space-y-2">
    {industrialNodes.map(node => (
      <div
        key={node.type}
        draggable
        onDragStart={(e) => onDragStart(e, node)}
        className="cursor-grab"
      >
        <node.component data={node.defaultData} />
      </div>
    ))}
  </div>
</details>
```

---

## 七、wsHub 消息分流改造

### 7.1 🔧 `apps/web-console/src/lib/wsHub.ts` 改造

在现有 `wsHub.ts` 的消息处理函数中扩展工业消息类型：

```typescript
// 在现有 import 基础上追加
import { adaptByBrandEnhanced } from '@robot-ops-solo/adapter-kit';

// ─── 现有消息类型 ───────────────────────────────
// type: 'state'   → robotStore.updateRobot
// type: 'alert'   → alertStore.addAlerts
// type: 'speak'   → speakStore + TTS

// ─── 🆕 工业消息类型 ───────────────────────────
// type: 'industrial_state'  → adaptByBrandEnhanced → robotStore
// type: 'industrial_alert'  → adaptByBrandEnhanced → alertStore

function handleMessage(msg: any) {
  switch (msg.type) {
    // ─── 现有分支保持不变 ─────────────────────
    case 'state': {
      robotStore.getState().updateRobot(msg.payload);
      break;
    }
    case 'alert': {
      alertStore.getState().addAlerts([msg.payload]);
      break;
    }
    case 'speak': {
      speakStore.getState().setSpeak(msg.payload);
      break;
    }

    // ─── 🆕 工业遥测 ─────────────────────────
    case 'industrial_state': {
      try {
        const { state, alerts } = adaptByBrandEnhanced(msg.brand, msg.payload);
        robotStore.getState().updateRobot(state);
        if (alerts.length > 0) {
          alertStore.getState().addAlerts(alerts);
        }
      } catch (err) {
        console.error('[wsHub] industrial_state adapt failed:', err);
      }
      break;
    }

    // ─── 🆕 工业告警（独立推送） ──────────────
    case 'industrial_alert': {
      try {
        const { alerts } = adaptByBrandEnhanced(msg.brand, msg.payload);
        if (alerts.length > 0) {
          alertStore.getState().addAlerts(alerts);
        }
      } catch (err) {
        console.error('[wsHub] industrial_alert adapt failed:', err);
      }
      break;
    }

    default:
      console.warn('[wsHub] Unknown message type:', msg.type);
  }
}
```

---

## 八、AI SaaS 对接

### 8.1 🆕 `apps/web-console/src/lib/aiSaaSApi.ts`

```typescript
/**
 * AI SaaS API 封装
 * 调用你另一个 AI SaaS 项目的接口
 * 输入：机器人遥测数据（IndustrialExtension）
 * 输出：中文告警摘要 + 排查建议 + 健康分
 */
import type { IndustrialExtension } from '@robot-ops-solo/adapter-kit';

const AI_SAAS_URL = import.meta.env.VITE_AI_SAAS_URL || 'http://localhost:8000';

export interface AIInsightResult {
  summary: string;          // 中文摘要
  suggestions: string[];    // 排查建议列表
  health_score: number;     // 0-100
  rul_days?: number;        // 剩余寿命预测
  confidence: number;       // 置信度 0-1
}

export async function fetchAIInsight(
  robotId: string,
  industrial: IndustrialExtension
): Promise<AIInsightResult> {
  const res = await fetch(`${AI_SAAS_URL}/api/analyze`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${localStorage.getItem('auth_token') || ''}`,
    },
    body: JSON.stringify({
      robot_id: robotId,
      telemetry: industrial,
      timestamp: new Date().toISOString(),
    }),
  });

  if (!res.ok) {
    throw new Error(`AI SaaS error: ${res.status} ${res.statusText}`);
  }

  return res.json();
}

/**
 * 自然语言查询：厂长问"3 号工位库卡为啥上午停机两次"
 */
export async function fetchAINaturalQuery(
  robotId: string,
  question: string,
  context?: IndustrialExtension
): Promise<{ answer: string; references: string[] }> {
  const res = await fetch(`${AI_SAAS_URL}/api/query`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${localStorage.getItem('auth_token') || ''}`,
    },
    body: JSON.stringify({
      robot_id: robotId,
      question,
      context: context || null,
    }),
  });

  if (!res.ok) {
    throw new Error(`AI SaaS query error: ${res.status}`);
  }

  return res.json();
}
```

### 8.2 🆕 `apps/web-console/src/components/overlays/AIInsightPanel.tsx`

```tsx
/**
 * AI 告警摘要面板
 * 嵌入 RobotsPage 侧边栏 / Dashboard 弹窗
 * 调用 AI SaaS → 显示中文摘要 + 建议
 */
import { useState, useEffect } from 'react';
import { fetchAIInsight, type AIInsightResult } from '../../lib/aiSaaSApi';
import type { IndustrialExtension } from '@robot-ops-solo/adapter-kit';

interface Props {
  robotId: string;
  industrial?: IndustrialExtension;
  className?: string;
}

export function AIInsightPanel({ robotId, industrial, className }: Props) {
  const [insight, setInsight] = useState<AIInsightResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!industrial) return;
    setLoading(true);
    setError('');
    fetchAIInsight(robotId, industrial)
      .then(setInsight)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [robotId, industrial]);

  if (!industrial) {
    return (
      <div className={`bg-gray-50 border border-gray-200 rounded-lg p-4 ${className || ''}`}>
        <div className="text-sm text-gray-400">🤖 AI 分析不可用（非工业机器人数��）</div>
      </div>
    );
  }

  return (
    <div className={`bg-gradient-to-br from-blue-50 to-purple-50 border border-blue-200 rounded-lg p-4 ${className || ''}`}>
      <div className="flex items-center gap-2 mb-2">
        <span className="text-lg">🧠</span>
        <h3 className="text-sm font-bold text-blue-700">AI 运维助手分析</h3>
        {loading && <span className="text-xs text-gray-400">分析中...</span>}
      </div>

      {error && (
        <div className="text-xs text-red-500 mb-2">⚠️ {error}</div>
      )}

      {insight && (
        <>
          <div className="text-sm text-gray-800 whitespace-pre-wrap mb-3">
            {insight.summary}
          </div>

          {insight.suggestions.length > 0 && (
            <div className="mb-3">
              <div className="text-xs font-semibold text-gray-600 mb-1">排查建议：</div>
              <ul className="text-xs text-gray-700 space-y-1">
                {insight.suggestions.map((s, i) => (
                  <li key={i} className="flex items-start gap-1">
                    <span className="text-blue-400">•</span>
                    <span>{s}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="flex gap-3 text-xs">
            <div className="bg-white rounded px-2 py-1 border">
              <span className="text-gray-500">健康分：</span>
              <span className={`font-bold ${insight.health_score < 60 ? 'text-red-500' : 'text-green-500'}`}>
                {insight.health_score}
              </span>
            </div>
            {insight.rul_days !== undefined && (
              <div className="bg-white rounded px-2 py-1 border">
                <span className="text-gray-500">剩余寿命：</span>
                <span className="font-bold text-orange-500">{insight.rul_days} 天</span>
              </div>
            )}
            <div className="bg-white rounded px-2 py-1 border">
              <span className="text-gray-500">置信度：</span>
              <span className="font-bold">{(insight.confidence * 100).toFixed(0)}%</span>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
```

---

## 九、Mock 数据扩展

### 9.1 🔧 `mock-ws-server.js` 扩展

在现有 mock-ws-server.js 末尾追加（**不删除现有商用机器人模拟**）：

```javascript
// ─═══════════════════════════════════════════════
// 🆕 工业机器人 Mock 数据
// ─═══════════════════════════════════════════════

function mockFanucTelemetry() {
  const now = new Date().toISOString();
  return {
    type: 'industrial_state',
    brand: 'fanuc',
    payload: {
      robot_id: 'FANUC_M20iD_001',
      model: 'M-20iD/25',
      timestamp: now,
      joints: [
        { j: 1, load_pct: 62, temp_c: 41, current_a: 3.1, speed_rpm: 120, health_score: 88 },
        { j: 2, load_pct: 118, temp_c: 67, current_a: 5.4, speed_rpm: 90, health_score: 54, rul_days: 9 },
        { j: 3, load_pct: 45, temp_c: 38, current_a: 2.1, speed_rpm: 150, health_score: 92 },
        { j: 4, load_pct: 30, temp_c: 35, current_a: 1.8, speed_rpm: 200, health_score: 95 },
        { j: 5, load_pct: 25, temp_c: 33, current_a: 1.2, speed_rpm: 180, health_score: 97 },
        { j: 6, load_pct: 18, temp_c: 31, current_a: 0.9, speed_rpm: 240, health_score: 99 },
      ],
      alarms: [{
        raw_code: 'SRVO-023',
        udm_code: 'OVER_TEMP_J2',
        severity: 'warn',
        zh_desc: '2轴伺服过热',
        occurred_at: now,
        cleared: false,
      }],
      runtime: {
        power_on_hours: 18432,
        operating_hours: 15200,
        cycle_count: 120321,
        last_maintenance_at: '2026-06-15T10:00:00+08:00',
        payload_kg: 12,
      },
    },
  };
}

function mockKukaTelemetry() {
  const now = new Date().toISOString();
  return {
    type: 'industrial_state',
    brand: 'kuka',
    payload: {
      robot_id: 'KUKA_KR6_001',
      model: 'KR 6 R900 sixx',
      timestamp: now,
      joints: [
        { j: 1, load_pct: 35, temp_c: 36, current_a: 2.0, speed_rpm: 100, health_score: 90 },
        { j: 2, load_pct: 55, temp_c: 42, current_a: 3.0, speed_rpm: 80, health_score: 82 },
        { j: 3, load_pct: 40, temp_c: 37, current_a: 2.2, speed_rpm: 110, health_score: 88 },
        { j: 4, load_pct: 22, temp_c: 32, current_a: 1.1, speed_rpm: 160, health_score: 95 },
        { j: 5, load_pct: 18, temp_c: 30, current_a: 0.8, speed_rpm: 200, health_score: 97 },
        { j: 6, load_pct: 12, temp_c: 28, current_a: 0.5, speed_rpm: 220, health_score: 99 },
      ],
      alarms: [],
      runtime: {
        power_on_hours: 12300,
        cycle_count: 85000,
        last_maintenance_at: '2026-07-01T10:00:00+08:00',
      },
    },
  };
}

function mockEstunTelemetry() {
  const now = new Date().toISOString();
  return {
    type: 'industrial_state',
    brand: 'estun',
    payload: {
      robot_id: 'ESTUN_ER3A_001',
      model: 'ER3A-C60',
      timestamp: now,
      joints: [
        { j: 1, load_pct: 28, temp_c: 34, current_a: 1.5, speed_rpm: 90, health_score: 93 },
        { j: 2, load_pct: 42, temp_c: 39, current_a: 2.3, speed_rpm: 75, health_score: 85 },
        { j: 3, load_pct: 35, temp_c: 36, current_a: 1.9, speed_rpm: 100, health_score: 90 },
        { j: 4, load_pct: 20, temp_c: 31, current_a: 0.9, speed_rpm: 140, health_score: 96 },
        { j: 5, load_pct: 15, temp_c: 29, current_a: 0.6, speed_rpm: 170, health_score: 98 },
        { j: 6, load_pct: 10, temp_c: 27, current_a: 0.4, speed_rpm: 200, health_score: 99 },
      ],
      alarms: [{
        raw_code: 'EST-3003',
        udm_code: 'OVER_TEMP',
        severity: 'warn',
        zh_desc: '驱动器过热',
        occurred_at: now,
        cleared: false,
      }],
      runtime: {
        power_on_hours: 5600,
        cycle_count: 42000,
      },
    },
  };
}

// ─── 广播循环 ──────────────────────────────────
const industrialMocks = [
  () => mockFanucTelemetry(),
  () => mockKukaTelemetry(),
  () => mockEstunTelemetry(),
];

// 在现有 wss.clients 广播循环中加入：
setInterval(() => {
  if (!wss.clients || wss.clients.size === 0) return;
  const msg = industrialMocks[Math.floor(Date.now() / 5000) % industrialMocks.length]();
  const data = JSON.stringify(msg);
  wss.clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(data);
    }
  });
}, 5000);  // 每 5 秒推送一台（轮流）
```

---

## 十、页面层改造

### 10.1 🔧 `apps/web-console/src/routes/RobotsPage.tsx` 改造

在现有 RobotsPage 中，对工业品牌隐藏控制按钮：

```tsx
// 在 RobotsPage.tsx 中找到操作面板渲染处，加 brand 判断
import { AIInsightPanel } from '../components/overlays/AIInsightPanel';

// 工业品牌列表（与 adapter-kit 保持一致）
const INDUSTRIAL_BRANDS = new Set(['FANUC', 'KUKA', 'ESTUN', 'YASKAWA']);

// 在渲染操作按钮处：
const isIndustrial = INDUSTRIAL_BRANDS.has(selectedRobot?.brand || '');

return (
  <div className="robots-page">
    {/* 现有机器人列表 */}
    <RobotList robots={robots} onSelect={setSelected} />

    {/* 3D 视图 */}
    <div className="robot-3d-view">
      {selectedRobot?.brand === 'FANUC' && (
        <Canvas>
          <FanucArm joints={selectedRobot.industrial?.joints || []} />
        </Canvas>
      )}
      {selectedRobot?.brand === 'KUKA' && (
        <Canvas>
          <KukaArm joints={selectedRobot.industrial?.joints || []} />
        </Canvas>
      )}
      {/* 商用机器人保持原有 3D 渲染 */}
      {!isIndustrial && selectedRobot && <PeanutBot />}
    </div>

    {/* 操作面板 */}
    <div className="control-panel">
      {!isIndustrial ? (
        // 商用机器人：显示所有控制按钮
        <>
          <button onClick={() => sendCommand(selectedRobot.id, 'start')}>启动</button>
          <button onClick={() => sendCommand(selectedRobot.id, 'stop')}>停止</button>
          <button onClick={() => sendCommand(selectedRobot.id, 'dock')}>回充</button>
          <button onClick={() => sendCommand(selectedRobot.id, 'reboot')}>重启</button>
        </>
      ) : (
        // 工业机器人：只读监控提示
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="text-sm font-semibold text-blue-700 mb-1">
            🔒 只读监控模式
          </div>
          <div className="text-xs text-gray-600">
            工业机器人采用只读接入，不下发控制指令。
            <br />
            协议：{selectedRobot?.industrial?.protocol || 'N/A'}
          </div>
        </div>
      )}
    </div>

    {/* 🆕 AI 洞察面板（仅工业品牌显示） */}
    {isIndustrial && selectedRobot?.industrial && (
      <AIInsightPanel
        robotId={selectedRobot.robotId}
        industrial={selectedRobot.industrial}
        className="mt-4"
      />
    )}
  </div>
);
```

### 10.2 🔧 `apps/web-console/src/routes/TwinPage.tsx` 改造

```tsx
// 在 TwinPage 中按 brand 加载对应 3D 模型
import { FanucArm } from '@robot-ops-solo/digital-twin';
import { KukaArm } from '@robot-ops-solo/digital-twin';

// 在 RobotViewer 渲染处加分支：
function renderRobotModel(robot: any) {
  switch (robot?.brand) {
    case 'FANUC':
      return <FanucArm joints={robot.industrial?.joints || []} scale={1.5} />;
    case 'KUKA':
      return <KukaArm joints={robot.industrial?.joints || []} scale={1.5} />;
    case 'ESTUN':
      // 暂用 KukaArm 替代，后续加 EstunArm
      return <KukaArm joints={robot.industrial?.joints || []} scale={1.2} />;
    case 'YASKAWA':
      return <FanucArm joints={robot.industrial?.joints || []} scale={1.3} />;
    default:
      // 商用机器人走原有逻辑
      return <G1Dog />;
  }
}
```

### 10.3 🔧 `apps/web-console/src/routes/AlertsPage.tsx` 扩展

```tsx
// 在告警卡片渲染处，工业告警显示 raw_code + zh_desc
function renderAlertCard(alert: any) {
  const isIndustrial = alert.id?.includes('-SRVO-') ||
                       alert.id?.includes('-KSS') ||
                       alert.id?.includes('-EST-');

  return (
    <div className={`alert-card severity-${alert.level}`}>
      {isIndustrial ? (
        <>
          <span className="alert-raw-code">{alert.message.split(']')[0]}]</span>
          <span className="alert-desc">{alert.message.split('] ')[1]}</span>
        </>
      ) : (
        <span>{alert.message}</span>
      )}
      <button onClick={() => clearAlert(alert.id)}>✕</button>
    </div>
  );
}
```

---

## 十一、Python 边缘驱动（现场交付用）

> **开发阶段不需要安装 Python**。以下文件只在现场接真机时使用，部署在边缘网关盒子（研华/树莓派）上。

### 11.1 🆕 `python-edge/fanuc_focas/config.yaml`

```yaml
brand: FANUC
model: M-20iD/25
host: 192.168.1.100
port: 8193
protocol: FOCAS
sample_interval_sec: 5

# R 寄存器映射（KAREL 桥接：机器人侧把温度/负载写进这些 R）
r_map:
  j1_temp: 100
  j2_temp: 101
  j3_temp: 102
  j4_temp: 103
  j5_temp: 104
  j6_temp: 105
  j1_load: 110
  j2_load: 111
  j3_load: 112
  j4_load: 113
  j5_load: 114
  j6_load: 115

# 报警码字典
alarm_dict:
  SRVO-023: { udm_code: OVER_TEMP_J2, severity: warn, zh_desc: "2轴伺服过热" }
  SRVO-050: { udm_code: BREAKER_OPEN, severity: error, zh_desc: "伺服断开" }
  SRVO-062: { udm_code: HTAL_ALARM, severity: critical, zh_desc: "硬件过热报警" }
  SRVO-075: { udm_code: PULSE_MISMATCH, severity: error, zh_desc: "脉冲不匹配" }

# MQTT 输出
mqtt:
  host: localhost
  port: 1883
  topic: industrial/robot/fanuc/telemetry
  alert_topic: industrial/robot/fanuc/alert
```

### 11.2 🆕 `python-edge/fanuc_focas/focas_client.py`

```python
"""
FANUC FOCAS 客户端最小封装
依赖：ctypes + fwlib32.dll（Windows）或 libfwlib32.so（Linux x86）
备选：fanucpy（高层 API，用于建连/运动）
"""
import ctypes
import time
from typing import Optional

class FocasClient:
    """FANUC FOCAS1/2 以太网客户端"""

    def __init__(self, host: str, port: int = 8193, timeout: int = 10):
        self.host = host
        self.port = port
        self.timeout = timeout
        self._h = ctypes.c_ushort(0)
        self._fw = ctypes.CDLL("fwlib32.dll")  # Linux: "libfwlib32.so"
        self.connected = False

    def connect(self) -> bool:
        """建立 FOCAS 连接"""
        ret = self._fw.cnc_allclibhndl3(
            ctypes.c_char_p(self.host.encode()),
            ctypes.c_ushort(self.port),
            ctypes.c_ushort(self.timeout),
            ctypes.byref(self._h),
        )
        self.connected = (ret == 0)
        return self.connected

    def disconnect(self):
        """断开连接"""
        if self._h.value:
            self._fw.cnc_freelibhndl(self._h)
            self._h.value = 0
            self.connected = False

    def read_r_register(self, reg: int) -> Optional[float]:
        """读 R 寄存器（KAREL 桥接的温度/负载）"""
        # 使用 cnc_rdparam 或 cnc_rdpmcrng
        # 简化：返回模拟值（实际对接 fanucpy 的 read_register）
        try:
            import fanucpy
            # fanucpy 高层 API
            return float(reg * 1.5 + time.time() % 10)
        except ImportError:
            return None

    def read_alarms(self) -> list:
        """读当前报警列表（cnc_rdalarm / cnc_alarm2）"""
        # 实际实现需按 FOCAS 版本选 API
        return []  # 占位

    def __enter__(self):
        self.connect()
        return self

    def __exit__(self, *args):
        self.disconnect()
```

### 11.3 🆕 `python-edge/fanuc_focas/parser.py`

```python
"""
FANUC 原始数据 → UDM JSON（与 TypeScript adapter-fanuc.ts 对齐）
输出格式和 mock-ws-server.js 的 mockFanucTelemetry() 一致
"""
import yaml
from datetime import datetime, timezone, timedelta

class FanucParser:
    def __init__(self, config_path: str):
        with open(config_path) as f:
            self.cfg = yaml.safe_load(f)
        self.r_map = self.cfg.get('r_map', {})
        self.alarm_dict = self.cfg.get('alarm_dict', {})

    def parse(self, raw_r_values: dict, raw_alarms: list) -> dict:
        """raw_r_values: {100: 67.0, 110: 118.0, ...}"""
        tz_cn = timezone(timedelta(hours=8))
        now = datetime.now(tz_cn).isoformat()

        # 解析关节数据
        joints = []
        for j in range(1, 7):
            temp_key = f"j{j}_temp"
            load_key = f"j{j}_load"
            temp_reg = self.r_map.get(temp_key, 0)
            load_reg = self.r_map.get(load_key, 0)
            joints.append({
                "j": j,
                "load_pct": raw_r_values.get(load_reg, 0),
                "temp_c": raw_r_values.get(temp_reg, 0),
                "current_a": 0,  # 需 KAREL 额外映射
                "speed_rpm": 0,
                "health_score": 100,
            })

        # 解析告警
        alarms = []
        for code in raw_alarms:
            a = self.alarm_dict.get(code, {})
            alarms.append({
                "raw_code": code,
                "udm_code": a.get("udm_code", "UNKNOWN"),
                "severity": a.get("severity", "warn"),
                "zh_desc": a.get("zh_desc", ""),
                "occurred_at": now,
                "cleared": False,
            })

        return {
            "robot_id": f"{self.cfg['brand']}_{self.cfg['model'].replace('/', '_')}_001",
            "model": self.cfg['model'],
            "timestamp": now,
            "joints": joints,
            "alarms": alarms,
            "runtime": {
                "power_on_hours": 0,  # 需从 FOCAS 读取
                "cycle_count": 0,
            },
        }
```

### 11.4 🆕 `python-edge/edge-poller.py`

```python
"""
边缘主轮询器
遍历所有品牌配置 → 拉数据 → 转 UDM → 发 MQTT
"""
import json
import time
import yaml
import paho.mqtt.client as mqtt
from pathlib import Path

# 导入各品牌客户端
from fanuc_focas.focas_client import FocasClient
from fanuc_focas.parser import FanucParser
# from kuka_opcua.opcua_client import KukaClient
# from kuka_opcua.parser import KukaParser

def load_all_configs(config_dir: str):
    """扫描所有品牌的 config.yaml"""
    configs = []
    for cfg_path in Path(config_dir).glob("*/config.yaml"):
        cfg = yaml.safe_load(cfg_path.read_text())
        cfg['_path'] = str(cfg_path)
        configs.append(cfg)
    return configs

def main():
    # 加载配置
    configs = load_all_configs(".")

    # 初始化 MQTT
    mqtt_client = mqtt.Client()
    mqtt_client.connect("localhost", 1883, 60)
    mqtt_client.loop_start()

    # 初始化各品牌客户端
    clients = []
    for cfg in configs:
        brand = cfg['brand'].lower()
        if brand == 'fanuc':
            fc = FocasClient(cfg['host'], cfg['port'])
            parser = FanucParser(cfg['_path'])
            if fc.connect():
                clients.append(('fanuc', fc, parser, cfg))

    try:
        while True:
            for brand, client, parser, cfg in clients:
                try:
                    # 读 R 寄存器
                    r_values = {}
                    for reg in parser.r_map.values():
                        val = client.read_r_register(reg)
                        if val is not None:
                            r_values[reg] = val

                    # 读告警
                    alarms = client.read_alarms()

                    # 转 UDM
                    udm = parser.parse(r_values, alarms)

                    # 发 MQTT
                    topic = cfg.get('mqtt', {}).get('topic', f'industrial/robot/{brand}/telemetry')
                    mqtt_client.publish(topic, json.dumps({
                        'type': 'industrial_state',
                        'brand': brand,
                        'payload': udm,
                    }))

                    print(f"[{brand}] published at {udm['timestamp']}")

                except Exception as e:
                    print(f"[{brand}] error: {e}")
                    client.disconnect()
                    time.sleep(5)
                    client.connect()

            time.sleep(5)  # 采样间隔

    except KeyboardInterrupt:
        print("Shutting down...")
    finally:
        for _, client, _, _ in clients:
            client.disconnect()
        mqtt_client.loop_stop()
        mqtt_client.disconnect()

if __name__ == "__main__":
    main()
```

### 11.5 🆕 `python-edge/requirements.txt`

```
paho-mqtt>=1.6.1
pyyaml>=6.0
fanucpy>=0.1.3
# opcua>=0.98        # KUKA OPC UA（按需安装）
# pymodbus>=3.6.0    # 埃斯顿 Modbus（按需安装）
```

---

## 十二、开发顺序与验证

| 周次 | 任务 | 产出 | 验证方式 |
|------|------|------|---------|
| **W1** | 创建 `types/industrial.ts` + 扩展 `unified.ts` | 工业类型定义完成 | `pnpm --filter adapter-kit test` 编译通过 |
| **W1** | 创建 `adapters/industrial/_registry.ts` | 注册表框架 | import 不报错 |
| **W1** | 实现 `adapter-fanuc.ts` | FANUC 适配器 | 单元测试通过 |
| **W1** | 扩展 `mock-ws-server.js`（加 `mockFanucTelemetry`） | Mock 数据 | 浏览器 WS 收到工业帧 |
| **W2** | 实现 `adapter-kuka.ts` + `adapter-estun.ts` | KUKA + 埃斯顿适配器 | 单元测试通过 |
| **W2** | 改造 `wsHub.ts`（加 `industrial_state` 分支） | 消息分流 | Dashboard 显示 FANUC 告警卡片 |
| **W2** | 改造 `RobotsPage.tsx`（brand 判断 + AIInsightPanel） | 页面可用 | 选 FANUC 显示只读提示 + AI 面板 |
| **W3** | 创建 `FanucArm.tsx` + `KukaArm.tsx` | 3D 模型 | `/twin` 页面显示橙色 6 轴连杆 |
| **W3** | 改造 `TwinPage.tsx`（按 brand 加载模型） | 3D 分支 | FANUC/KUKA 各显示对应模型 |
| **W3** | 创建 SOP 节点（ReadAlarm/Predict/Maintenance/Log） | 4 个新节点 | `/sop` 画布能拖出工业节点 |
| **W4** | 创建 `AIInsightPanel.tsx` + `aiSaaSApi.ts` | AI 对接层 | 面板显示 mock AI 摘要 |
| **W4** | 改造 `AlertsPage.tsx`（工业告警格式） | 告警增强 | 告警中心显示 raw_code + 中文 |
| **W5** | 创建 `python-edge/` 全部文件 | Python 驱动 | 边缘盒跑通 FANUC 数据采集 |
| **W5** | Python → MQTT → mqtt-client.ts → wsHub → React | 真机数据管道 | 真机数据实时刷新页面 |

---

## 十三、关键原则

### 13.1 商用不动
所有工业扩展使用 `industrial?` 可选字段。现有 `adapter-unitree.ts` / `adapter-keenon.ts` 等**零修改**，现有商用机器人页面功能**零破坏**。

### 13.2 只读优先
工业适配器只解析遥测，不生成控制指令。这是安全底线 + 合规底线 + 一人公司风险控制的生命线。

### 13.3 Mock 先行
开发阶段全用 `mock-ws-server.js`，不需要安装 Python、不需要真机、不需要 MQTT broker。Python 驱动是"现场交付工具"，不是开发依赖。

### 13.4 品牌工厂统一入口
`adaptByBrandEnhanced()` 是唯一分发点。页面层、wsHub、SOP 引擎都不关心数据来源是 FANUC 还是 KUKA——它们只认 `UnifiedRobotState`。

### 13.5 新增品牌的标准流程
1. 在 `adapters/industrial/` 创建 `adapter-xxx.ts`（复制 `adapter-fanuc.ts` 改）
2. 在 `_registry.ts` 的 `registry` 对象加一行 `'xxx': adaptXxx`
3. 在 `INDUSTRIAL_BRANDS` Set 加 `'xxx'`
4. 在 `mock-ws-server.js` 加 `mockXxxTelemetry()`
5. （可选）在 `digital-twin/src/robots/` 加 `XxxArm.tsx`

**5 步完成，页面层零改动。**

---

## 附录 A：环境变量补充

```bash
# apps/web-console/.env 追加
VITE_AI_SAAS_URL=          # AI SaaS 项目地址（留空走 mock）
VITE_MQTT_BROKER_URL=      # MQTT broker 地址（留空走 WebSocket mock）
VITE_DEFAULT_INDUSTRIAL_BRAND=fanuc  # 默认工业品牌（开发用）
```

## 附录 B：package.json scripts 补充

```json
{
  "scripts": {
    "dev:industrial": "node mock-ws-server.js & pnpm --filter web-console dev",
    "test:adapter-kit": "pnpm --filter adapter-kit test",
    "build:all": "pnpm -r build"
  }
}
```

## 附录 C：测试文件模板

### 🆕 `packages/adapter-kit/__tests__/adapter-fanuc.test.ts`

```typescript
import { describe, it, expect } from 'vitest';
import { adaptFanuc } from '../src/adapters/industrial/adapter-fanuc';

describe('adaptFanuc', () => {
  const mockRaw = {
    robot_id: 'FANUC_M20iD_001',
    model: 'M-20iD/25',
    timestamp: '2026-08-18T09:26:00+08:00',
    joints: [
      { j: 1, load_pct: 62, temp_c: 41, current_a: 3.1, health_score: 88 },
      { j: 2, load_pct: 118, temp_c: 67, current_a: 5.4, health_score: 54, rul_days: 9 },
    ],
    alarms: [{
      raw_code: 'SRVO-023',
      udm_code: 'OVER_TEMP_J2',
      severity: 'warn',
      zh_desc: '2轴伺服过热',
      occurred_at: '2026-08-18T09:24:10+08:00',
      cleared: false,
    }],
    runtime: { power_on_hours: 18432, cycle_count: 120321 },
  };

  it('should return valid UnifiedRobotState', () => {
    const { state, alerts } = adaptFanuc(mockRaw);
    expect(state.robotId).toBe('FANUC_M20iD_001');
    expect(state.brand).toBe('FANUC');
    expect(state.online).toBe(true);
    expect(state.industrial).toBeDefined();
    expect(state.industrial!.joints).toHaveLength(2);
    expect(state.industrial!.protocol).toBe('FOCAS');
  });

  it('should convert alarms to UnifiedAlert[]', () => {
    const { alerts } = adaptFanuc(mockRaw);
    expect(alerts).toHaveLength(1);
    expect(alerts[0].level).toBe('warn');
    expect(alerts[0].message).toContain('SRVO-023');
    expect(alerts[0].message).toContain('2轴伺服过热');
  });

  it('should handle missing joints gracefully', () => {
    const { state } = adaptFanuc({ ...mockRaw, joints: undefined });
    expect(state.industrial!.joints).toHaveLength(0);
  });

  it('should handle missing alarms gracefully', () => {
    const { alerts } = adaptFanuc({ ...mockRaw, alarms: undefined });
    expect(alerts).toHaveLength(0);
  });
});
```

### 🆕 `packages/adapter-kit/__tests__/adapter-kuka.test.ts`

```typescript
import { describe, it, expect } from 'vitest';
import { adaptKuka } from '../src/adapters/industrial/adapter-kuka';

describe('adaptKuka', () => {
  const mockRaw = {
    robot_id: 'KUKA_KR6_001',
    model: 'KR 6 R900 sixx',
    timestamp: '2026-08-18T10:00:00+08:00',
    joints: [
      { j: 1, load_pct: 35, temp_c: 36, current_a: 2.0, health_score: 90 },
    ],
    alarms: [{
      raw_code: 'KSS15002',
      severity: 'error',
      zh_desc: '驱动器故障',
      occurred_at: '2026-08-18T09:58:00+08:00',
      cleared: false,
    }],
    runtime: { power_on_hours: 12300, cycle_count: 85000 },
  };

  it('should map KUKA alarm codes to UDM', () => {
    const { alerts } = adaptKuka(mockRaw);
    expect(alerts[0].message).toContain('KSS15002');
    expect(alerts[0].message).toContain('驱动器故障');
    expect(alerts[0].level).toBe('error');
  });

  it('should set protocol to OPC_UA', () => {
    const { state } = adaptKuka(mockRaw);
    expect(state.industrial!.protocol).toBe('OPC_UA');
  });
});
```

### 🆕 `packages/adapter-kit/__tests__/adapter-estun.test.ts`

```typescript
import { describe, it, expect } from 'vitest';
import { adaptEstun } from '../src/adapters/industrial/adapter-estun';

describe('adaptEstun', () => {
  const mockRaw = {
    robot_id: 'ESTUN_ER3A_001',
    model: 'ER3A-C60',
    timestamp: '2026-08-18T11:00:00+08:00',
    joints: [
      { j: 1, load_pct: 28, temp_c: 34, health_score: 93 },
    ],
    alarms: [{
      raw_code: 'EST-3003',
      severity: 'warn',
      zh_desc: '驱动器过热',
      occurred_at: '2026-08-18T10:55:00+08:00',
      cleared: false,
    }],
    runtime: { power_on_hours: 5600, cycle_count: 42000 },
  };

  it('should map ESTUN alarm codes to UDM', () => {
    const { alerts } = adaptEstun(mockRaw);
    expect(alerts[0].message).toContain('EST-3003');
    expect(alerts[0].message).toContain('驱动器过热');
  });

  it('should set protocol to MODBUS_TCP', () => {
    const { state } = adaptEstun(mockRaw);
    expect(state.industrial!.protocol).toBe('MODBUS_TCP');
  });

  it('should handle unknown alarm codes', () => {
    const raw = {
      ...mockRaw,
      alarms: [{ raw_code: 'EST-9999', severity: 'warn', zh_desc: '', occurred_at: '2026-08-18T11:00:00+08:00', cleared: false }],
    };
    const { alerts } = adaptEstun(raw);
    expect(alerts[0].message).toContain('UNKNOWN');
  });
});
```

---

> **文档结束**。按此文档逐文件生成代码，即可完成 Robot-Ops-Solo 工业机器人模块的完整开发。
