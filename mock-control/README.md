# Mock 控制面板 · mock-control

> 路演双向控制演示子项目 · 完整设计见 [doc/mock-control-panel-dev-guide.md](../doc/mock-control-panel-dev-guide.md)
> 让任何浏览器成为"指挥中心"：点按钮 / 拖滑块 → 指令下发 → 机器人响应 → 状态实时回传。

## 快速启动

```bash
# 方式一：一条命令（在项目根目录）
pnpm dev:control                    # = mock-ws-server(:8080/:8081/:8082) + Control Service(:3000)

# 方式二：分步启动（两条终端）
node mock-ws-server.js              # 1. mock 遥测数据源
pnpm mock:control                   # 2. Control Service + Control UI（:3000）

# 方式三：在本目录内
pnpm dev                            # = node server/index.js

# 打开 http://localhost:3000

# 停止：Ctrl+C 只停前台进程，mock 遥测源会残留占用 8080-8082 → 一键清理
pnpm kill:mock            # 项目根目录执行，清理 8080-8082 / 3000 全部 mock 进程
```

可选：本地装 mosquitto 后指令走 MQTT（`industrial/robot/+/command`），没装自动降级 WS 直连——页面顶栏显示当前传输模式。

```bash
# MQTT 模式（可选）
brew install mosquitto                # 首次安装
brew services start mosquitto         # 启动 broker（:1883）
# mqtt 包已加入根 package.json，无需手动补装
# 停止 broker：brew services stop mosquitto（kill:mock 不含 broker，留着也无害）
```

## 功能

| 区域 | 能力 |
|------|------|
| 设备网格 | 6 台设备实时卡片（2 商用 + 4 工业臂）· 点击选中联动控制面板 |
| 控制面板 | 生命周期启停/复位 · 电量滑块（商用）· 关节温度滑块 J1-J6（工业 · 联动健康分）· 告警触发/清空 · 模拟离线 30s · 注入故障 · 手/自动模式 · 自定义 telemetry patch |
| 场景剧本 | 🚀 一键演示（负载爬升→预警→告警锁定→降温恢复）· ⚠️ 级联告警 · 🔧 故障恢复 · 🔄 全部复位 |
| 实时日志 | SSE 推送状态翻转 / 告警广播 / 剧本进度（内存 200 条） |

场景剧本由服务端推进——切换浏览器 Tab 或刷新控制页都不会中断剧本。

## REST API

| Method | Path | 说明 |
|--------|------|------|
| GET | `/health` | 健康检查 |
| GET | `/api/devices` | 设备列表 + 当前状态 |
| GET | `/api/devices/:id` | 单设备详情 |
| POST | `/api/command` | 单条指令 `{ robotId, type, params }` |
| POST | `/api/command/batch` | 批量指令（body 为数组，单条失败不中断） |
| POST | `/api/scenario/:name/start` | 启动剧本（full-demo / cascade-alarm / fault-recovery / reset-all） |
| POST | `/api/scenario/:name/stop` | 中止当前剧本 |
| GET | `/api/telemetry/stream` | SSE 实时流（`state` / `alert` / `scenario` 三类命名事件） |

## 指令速查（22 种）

- **生命周期**：`start` `stop` `pause` `resume` `reset`
- **商用运动**：`move_to {x,y,speed}` `set_velocity {linear,angular}` `return_to_charge` `set_mode {mode}`
- **工业机械臂**：`set_joint_angle {axis,angle}` `set_joint_temperature {axis,temperature}` `set_load {axis,load}` `trigger_alarm {code,severity}` `clear_alarm`
- **低空（v1.1 预留）**：`open_dock_door` `close_dock_door` `dispatch_uav` `recall_uav`
- **全局调试**：`set_battery {level}` `set_health_score {score}` `inject_fault {type}` `simulate_offline {duration_ms}` `custom_telemetry {patch}`

指令参数由 Zod 双层校验（类型 + 每种指令的 params 细粒度），错误返回 400。

## 测试

```bash
pnpm test:mock-control              # 项目根目录（= pnpm --filter mock-control test）
pnpm test                           # 本目录内 · 30 单测 + 5 集成闭环（共 35 例）
pnpm test:watch                     # 本目录内 · watch 模式
```

集成测试覆盖完整链路：UI → REST API → WS /control → mock-ws-server → 遥测帧广播 → 状态回读。

## 目录

```
mock-control/
├── config/          # devices.yaml（6 台设备定义）· topics.yaml（MQTT 主题约定）
├── server/          # Control Service（Express :3000 + SSE）
│   ├── state-engine.js       # 内存状态树 · 指令应用 · 健康分重算
│   ├── command-handler.js   # Zod 校验 → 状态应用 → 桥接下发
│   ├── scenario-engine.js    # 4 个预设剧本 · 服务端推进
│   ├── mqtt-bridge.js        # MQTT/WS 双通道 · 自动降级
│   └── routes/               # REST 路由（command/devices/scenario/telemetry）
├── web/             # Control UI（原生 JS 单页 · 无构建）
└── test/            # Vitest（unit + integration）
```

## 安全提示

本面板是开发/路演工具，无认证、无限流，仅限本地内网使用，不要暴露公网。真实工业机器人控制必须走 `python-edge/` 的 FOCAS/OPC UA 客户端 + 安全联锁路径。
