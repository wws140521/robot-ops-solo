# Robot-Ops-Solo

单人前端 · 跨品牌机器人运维中台 · Monorepo

## 技术栈

| 层级 | 技术 | 说明 |
|------|------|------|
| 构建 | pnpm workspace + Vite 5 + TypeScript 5 | Monorepo 多包管理，bundler 模块解析 |
| 框架 | React 18 + React Router 6 + Zustand | 函数组件 + Hooks 状态管理 |
| 3D 渲染 | @react-three/fiber + @react-three/drei | WebGL 数字孪生，低性能设备降级 |
| SOP 编排 | @xyflow/react (React Flow 12) | 拖拽式低代码流程画布（含工业运维节点扩展） |
| 后端 | Supabase (PostgreSQL + Auth + Realtime) | 多租户 RLS 隔离，离线 localStorage 降级 |
| AI 对接 | AI SaaS REST API + Mock 本地分析 | 中文告警摘要 + 排查建议 + 健康分/寿命预测（未配置时走 mock） |
| 协议 | WebSocket + MQTT | 商用/工业双通道：WebSocket (mock/实机) + MQTT (python-edge 遥测) |
| 工业协议 | FOCAS / OPC UA / Modbus-TCP / Ethernet KRL | FANUC / KUKA / 埃斯顿 / 安川 专用协议 → UDM 统一模型 |
| 品牌适配 · 商用 | 宇树 G1 · 擎朗 Peanut · 普渡 Bellabot · 智元 X1 | 人形 / 递送 / 四足，可下发运动指令 |
| 品牌适配 · 工业 | FANUC · KUKA · 埃斯顿 · 安川 | 6 轴机械臂，只读监控（不下发控制指令） |
| 边缘驱动 | Python + paho-mqtt + fanucpy + opcua + pymodbus | 研华/树莓派网关：读真机 → 转 UDM → 发 MQTT |
| OTA 升级 | 轻量 OTA + MQTT 指令通道 | 边缘网关软件升级（不升级机器人控制器固件） · 前端模拟降级 |

## 项目架构

```
robot-ops-solo/
├── apps/
│   └── web-console/                    # 主应用 · 贴牌运维控制台
│       ├── src/
│       │   ├── App.tsx                 # 根组件 · 路由表 + 鉴权守卫 + WS 生命周期 + 主题初始化
│       │   ├── main.tsx                # 入口 · 挂载 React + 导入全局样式
│       │   ├── index.html              # HTML 模板 · CSP 安全头 · Google Fonts 预连接
│       │   │
│       │   ├── routes/                 # ── 页面层（React Router 路由组件）
│       │   │   ├── Dashboard.tsx        #   / 仪表盘 · KPI 卡 + 迷你趋势图 + 机器人快览 + 告警流
│       │   │   ├── RobotsPage.tsx      #   /robots 机器人管理 · 列表筛选 + 3D 实时视图 + 操作面板
│       │   │   │                       #     商用：启动/停止/回充/重启 · 工业：只读监控 + AI 洞察面板
│       │   │   ├── SopPage.tsx         #   /sop SOP 编辑器 · 嵌入 sop-editor 包 + 模板保存/加载
│       │   │   ├── SopSimPage.tsx      #   /sop/sim SOP 仿真 · 无实机运行 SOP 流程预览
│       │   │   ├── TwinPage.tsx        #   /twin 3D 孪生大屏 · 按 brand 切换工业/商用模型 + 轨迹回放
│       │   │   ├── AlertsPage.tsx      #   /alerts 告警中心 · 级别筛选 + 搜索 + 播报历史
│       │   │   │                       #     工业告警：raw_code 徽标 + 中文描述分段渲染
│       │   │   ├── TenantsPage.tsx     #   /tenants 租户管理 · 异步加载 tenantStorage + loading skeleton
│       │   │   │                       #     贴牌换肤预览 · plan 标签 · 主题切换入口
│       │   │   ├── OtaPage.tsx         #   /ota OTA 升级管理 · 设备状态卡片+进度条+前置校验+批量升级+操作日志
│       │   │   ├── LoginPage.tsx      #   /login 登录页 · Supabase Auth + 记住账号 + mock 降级
│       │   │   └── SignUp.tsx          #   /signup 注册页 · 租户标识写入 user_metadata
│       │   │
│       │   ├── stores/                 # ── 状态层（Zustand 全局状态）
│       │   │   ├── robotStore.ts       #   机器人状态 Map · updateRobot/setOffline · onlineCount 派生
│       │   │   ├── alertStore.ts       #   告警队列 · addAlert/clearAlerts · unreadCount 未读计数
│       │   │   ├── speakStore.ts       #   语音播报事件 · setSpeak + history 播报历史
│       │   │   ├── tenantStore.ts      #   当前租户 · setTenant + data-tenant 属性驱动贴牌换肤
│       │   │   ├── otaStore.ts         #   OTA 升级状态 · 6 态状态机 + 前置校验 + mock 降级引擎
│       │   │   └── themeStore.ts       #   深/浅主题 · data-theme 属性 · localStorage 持久化
│       │   │
│       │   ├── lib/                    # ── 服务层（数据持久化 + WS 通信 + 实时推送）
│       │   │   ├── wsHub.ts            #   WebSocket/MQTT 连接中枢 · startWS/sendCommand
│       │   │   │                       #     商用分流：state/alert/speak · 工业分流：industrial_state/industrial_alert
│       │   │   │                       #     OTA 分流：ota_status → otaStore.updateFromBackend
│       │   │   │                       #     adaptByBrandEnhanced 按 brand 路由到商用/工业适配器
│       │   │   ├── aiSaaSApi.ts        #   AI SaaS 对接 · fetchAIInsight / fetchAINaturalQuery
│       │   │   │                       #     未配置 VITE_AI_SAAS_URL → 本地 mock 分析（中文摘要+建议）
│       │   │   ├── supabase.ts         #   Supabase 客户端 · isSupabaseEnabled 降级标志
│       │   │   │                       #     getCurrentTenantSlug 改用 getSession() 本地读 + 未登录返回 null
│       │   │   ├── robotStorage.ts     #   机器人状态持久化 · writeRobotState + getRobotTrajectory
│       │   │   │                       #     未登录(tenantSlug=null)跳过写入 + 一次性 warn
│       │   │   ├── alertStorage.ts     #   告警持久化 · writeAlert 写入 Supabase alerts 表
│       │   │   │                       #     未登录(tenantSlug=null)跳过写入 + 一次性 warn
│       │   │   ├── tenantStorage.ts    #   租户 CRUD · listTenants/updateTenant/createTenant
│       │   │   │                       #     Supabase 启用走数据库，否则 localStorage mock 降级
│       │   │   ├── sopStorage.ts       #   SOP 模板存储 · saveSop/listSops + Supabase 持久化
│       │   │   ├── realtime.ts         #   Supabase Realtime 订阅 · subscribeAlerts 实时告警推送
│       │   │   └── webhook.ts          #   企微/钉钉/飞书 webhook 推送 · pushWebhook
│       │   │
│       │   ├── components/             # ── 组件层（跨页面复用组件）
│       │   │   ├── layout/
│       │   │   │   ├── Sidebar.tsx     #   侧边导航 · 7 路由 NavLink + WS 三态状态角标 + 主题切换按钮
│       │   │   │   └── TenantBranding.tsx # 贴牌顶栏 · 租户 Logo + 品牌色 + 当前用户信息
│       │   │   └── overlays/
│       │   │       ├── SpeakBubble.tsx #   语音播报气泡 · 3D 场景上方悬浮 · TTS 朗读联动
│       │   │       ├── SpeakBubble.css #   气泡动画样式 · slideIn + fadeIn
│       │   │       └── AIInsightPanel.tsx # AI 运维助手面板 · 中文告警摘要 + 排查建议 + 健康分/寿命
│       │   │
│       │   └── styles/
│       │       └── globals.css         #   全局样式 · CSS 变量体系（深色HUD + 浅色Daylight）
│       │                               #     贴牌换肤 data-tenant · 状态色 · 阴影/圆角/动效 token
│       │
│       ├── .env.example                 # 环境变量模板 · VITE_SUPABASE_URL/ANON_KEY
│       ├── vite.config.ts               # Vite 配置 · monorepo alias + 代理
│       └── tsconfig.json                # 继承 tsconfig.base.json paths
│
├── packages/
│   ├── adapter-kit/                    # 纯 TS 包 · 跨品牌协议适配层（零 React 依赖）
│   │   ├── src/
│   │   │   ├── types/
│   │   │   │   ├── unified.ts          #   统一状态类型 · UnifiedRobotState + IndustrialExtension 嵌入
│   │   │   │   └── industrial.ts       #   工业专有类型 · JointTelemetry / IndustrialAlarm / IndustrialRuntime / ProtocolConfig
│   │   │   ├── adapters/
│   │   │   │   ├── commercial/         #     ── 商用适配器（可下发控制指令）
│   │   │   │   │   ├── adapter-unitree.ts #   宇树 G1 适配 · 低级遥测帧 → 统一状态
│   │   │   │   │   ├── adapter-keenon.ts  #   擎朗 T9 适配 · 状态/关节映射
│   │   │   │   │   ├── adapter-pudutech.ts #  普渡 Peanut/Bellabot 适配
│   │   │   │   │   ├── adapter-agibot.ts  #   智元 X1 适配
│   │   │   │   │   └── index.ts          #   adaptIncoming/adaptCommercial 聚合
│   │   │   │   ├── industrial/         #     ── 工业适配器（只读监控）
│   │   │   │   │   ├── _registry.ts      #   工业品牌注册表 · adaptIndustrial + registry 动态注册
│   │   │   │   │   ├── adapter-fanuc.ts  #   FANUC FOCAS → UnifiedRobotState（6 轴关节+告警+运行时）
│   │   │   │   │   ├── adapter-kuka.ts   #   KUKA OPC UA → UnifiedRobotState（KSS 报警码映射）
│   │   │   │   │   ├── adapter-estun.ts  #   埃斯顿 Modbus-TCP → UnifiedRobotState（EST- 报警码映射）
│   │   │   │   │   └── adapter-yaskawa.ts #  安川 Ethernet KRL → UnifiedRobotState
│   │   │   │   └── index.ts            #   adaptByBrandEnhanced 按 brand 分发（商用/工业路由）
│   │   │   ├── protocol/
│   │   │   │   ├── ws-client.ts        #   WebSocket 客户端 · 指数退避重连+抖动+心跳+孤儿连接修复
│   │   │   │   └── mqtt-client.ts      #   MQTT 客户端 · 订阅 industrial/robot/+/telemetry + ota/+/status 主题
│   │   │   └── index.ts                #   包入口 · 统一导出（含 registry / adaptCommercial）
│   │   └── __tests__/
│   │       ├── adapter-unitree.test.ts #   宇树适配器单元测试
│   │       ├── adapter-fanuc.test.ts   #   FANUC 适配器测试（关节/告警/协议标识/降级）
│   │       ├── adapter-kuka.test.ts    #   KUKA 适配器测试（KSS 报警码映射）
│   │       ├── adapter-estun.test.ts   #   埃斯顿适配器测试（EST- 报警码映射）
│   │       └── mock-pipeline.test.ts   #   mock 数据管道测试（商用+工业完整链路）
│   │
│   ├── sop-editor/                     # React 包 · SOP 低代码流程编排器
│   │   ├── src/
│   │   │   ├── schema/
│   │   │   │   └── sop-schema.ts       #   SOP 类型定义 · SopGraph/SopNode/SopEdge + 节点 data 类型
│   │   │   ├── hooks/
│   │   │   │   └── useSopStore.ts      #   Zustand 画布状态 · nodes/edges CRUD + getGraph 导出
│   │   │   ├── nodes/                   #   ── React Flow 自定义节点
│   │   │   │   ├── MoveNode.tsx        #     移动节点 · 目标坐标 + 速度
│   │   │   │   ├── SpeakNode.tsx      #     话术节点 · 文本 + 音量
│   │   │   │   ├── WaitNode.tsx        #     等待节点 · 秒数
│   │   │   │   ├── LoopNode.tsx        #     循环节点 · 次数 + 条件
│   │   │   │   ├── BootNode.tsx        #     启动节点 · 机器人开机
│   │   │   │   ├── ShutdownNode.tsx    #     关机节点 · 机器人关机
│   │   │   │   ├── PickupNode.tsx      #     取放节点 · 抓取/放置动作
│   │   │   │   ├── ConditionNode.tsx   #     条件分支节点 · if/else 路由
│   │   │   │   ├── ReadAlarmNode.tsx   #     工业 · 读取告警节点 · 查询/筛选 raw_code 列表
│   │   │   │   ├── PredictNode.tsx     #     工业 · 预测维护节点 · 调用 AI SaaS 寿命预测
│   │   │   │   ├── MaintenanceNode.tsx #     工业 · 保养维护节点 · 维护项 + 记录登记
│   │   │   │   ├── LogNode.tsx         #     工业 · 日志记录节点 · 关键事件落盘
│   │   │   │   └── NodeEditButton.tsx  #     节点编辑触发器 · 内联编辑入口
│   │   │   ├── sidebar/
│   │   │   │   ├── NodePalette.tsx     #   左侧节点面板 · 商用节点分组 + 工业运维分组 · 拖拽创建
│   │   │   │   └── NodeEditDialog.tsx  #   节点编辑弹窗 · 属性表单
│   │   │   ├── engine/
│   │   │   │   ├── sop-executor.ts     #   SOP 执行引擎 · 指令下发到真实机器人
│   │   │   │   └── sop-simulator.ts    #   SOP 仿真器 · 无实机模拟执行流程
│   │   │   ├── SopEditor.tsx           #   编辑器主组件 · React Flow 画布 + 拖拽 + 连线
│   │   │   └── index.ts                #   包入口
│   │   └── __tests__/
│   │       └── sop-simulator.test.ts   #   仿真器单元测试
│   │
│   ├── digital-twin/                   # React 包 · R3F 3D 数字孪生渲染
│   │   ├── src/
│   │   │   ├── robots/
│   │   │   │   ├── index.ts            #     机器人模型注册表 · renderRobotModel(brand) 按品牌分发
│   │   │   │   ├── G1Dog.tsx           #     宇树 G1 人形机器人 3D 模型 · 关节动画
│   │   │   │   ├── PeanutBot.tsx       #     普渡花生机器人 3D 模型 · 差速驱动
│   │   │   │   ├── FanucArm.tsx        #     FANUC M-20iD 6 轴机械臂 · 基座+6关节+法兰+夹爪
│   │   │   │   └── KukaArm.tsx         #     KUKA KR6 6 轴机械臂 · 橙色涂装+关节联动
│   │   │   ├── environment/
│   │   │   │   ├── Floor.tsx           #   金属感地面 · MeshReflectorMaterial 实时反射 · CSS 变量桥接
│   │   │   │   ├── SlamMap.tsx         #   SLAM 建图叠加 · 障碍物渲染
│   │   │   │   └── collision.ts       #   碰撞检测工具 · AABB 包围盒 · 穿模检测
│   │   │   ├── hooks/
│   │   │   │   └── useScenePalette.ts  #   3D 场景色彩钩子 · CSS 变量 → Three.js 色值桥接
│   │   │   ├── overlays/
│   │   │   │   ├── TrajectoryLine.tsx #   轨迹线 · 历史路径渲染
│   │   │   │   ├── GlowTrajectory.tsx  #   发光轨迹 · 渐变尾迹效果
│   │   │   │   ├── StatusBadge.tsx    #   状态标签 · 3D 空间中悬浮文字
│   │   │   │   └── HUDLabel.tsx       #   HUD 标签 · drei Html 空间锚定机器人 ID/电量/状态
│   │   │   ├── RobotViewer.tsx         #   3D 查看器主组件 · Canvas+AdaptiveDpr+Suspense+HUDLabel
│   │   │   └── index.ts                #   包入口（重导出 FanucArm/KukaArm/HUDLabel + renderRobotModel）
│   │   └── tsconfig.json
│   │
│   └── ui-kit/                         # React 包 · 跨页面共用 UI 组件
│       ├── src/
│       │   ├── RobotCard.tsx            #   机器人卡片 · 状态色 + 电量条 + 在线指示
│       │   ├── RobotStatusCard.tsx     #   机器人状态卡 · 大尺寸详情展示
│       │   ├── BatteryGauge.tsx        #   电量仪表盘 · SVG 环形进度
│       │   ├── AlertItem.tsx            #   告警条目 · 级别图标 + 消息 + 关闭
│       │   ├── AlertCard.tsx           #   告警卡片 · 大尺寸告警展示 · CSS 变量主题适配
│       │   ├── TenantLogo.tsx          #   租户 Logo · 首字母 + 品牌色渐变
│       │   ├── ThemeProvider.tsx        #   主题 Provider · data-theme 属性注入 + applyPrimaryColor 品牌色派生
│       │   └── index.ts                 #   包入口 · 统一导出
│       └── tsconfig.json
│
├── supabase/                            # Supabase 后端 · 数据库迁移 + Edge Functions
│   ├── migrations/
│   │   ├── 001_init.sql                #   建表 + RLS 策略（tenants/robots/robot_states/sop_templates/alerts/webhook_configs）
│   │   ├── 002_patch.sql               #   补丁迁移
│   │   └── 003_fix_sop_id_type.sql     #   SOP ID 类型修复
│   └── functions/
│       └── set-tenant-claim/
│           └── index.ts                #   Edge Function · 注册时写入 tenant_slug 到 user_metadata
│
├── python-edge/                        # Python 边缘驱动 · 研华/树莓派网关侧拉取真机
│   ├── fanuc_focas/
│   │   ├── config.yaml                 #   FANUC 真机配置 · R 寄存器映射 + 报警码字典
│   │   ├── focas_client.py             #   FOCAS 客户端封装 · ctypes fwlib32 + fanucpy
│   │   └── parser.py                   #   原始数据 → UDM JSON（与 adapter-fanuc.ts 对齐）
│   ├── edge-poller.py                  #   主轮询器 · 遍历品牌配置 → 拉 → 转 UDM → 发 MQTT
│   └── requirements.txt                #   paho-mqtt / pyyaml / fanucpy / opcua / pymodbus
│
├── mock-ws-server.js                   # Mock WebSocket 服务器 · 3 端口分流 + 状态推进解耦（全局单 ticker+广播）
│                                       #   :8080 商用(G1/Peanut)  :8081 商用+告警
│                                       #   :8082 工业(FANUC/KUKA/ESTUN industrial_state/alert 轮流广播)
│                                       #   :8082 OTA 状态轮播 8s/帧（mock 降级模式）
├── pnpm-workspace.yaml                 # Monorepo 工作区配置 · packages/* + apps/*
├── tsconfig.base.json                  # TypeScript 基础配置 · paths alias 跨包引用
├── package.json                        # 根 package.json · dev/build/mock/dev:industrial/test:adapter-kit/build:all
├── .gitignore
├── README.md
├── doc/                                 # 文档目录
│   ├── robot-ops-solo-CODE-RULES.md     #   软著合规代码规则 · 8 章 16 条
│   ├── robot-ops-solo-软著提过率规则.md  #   软著提过率规则手册
│   ├── robot-ops-solo-UI风格开发文档.md  #   UI 风格开发文档
│   ├── 机器人商家HMI - 轻量OTA升级模块 前端开发文档.md # OTA 前端开发文档
│   ├── OTA-README.md                     #   OTA 配套说明 · 运行步骤/迁移路径/合规红线
│   ├── mock_ota_demo.py                  #   OTA 本地 Mock 验证脚本
│   └── requirements-ota-mock.txt         #   OTA Mock 脚本依赖 · paho-mqtt/fastapi/cryptography
├── robot-ops-solo-轻量OTA开发文档.md    # 轻量 OTA 主文档 · 架构/MQTT Topic/状态机
├── robot-ops-solo-industrial-dev-guide.md # 工业扩展开发指南 · 完整 13 章架构设计
├── robot-ops-solo-DEV-GUIDE.md          # 通用开发指南
├── robot-ops-solo-SOP-HOTPOT.md         # SOP 火锅店场景设计
├── robot-ops-solo-SPEAK-FEATURE.md      # 语音播报功能设计
├── robot-ops-solo-SUPABASE.md           # Supabase 后端设计
├── robot-ops-solo-UI-INSPIRATION.md     # UI 灵感参考
├── robot-ops-solo-UI-OPTIMIZATION.md    # UI 优化文档
└── robot-ops-solo-优化方案.md            # 代码优化方案
```

## 数据流架构

```
┌──────────────────────────┐   ┌──────────────────────────────────┐
│  真机 · 工业机器人        │   │  Mock WS Server (端口分流)         │
│  FANUC/KUKA/ESTUN/YASKAWA│   │  :8080 商用    :8081 商用+告警     │
└───────────┬──────────────┘   │  :8082 工业 state/alert 轮流广播 │
            │ FOCAS/OPC-UA/    └──────────────┬───────────────────┘
            │ Modbus/Ethernet-KRL             │ WebSocket 遥测帧
┌───────────▼──────────────┐                  │
│  python-edge/ 边缘驱动    │                  │
│  focas_client / opcua   │                  │
│  parser.py → UDM JSON   │                  │
└───────────┬──────────────┘                  │
            │ MQTT: industrial/robot/+/tele   │
            ▼                                 ▼
┌──────────────────────────────────────────────────────────────┐
│                     adapter-kit · 适配层                       │
│  mqtt-client → industrial/robot/+/tele 主题订阅                │
│  ws-client   → WebSocket 多路连接                              │
│  adaptByBrandEnhanced(brand, raw)                              │
│    商用 brand → commercial/index.ts → adaptCommercial          │
│    工业 brand → industrial/_registry → adaptFanuc/Kuka/...     │
│  统一输出：UnifiedRobotState + IndustrialExtension (可选)       │
│           UnifiedAlert（工业告警带 raw_code/zh_desc）           │
└───────────────────────┬───────────────────────────────────────┘
                        │ 统一格式
┌───────────────────────▼───────────────────────────────────────┐
│                      wsHub.ts · 中枢                            │
│  商用分流： state    → robotStore                              │
│             alert    → alertStore + writeAlert                 │
│             speak    → speakStore + TTS                        │
│  工业分流： industrial_state  → updateRobot(industrial.robotId) │
│             industrial_alert  → addAlert(持久化写入)            │
│  OTA 分流： ota_status → otaStore.updateFromBackend            │
│  反向控制： sendCommand(仅商用 brand 生效，工业只读)             │
│  AI 联动：   updateRobot 触发 AIInsightPanel 发起 fetchAIInsight │
└──────┬──────────────┬──────────────┬──────────────┬───────────┘
       │              │              │              │
┌──────▼──┐   ┌───────▼──────┐  ┌───▼────────┐  ┌──▼────────────┐
│robotStore│   │ alertStore   │  │ speakStore │  │  AI SaaS API  │
│(Zustand) │   │ (Zustand)    │  │ (Zustand)  │  │ aiSaaSApi.ts  │
│+工业扩展 │   │+工业 raw_code │  │            │  │ + mock 分析   │
└────┬─────┘   └───────┬──────┘  └─────┬──────┘  └──────┬────────┘
     │                 │                │                 │
     ▼                 ▼                ▼                 ▼
┌────────────────────────────────────────────────────────────────┐
│                    React 组件层                                  │
│  Dashboard  RobotsPage  TwinPage  AlertsPage  SopPage  OtaPage  │
│  ├─ 商用：控制按钮 + 电量 + SLAM 路径                            │
│  ├─ 工业：只读监控角标 + AIInsightPanel                          │
│  │       6 轴关节遥测卡片（负载率/温度/健康分）                    │
│  │       运行时统计（通电时长/周期数）                             │
│  │       告警 raw_code 徽标 + 中文描述                            │
│  └─ TwinPage：按 brand 切换 FanucArm / KukaArm / G1Dog / Peanut │
└──────────────┬──────────────────────┬─────────────────────┬────┘
               │                      │                     │
      ┌────────▼─────┐        ┌──────▼──────┐       ┌──────▼─────┐
      │ digital-twin │        │  sop-editor  │       │  ui-kit    │
      │ 3D 渲染      │        │ 画布编排 +    │       │  共用组件   │
      │ FanucArm     │        │ 工业运维 4 节点│       │            │
      │ KukaArm      │        │ ReadAlarm/    │       │            │
      │ G1Dog        │        │ Predict/      │       │            │
      │ PeanutBot    │        │ Maintenance/  │       │            │
      └──────────────┘        │ Log           │       └────────────┘
                              └──────────────┘
               │
               ▼
┌────────────────────────────────────────────────────────────────┐
│              Supabase (可选) / localStorage 降级                │
│  Auth · PostgreSQL (RLS) · Realtime · alerts 表扩展 raw_code     │
│  sop_templates · robot_states(含 industrial 字段) · tenants      │
│  未登录时 skip writeRobotState/writeAlert（tenantSlug 为 null）   │
└────────────────────────────────────────────────────────────────┘
```

## 页面路由

| 路径 | 组件 | 功能 |
|------|------|------|
| `/` | Dashboard | KPI 仪表盘 · 机器人在线数/平均电量/告警/任务 + 迷你趋势图 |
| `/robots` | RobotsPage | 机器人列表 · 商用显示控制按钮（启动/停止/回充/重启） · 工业显示只读监控 |
| `/robots/:id` | RobotsPage | 选中指定机器人 · 工业显示 6 轴关节遥测 + 运行时统计 + AIInsightPanel |
| `/sop` | SopPage | SOP 流程编排画布 · 商用动作节点 + 工业运维 4 节点（告警/预测/保养/日志） |
| `/sop/sim` | SopSimPage | SOP 仿真运行 · 无实机预览 |
| `/twin` | TwinPage | 3D 孪生大屏 · 按 brand 切换 FanucArm/KukaArm/G1Dog/PeanutBot + 轨迹回放 |
| `/twin/:id` | TwinPage | URL 直达指定机器人孪生场景 |
| `/alerts` | AlertsPage | 告警中心 · 级别筛选 + 搜索 + 播报历史 · 工业告警显示 raw_code 徽标 + 中文描述 |
| `/tenants` | TenantsPage | 租户管理 · 贴牌换肤 + 异步数据 + 主题切换 |
| `/ota` | OtaPage | OTA 升级管理 · 设备状态卡片 + 进度条 + 前置校验 + 批量升级 + 操作日志 |
| `/login` | LoginPage | 登录 · Supabase Auth + mock 降级 |
| `/signup` | SignUp | 注册 · 租户标识写入 user_metadata |

## 快速启动

### 最简 · 前端开发模式（商用 + 工业 mock 全量数据）

```bash
pnpm install
pnpm dev:industrial     # = mock-ws-server + web-console dev（1 条命令同时起 3 个 WS 端口）
```

打开 http://localhost:5173 ，登录后：
- `:8080` 推送宇树 G1 / 普渡 Peanut 商用遥测
- `:8082` 推送 FANUC / KUKA / 埃斯顿 工业遥测（每 5 秒轮流）
- `:8082` 推送 OTA 状态轮播（每 8 秒一台设备的下一个状态）
- Robots 页面可同时看到商用 + 工业两种类型机器人，工业机器人显示"只读监控 + AI 洞察面板"
- OTA 页面可看到设备升级进度条实时更新 + 前置校验拦截 + 模拟失败/重试

### 分步启动

```bash
# 1. 安装依赖
pnpm install

# 2. 起 mock 数据源（可选：只要 :8082 工业就可验证工业扩展）
node mock-ws-server.js

# 3. 起前端
pnpm --filter web-console dev
```

### 真实工业机器人对接（python-edge）

```bash
# 网关节点上安装 Python 依赖
cd python-edge
pip install -r requirements.txt

# 编辑 fanuc_focas/config.yaml（host/port/R 寄存器映射/报警码字典）
vim fanuc_focas/config.yaml

# 启动轮询器：读真机 FOCAS → 转 UDM → 发 MQTT industrial/robot/+/telemetry
python3 edge-poller.py
```

### 单元测试

```bash
pnpm test:adapter-kit    # adapter-kit 全部测试（商用 + 工业 36 个用例）
pnpm build:all           # 递归构建所有包
```

## 测试账号

> 以下账号已注册在 Supabase 云端，可直接登录使用。

| 邮箱 | 密码 | 租户标识 | 租户名称 |
|------|------|---------|---------|
| test@example.com | testpass123 | testco | Test Company |
| test_industrial@test.com | Test123456 | default | 工业扩展验证账号 |

登录页勾选"记住账号"可将凭据保存在本地 localStorage，下次自动填充。

## 环境变量

```bash
# apps/web-console/.env
VITE_SUPABASE_URL=          # Supabase 项目 URL（留空走纯前端 mock 模式）
VITE_SUPABASE_ANON_KEY=     # Supabase 匿名公钥（非 service_role）
VITE_DEFAULT_TENANT=        # 默认租户标识（未登录时使用）

# 工业扩展（可选，留空走 mock / WS 连接）
VITE_AI_SAAS_URL=                    # AI SaaS 项目地址（留空走本地 mock 中文摘要）
VITE_MQTT_BROKER_URL=                # MQTT broker 地址（留空走 mock-ws-server 8082）
VITE_DEFAULT_INDUSTRIAL_BRAND=fanuc  # 默认工业品牌（开发模式用，可选 fanuc/kuka/estun/yaskawa）
```

> 降级策略：未配置 `VITE_SUPABASE_URL` 时存储层降级 localStorage；未配置 `VITE_AI_SAAS_URL` 时 AI 面板走 mock 分析；未配置 `VITE_MQTT_BROKER_URL` 时走 mock-ws-server 工业广播。三项均不填即可全量开发体验。
