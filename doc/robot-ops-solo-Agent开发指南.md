# Robot-Ops-Solo · AI 运维 Agent 开发指南

> 版本：v1.0 ｜ 2026-08-｜适用范围：robot-ops-solo 跨品牌工业机器人中台
> 目标：把一个"会看数据、会分析告警、会生成 SOP、会回答厂长提问"的 AI Agent，嵌入现有 adapter-kit + UDM + SOP 引擎体系，同时守住**软著去 AI 化**与**增值电信合规**两条红线。

---

## 一、为什么需要一个 Agent（而不是再写一个脚本）

你现在已经有的能力：

- adapter-kit：把 FANUC/KUKA/埃斯顿/安川/UR 数据归一成 UDM
- robotStore：多机器人状态管理（按 robot_id 区分）
- SOP 引擎：告警 → 标准作业程序 → 步骤执行
- Dashboard：品牌差异化展示 + 健康分 + 趋势图

缺的是**"数据→洞察→行动"的最后一公里**：

| 场景 | 现在 | 有 Agent 后 |
|------|------|------------|
| 机器人报 `SRVO-023` | 告警卡片标黄 | Agent 自动解释"2 轴伺服过热"，给 3 条可能原因 + 关联历史同类告警 |
| 厂长问"哪台机器人最该保养" | 人工翻卡片 | Agent 按健康分+RUL 排序，生成一份《本周保养优先级清单》 |
| 新告警涌入 | 按时间罗列 | Agent 聚类去重（同一根因只报一次），推送给对应责任人 |
| 工程师修完一台 | 手动填记录 | Agent 根据步骤完成状态自动生成《维修报告》草稿 |
| BP/路演 | 静态截图 | 现场演示："帮我看一下 FANUC 这台最近 24 小时的健康趋势" → Agent 即时回答 |

**Agent = 你产品的"AI 解释层 + 自然语言入口 + 自动化动作执行器"。**

---

## 二、Agent 定位与边界（先定死，避免做成"万能聊天框"）

### 2.1 它是什么

- 一个**领域 Agent**：只懂"工业机器人运维 + 你这套 UDM/SOP 体系"，不回答无关问题
- 一个**工具调用 Agent**：通过你定义的 Tool（查数据/查 SOP/生成报告）完成任务，不是纯 LLM 自由发挥
- 一个**只读优先 Agent**：默认只查询、分析、生成建议；下发控制指令需人工确认（安全红线）

### 2.2 它不是什么

- ❌ 不是"机器人控制器 AI"（不下发运动指令、不改机器人程序）
- ❌ 不是"通用 ChatGPT 套壳"（不回答"今天天气/写情书"）
- ❌ 不是"自动修机器人"（只生成 SOP 建议，执行由人点确认）

### 2.3 一句话定位（写进 BP/路演）

> "Robot-Ops Agent 是工厂设备科的 AI 运维助手：能看懂跨品牌机器人数据、解释告警原因、按你厂 SOP 生成处理步骤、回答'哪台最该保养'这类自然语言问题——它只读不改，建议都需人工确认。"

---

## 三、Agent 总体架构

### 3.1 四层结构

```
┌──────────────────────────────────────────────────────────────┐
│  Layer 4 · 交互层（自然语言入口）                            │
│  - ChatPanel 组件（Dashboard 右侧悬浮）                      │
│  - 语音输入（可选，厂长老厂长用）                           │
│  - 输出：结构化建议 + 引用数据来源                          │
└──────────────────────────────────────────────────────────────┘
                          ↓ 用户提问
┌──────────────────────────────────────────────────────────────┐
│  Layer 3 · Agent 编排层（Orchestrator）                     │
│  - 意图识别（查数据 / 问告警 / 要报告 / 闲聊拦截）          │
│  - 工具路由（选哪个 Tool）                                   │
│  - 多轮上下文管理（按 robot_id 隔离会话）                   │
│  - LLM：Claude / GPT / 国产大模型（园区网关调用可抵扣 30%） │
└──────────────────────────────────────────────────────────────┘
                          ↓ 调用 Tool
┌──────────────────────────────────────────────────────────────┐
│  Layer 2 · 工具层（Tools，Agent 的"手"）                    │
│  - queryRobotState(robot_id)                                 │
│  - queryAlarms(robot_id, severity)                           │
│  - queryHealthScore(robot_id)                                │
│  - matchSOP(alarm_code, brand)                               │
│  - generateReport(type, robot_id)                            │
│  - pushNotification(user, message)                           │
└──────────────────────────────────────────────────────────────┘
                          ↓ 读/写
┌──────────────────────────────────────────────────────────────┐
│  Layer 1 · 数据层（你已有的基础设施）                        │
│  - adapter-kit（UDM）                                       │
│  - robotStore（Zustand）                                    │
│  - MQTT broker（mosquitto）                                  │
│  - SOP 引擎 + 告警流                                        │
└──────────────────────────────────────────────────────────────┘
```

### 3.2 关键技术选型（一人公司友好）

| 组件 | 推荐 | 理由 |
|------|------|------|
| Agent 框架 | **OpenAI Function Calling / Anthropic Tool Use**（原生，不引重框架） | 一个文件搞定，不绑 LangChain 等重依赖 |
| LLM | Claude Sonnet / GPT-5 mini | 工具调用能力强、token 便宜 |
| 国产备选 | 通义千问 / DeepSeek（通过园区网关） | 抵扣 30% 调用补贴 |
| 会话状态 | Zustand `agentStore` | 和你 robotStore 同态 |
| 工具执行 | 纯 TS 函数 + `toolDefinitions` 声明 | 类型安全、易调试 |
| 持久化 | LocalStorage（Demo）/ SQLite（POC） | 一人公司够用，不上向量库也能跑 |

---

## 四、Agent 核心能力设计（6 个 Tool）

### Tool 1 · `queryRobotState` —— 查机器人当前状态

```typescript
// packages/agent-kit/src/tools/queryRobotState.ts
import { useRobotStore } from '@robot-ops-solo/adapter-kit/store/robotStore';

export const queryRobotStateTool = {
  name: 'queryRobotState',
  description: '查询指定机器人的当前运行状态（健康分/关节数据/运行时间/告警数）',
  parameters: {
    type: 'object',
    properties: {
      robot_id: { type: 'string', description: '机器人 ID，如 FANUC_M20iD_001' },
    },
    required: ['robot_id'],
  },
  handler: ({ robot_id }: { robot_id: string }) => {
    const state = useRobotStore.getState().robots.get(robot_id);
    if (!state) return { error: `未找到机器人 ${robot_id}` };
    return {
      robot_id: state.robotId,
      brand: state.brand,
      health_score: state.industrial?.joints.reduce((a, j) => a + (j.health_score ?? 100), 0) / (state.industrial?.joints.length || 1),
      joint_count: state.industrial?.joints.length ?? 0,
      alarm_count: state.industrial?.alarms.filter(a => !a.cleared).length ?? 0,
      runtime_hours: state.industrial?.runtime.power_on_hours ?? 0,
    };
  },
};
```

### Tool 2 · `queryAlarms` —— 查告警并聚类

```typescript
// packages/agent-kit/src/tools/queryAlarms.ts
export const queryAlarmsTool = {
  name: 'queryAlarms',
  description: '查询机器人告警列表，可按严重等级过滤；返回时按 udm_code 聚类去重',
  parameters: {
    type: 'object',
    properties: {
      robot_id: { type: 'string' },
      severity: { type: 'string', enum: ['info', 'warn', 'error', 'critical'] },
    },
    required: ['robot_id'],
  },
  handler: ({ robot_id, severity }: { robot_id: string; severity?: string }) => {
    const state = useRobotStore.getState().robots.get(robot_id);
    const alarms = state?.industrial?.alarms ?? [];
    const filtered = severity ? alarms.filter(a => a.severity === severity) : alarms;
    // 按 udm_code 聚类
    const groups = new Map<string, number>();
    filtered.forEach(a => groups.set(a.udm_code, (groups.get(a.udm_code) ?? 0) + 1));
    return {
      total: filtered.length,
      clustered: Array.from(groups.entries()).map(([code, count]) => ({
        udm_code: code,
        count,
        sample: filtered.find(a => a.udm_code === code),
      })),
    };
  },
};
```

### Tool 3 · `matchSOP` —— 告警码匹配 SOP 模板

```typescript
// packages/agent-kit/src/tools/matchSOP.ts
import { sopRegistry } from '../../../sop-engine/src/registry';

export const matchSOPTool = {
  name: 'matchSOP',
  description: '根据告警码/品牌匹配对应的 SOP 标准作业程序模板',
  parameters: {
    type: 'object',
    properties: {
      alarm_code: { type: 'string', description: 'UDM 统一告警码，如 OVER_TEMP_J2' },
      brand: { type: 'string', description: '机器人品牌，如 FANUC' },
    },
    required: ['alarm_code'],
  },
  handler: ({ alarm_code, brand }: { alarm_code: string; brand?: string }) => {
    const sop = sopRegistry.find(a => a.udm_code === alarm_code && (!brand || a.brand === brand));
    if (!sop) return { found: false, message: `暂无 ${alarm_code} 的 SOP 模板，建议人工编写` };
    return { found: true, sop_id: sop.id, title: sop.title, steps: sop.steps };
  },
};
```

### Tool 4 · `queryHealthScore` —— 健康分趋势（近 N 点）

```typescript
// packages/agent-kit/src/tools/queryHealthScore.ts
export const queryHealthScoreTool = {
  name: 'queryHealthScore',
  description: '查询机器人整体健康分及关节级健康分，用于"哪台最该保养"排序',
  parameters: {
    type: 'object',
    properties: {
      robot_id: { type: 'string' },
      top_n: { type: 'number', description: '返回健康分最低的 N 个关节', default: 3 },
    },
    required: ['robot_id'],
  },
  handler: ({ robot_id, top_n = 3 }: { robot_id: string; top_n?: number }) => {
    const state = useRobotStore.getState().robots.get(robot_id);
    const joints = state?.industrial?.joints ?? [];
    const ranked = [...joints].sort((a, b) => (a.health_score ?? 100) - (b.health_score ?? 100)).slice(0, top_n);
    return { robot_id, worst_joints: ranked };
  },
};
```

### Tool 5 · `generateReport` —— 生成保养/维修报告

```typescript
// packages/agent-kit/src/tools/generateReport.ts
export const generateReportTool = {
  name: 'generateReport',
  description: '生成《机器人健康/维修报告》Markdown 草稿（供人工确认后发出）',
  parameters: {
    type: 'object',
    properties: {
      type: { type: 'string', enum: ['health', 'repair', 'maintenance'] },
      robot_id: { type: 'string' },
    },
    required: ['type', 'robot_id'],
  },
  handler: ({ type, robot_id }: { type: string; robot_id: string }) => {
    const state = useRobotStore.getState().robots.get(robot_id);
    const md = [
      `# ${type === 'health' ? '健康报告' : type === 'repair' ? '维修报告' : '保养报告'} · ${robot_id}`,
      `> 生成时间：${new Date().toISOString()}`,
      '',
      `- 品牌型号：${state?.brand} ${state?.model ?? ''}`,
      `- 累计运行：${state?.industrial?.runtime.power_on_hours ?? 0} 小时`,
      `- 当前告警：${state?.industrial?.alarms.filter(a => !a.cleared).length ?? 0} 条`,
      '',
      '## 建议',
      '- （由 Agent 结合告警与健康分生成，需人工确认后执行）',
    ].join('\n');
    return { markdown: md, status: 'draft' };
  },
};
```

### Tool 6 · `pushNotification` —— 推送建议给责任人

```typescript
// packages/agent-kit/src/tools/pushNotification.ts
export const pushNotificationTool = {
  name: 'pushNotification',
  description: '将 Agent 建议推送给指定责任人（企微/钉钉/站内信，需配置通道）',
  parameters: {
    type: 'object',
    properties: {
      user: { type: 'string', description: '责任人标识' },
      message: { type: 'string' },
    },
    required: ['user', 'message'],
  },
  handler: ({ user, message }: { user: string; message: string }) => {
    // 实际接入企微/钉钉机器人 webhook（见第九节）
    console.log(`[Agent Notify] → ${user}: ${message}`);
    return { pushed: true, channel: 'console(demo)' };
  },
};
```

---

## 五、Agent 编排器（Orchestrator）

### 5.1 Tool 定义注册表

```typescript
// packages/agent-kit/src/orchestrator.ts
import { queryRobotStateTool } from './tools/queryRobotState';
import { queryAlarmsTool } from './tools/queryAlarms';
import { matchSOPTool } from './tools/matchSOP';
import { queryHealthScoreTool } from './tools/queryHealthScore';
import { generateReportTool } from './tools/generateReport';
import { pushNotificationTool } from './tools/pushNotification';

export const toolRegistry = [
  queryRobotStateTool,
  queryAlarmsTool,
  matchSOPTool,
  queryHealthScoreTool,
  generateReportTool,
  pushNotificationTool,
];

export function getToolDefinitions() {
  return toolRegistry.map(t => ({
    type: 'function',
    function: {
      name: t.name,
      description: t.description,
      parameters: t.parameters,
    },
  }));
}
```

### 5.2 调用 LLM（以 Anthropic 为例，OpenAI 同构）

```typescript
// packages/agent-kit/src/agent.ts
import Anthropic from '@anthropic-ai/sdk';
import { toolRegistry, getToolDefinitions } from './orchestrator';

const client = new Anthropic({ apiKey: import.meta.env.VITE_ANTHROPIC_API_KEY });

export async function runAgent(userMessage: string, robotIdHint?: string) {
  const systemPrompt = `你是 Robot-Ops-Solo 工厂运维助手。
- 只回答工业机器人运维相关问题，无关问题礼貌拒绝。
- 调用工具获取数据，不要编造机器人状态。
- 所有"执行/修改/下发"类建议需标注"需人工确认"。
- 回答简洁，引用数据时标注来源（robot_id + 字段）。`;

  const messages = [{ role: 'user' as const, content: userMessage }];
  const tools = getToolDefinitions();

  let response = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 1024,
    system: systemPrompt,
    messages,
    tools,
  });

  // 处理 tool_use 循环（LLM 可能连续调用多个工具）
  while (response.stop_reason === 'tool_use') {
    const toolResults: any[] = [];
    for (const block of response.content) {
      if (block.type === 'tool_use') {
        const tool = toolRegistry.find(t => t.name === block.name);
        const result = tool ? await tool.handler(block.input as any) : { error: 'tool not found' };
        toolResults.push({ type: 'tool_result', tool_use_id: block.id, content: JSON.stringify(result) });
      }
    }
    response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      system: systemPrompt,
      messages: [...messages, { role: 'assistant' as const, content: response.content }, { role: 'user' as const, content: toolResults }],
      tools,
    });
  }

  const textBlock = response.content.find(b => b.type === 'text');
  return textBlock?.text ?? '';
}
```

### 5.3 前端入口（ChatPanel 组件）

```tsx
// apps/web-console/src/components/ChatPanel.tsx
import { useState } from 'react';
import { runAgent } from '@robot-ops-solo/agent-kit/agent';

export function ChatPanel({ robotId }: { robotId?: string }) {
  const [input, setInput] = useState('');
  const [reply, setReply] = useState('');
  const [loading, setLoading] = useState(false);

  const send = async () => {
    if (!input.trim()) return;
    setLoading(true);
    const hint = robotId ? `（当前机器人：${robotId}）` : '';
    const text = await runAgent(input + hint);
    setReply(text);
    setInput('');
    setLoading(false);
  };

  return (
    <div className="fixed bottom-4 right-4 w-96 bg-white/90 backdrop-blur rounded-xl shadow-2xl border border-gray-200">
      <div className="px-4 py-2 font-bold text-sm border-b">🤖 Robot-Ops 运维助手</div>
      <div className="p-3 max-h-80 overflow-auto text-sm whitespace-pre-wrap">{reply || '问我："FANUC 这台最近告警最多的是哪个关节？"'}</div>
      <div className="flex gap-2 p-3 border-t">
        <input
          className="flex-1 border rounded px-2 py-1 text-sm"
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder="用自然语言提问..."
          onKeyDown={e => e.key === 'Enter' && send()}
        />
        <button className="px-3 py-1 bg-blue-600 text-white rounded text-sm" onClick={send} disabled={loading}>
          {loading ? '...' : '发送'}
        </button>
      </div>
    </div>
  );
}
```

---

## 六、Agent 与现有模块的集成点

| 现有模块 | Agent 怎么用 | 集成方式 |
|---------|-------------|---------|
| `adapter-kit` | 读 UDM 数据 | Tool 调 `useRobotStore.getState().robots` |
| `robotStore` | 状态数据源 | Agent 只读，不改写 |
| `SOP 引擎` | 匹配 SOP 模板 | `sopRegistry.find(...)` |
| `告警流` | 聚类/去重/解释 | Tool 按 `udm_code` 分组 |
| `趋势图 TrendChart` | 生成报告时引用 | Agent 输出 Markdown 含数据摘要 |
| `AIInsightPanel` | Agent 回答嵌入面板 | ChatPanel 复用 InsightPanel 样式 |
| `企微/钉钉推送` | 推送建议 | Tool 调 webhook（需配置） |

---

## 七、去 AI 化合规边界（和软著指南衔接）

Agent **调用 LLM** 这件事，在软著申报时属于"AI 辅助能力"，要守住三条线：

1. **核心业务逻辑（adapter/SOP/健康分算法）必须是人工写的 TS 代码** → 进软著材料（见《软著去 AI 化指南》）
2. **LLM 调用层（agent.ts / orchestrator.ts）可作为"AI 集成模块"单独说明**，不冒充核心独创性
3. **Agent 生成的报告/建议必须标注"AI 生成·需人工确认"**，避免误导工厂做关键决策

### 7.1 输出标注规范

所有 Agent 文本回复前缀统一：

```
[AI 辅助生成 · 仅供参考 · 关键操作需人工确认]
```

### 7.2 软著拆分建议（与《软著去 AI 化指南》配套）

| 软著单元 | 是否含 Agent 逻辑 | 处理 |
|---------|------------------|------|
| 跨品牌协议适配引擎 | ❌ | 纯人工核心，进软著 |
| UDM 运行时 | ❌ | 纯人工核心，进软著 |
| 健康分与 RUL 算法 | ❌（算法手写） | 纯人工核心，进软著 |
| SOP 编排引擎 | ❌ | 纯人工核心，进软著 |
| **Agent 编排与工具层** | ✅（含 LLM 调用） | 单独说明"AI 集成"，不冒充独创；核心 Tool 逻辑人工写可进软著 |

---

## 八、一人公司落地节奏

| 阶段 | Agent 能力 | 技术动作 | 产出 |
|------|-----------|---------|------|
| **现在（MVP）** | 不接 LLM，先做人机交互骨架 | 建 `agent-kit` 包 + 6 个 Tool（本地 mock 返回） | ChatPanel 可演示"伪 Agent" |
| **拿到首单后** | 接 Claude/GPT，跑通"查数据+解释告警" | 配 `VITE_ANTHROPIC_API_KEY`，跑通 Tool 循环 | 路演可现场问答 |
| **3–5 单时** | 加 SOP 匹配 + 报告生成 | 完善 sopRegistry + 报告模板 | 给厂长出《周保养清单》 |
| **规模化前** | 企微/钉钉推送 + 多租户会话隔离 | webhook 通道 + 按 tenant 隔离 agentStore | 大客户投标加分 |

---

## 九、配置与部署清单

### 9.1 环境变量（`.env.example`）

```
# AI 模型
VITE_ANTHROPIC_API_KEY=sk-ant-xxx
# 或
VITE_OPENAI_API_KEY=sk-xxx

# 推送通道（可选）
VITE_WECHAT_WORK_WEBHOOK=https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=xxx
VITE_DINGTALK_WEBHOOK=https://oapi.dingtalk.com/robot/send?access_token=xxx

# Agent 行为
VITE_AGENT_MODE=enabled   # enabled / disabled(演示用mock)
```

### 9.2 依赖安装

```bash
pnpm add @anthropic-ai/sdk
# 或
pnpm add openai
```

### 9.3 文件新增/改动汇总

| 文件 | 操作 | 说明 |
|------|------|------|
| `packages/agent-kit/package.json` | 新建 | Agent 包定义 |
| `packages/agent-kit/src/tools/*.ts` | 新建 | 6 个 Tool |
| `packages/agent-kit/src/orchestrator.ts` | 新建 | Tool 注册表 |
| `packages/agent-kit/src/agent.ts` | 新建 | LLM 调用编排 |
| `apps/web-console/src/components/ChatPanel.tsx` | 新建 | 聊天入口组件 |
| `apps/web-console/src/App.tsx` | 改动 | 挂载 `<ChatPanel />` |
| `.env.example` | 改动 | 加 Agent 相关变量 |

---

## 十、演示话术（路演/见厂长）

> "王厂长，这是我们平台的 AI 运维助手。您不用记告警码，直接用大白话问它：'FANUC 这台最近 24 小时哪个关节最热？' 它会调数据、看趋势、给您三条可能原因和对应 SOP。所有建议都标注'需人工确认'，它只读不改，帮您设备科提效，不做任何冒险动作。"

---

## 十一、风险提示

| 风险 | 应对 |
|------|------|
| LLM 幻觉编造机器人状态 | Tool 结果优先展示，LLM 只做解释；无数据时明确说"暂无数据" |
| 误下发控制指令 | Agent 默认只读；任何"执行"类 Tool 需人工二次确认开关 |
| 工厂数据出网合规 | LLM 调用走园区网关（可抵扣 30%）；敏感数据脱敏后再送模型 |
| 软著被认定"纯 AI 生成" | 核心业务代码人工写；Agent/LLM 层单独说明 AI 集成 |
| Token 成本失控 | 每次会话 max_tokens 限幅 + 按 tenant 配额 + 缓存常见问答 |

---

*文档版本：v1.0 ｜ 2026-08- ｜ 与《架构文档》《软著去 AI 化指南》《深圳一人公司落地成本》配套使用*
