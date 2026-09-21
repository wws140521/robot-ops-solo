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
| 低空设备接入 | DJI Dock · Autel 机巢 · eVTOL 起降场 | 机巢/起降场 raw JSON → UDM 统一模型 · 健康分加权算法 |
| LLM Agent | robot-agent-kit（function calling 编排） | 9 个工具（查状态/告警/匹配 SOP/生成报告…）· 未配 Key 走本地 mock 中文回复 |
| 室外地图 | 高德 AMap JS API + GLCustomLayer | POI/地理编码 + 步行路径规划 + 地图上 Three.js 3D 机器人融合渲染 |
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
│       │   │   ├── RobotsPage.tsx      #   /devices 机器人管理 · 列表筛选 + 3D 实时视图 + 操作面板（/robots 旧路径重定向）
│       │   │   │                       #     商用：启动/停止/回充/重启 · 工业：只读监控 + AI 洞察面板
│       │   │   ├── SopPage.tsx         #   /sop SOP 编辑器 · 嵌入 sop-editor 包 + 模板保存/加载
│       │   │   ├── SopSimPage.tsx      #   /sop-sim SOP 仿真 · 无实机运行 SOP 流程预览
│       │   │   ├── TwinPage.tsx        #   /twin 3D 孪生 · 舰队全景（多机同屏+点击聚焦）/ 单机聚焦双模式 + 一键演示剧本横幅
│       │   │   ├── FleetMapPage.tsx    #   /fleet-map 室外地图 · 高德真实路线 + 3D 机器人 + 实时 GPS 轨迹（GCJ-02）
│       │   │   ├── FleetPage.tsx       #   /fleet 设备总览 · 异构设备卡片墙（地面机器人/机巢/起降场/网关 tab 筛选）
│       │   │   ├── AlertsPage.tsx      #   /alerts 告警中心 · 级别筛选 + 搜索 + 播报历史 + 点击条目 3D 定位联动
│       │   │   │                       #     工业告警：raw_code 徽标 + 中文描述分段渲染
│       │   │   ├── AlertsPage.css      #   告警中心页样式
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
│       │   │   ├── demoStore.ts        #   一键演示状态 · demo_status 帧驱动 phase/label/进度条
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
│       │   │   ├── amap.ts             #   高德 JS API 封装 · POI 搜索/地理编码/逆地理编码
│       │   │   ├── route.ts            #   高德步行/驾车路径规划 · 室外机器人路线（GCJ-02）
│       │   │   ├── brandRegistry.ts    #   品牌配置注册表 · 颜色/图标/协议/分类集中管理
│       │   │   ├── robotType.ts        #   机器人类型判断 · 工业臂/移动/协作 → 控制按钮/电量/3D 模型显隐
│       │   │   ├── realtime.ts         #   Supabase Realtime 订阅 · subscribeAlerts 实时告警推送
│       │   │   └── webhook.ts          #   企微/钉钉/飞书 webhook 推送 · pushWebhook
│       │   │
│       │   ├── components/             # ── 组件层（跨页面复用组件）
│       │   │   ├── layout/
│       │   │   │   ├── Sidebar.tsx     #   侧边导航 · 9 路由 NavLink（/fleet-map 已隐藏）+ WS 三态状态角标 + 主题切换按钮
│       │   │   │   └── TenantBranding.tsx # 贴牌顶栏 · 租户 Logo + 品牌色 + 当前用户信息
│       │   │   ├── map/
│       │   │   │   └── MapRobotViewer.tsx # 高德地图+Three.js 融合渲染器 · AMap.GLCustomLayer 承载 3D 机器人
│       │   │   ├── ChatPanel.tsx       #   右下角运维助手聊天面板 · robot-agent-kit runAgent + SOP 匹配建议
│       │   │   ├── RobotCards.tsx      #   异构设备卡片墙 · 全部/地面机器人/机巢/起降场 tab 筛选
│       │   │   ├── DockCard.tsx       #   无人机机巢卡片 · 机巢状态 + 无人机电量 + 健康分色
│       │   │   ├── VertiportCard.tsx   #   eVTOL 起降场卡片 · 充电坪/消防/照明状态
│       │   │   ├── TrendChart.tsx      #   实时趋势图 · Chart.js 折线（温度/负载/电流/健康分，30 点滚动）
│       │   │   ├── HealthGauge.tsx     #   健康分仪表盘 · SVG 圆环四段配色
│       │   │   ├── ExtensionPanel.tsx  #   品牌特有数据扩展面板 · FANUC R 寄存器/KUKA 安全门等
│       │   │   ├── __tests__/           #   组件测试 · ExtensionPanel/HealthGauge/TrendChart
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
│       ├── vitest.config.ts             # Vitest 配置 · jsdom + setup.ts
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
│   │   │   │   ├── aerial/             #     ── 低空设备适配器（机巢/起降场，只读监控）
│   │   │   │   │   ├── _registry.ts      #   低空品牌注册表 · adaptAerial 分发
│   │   │   │   │   ├── adapter-dji-dock.ts #  大疆 Dock 2/3 机场 API → UDM（机巢+无人机双状态）
│   │   │   │   │   ├── adapter-autel-dock.ts # 道通机巢 → UDM（国产机巢通用，边缘侧归一化后映射）
│   │   │   │   │   └── adapter-vertiport.ts #  eVTOL 起降场 → UDM（BACnet/Modbus/厂商 API 通吃）
│   │   │   │   ├── adapter-gps.ts      #     室外 GPS 适配器 · WGS-84 → GCJ-02 纠偏（防 300~500m 偏移）
│   │   │   │   └── index.ts            #   adaptByBrandEnhanced 按 brand 分发（商用/工业路由）
│   │   │   ├── protocol/
│   │   │   │   ├── ws-client.ts        #   WebSocket 客户端 · 指数退避重连+抖动+心跳+孤儿连接修复
│   │   │   │   └── mqtt-client.ts      #   MQTT 客户端 · 订阅 industrial/robot/+/telemetry + ota/+/status 主题
│   │   │   ├── health/                 #   ── 健康分算法（按 device_class 路由）
│   │   │   │   ├── index.ts            #     calcHealthScore 统一入口 · ground_robot 取工业关节均值兜底 85
│   │   │   │   ├── dock-health.ts      #     机巢健康分 · 加权算法（充电温度/舱门/升降台/无人机电量）
│   │   │   │   └── vertiport-health.ts #     起降场健康分 · 加权算法（充电坪/消防/照明）
│   │   │   ├── utils/
│   │   │   │   └── smooth.ts          #   低通滤波 · GPS heading/speed/经纬度去抖（防地图跳变）
│   │   │   └── index.ts                #   包入口 · 统一导出（含 registry / adaptCommercial / 健康分）
│   │   └── __tests__/
│   │       ├── adapter-unitree.test.ts #   宇树适配器单元测试
│   │       ├── adapter-fanuc.test.ts   #   FANUC 适配器测试（关节/告警/协议标识/降级）
│   │       ├── adapter-kuka.test.ts    #   KUKA 适配器测试（KSS 报警码映射）
│   │       ├── adapter-estun.test.ts   #   埃斯顿适配器测试（EST- 报警码映射）
│   │       ├── adapter-dji-dock.test.ts #  大疆机巢适配器测试
│   │       ├── adapter-autel-dock.test.ts # 道通机巢适配器测试
│   │       ├── adapter-vertiport.test.ts #  起降场适配器测试
│   │       ├── health-aerial.test.ts   #   低空健康分算法测试
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
│   ├── agent-kit/                      # 纯 TS 包 · robot-agent-kit LLM 运维助手（零 React 依赖）
│   │   ├── src/
│   │   │   ├── agent.ts               #   runAgent 入口 · 未配 LLM Key 走本地 mock（正则意图匹配 + 中文回复 + 免责声明）
│   │   │   ├── orchestrator.ts        #   编排器 · tool 列表 → OpenAI/Anthropic function calling schema + 按 name 路由执行
│   │   │   ├── registry.ts            #   工具注册表 · ALL_TOOLS/findTool
│   │   │   ├── tools/                  #   ── Agent 工具集（9 个）
│   │   │   │   ├── queryRobotState.ts #     查机器人状态（在线/运行态/健康分/关节数/告警数/累计运行）
│   │   │   │   ├── queryAlarms.ts     #     查活跃告警（按 code 聚类）
│   │   │   │   ├── matchSOP.ts        #     按告警码匹配 SOP 处置流程
│   │   │   │   ├── queryHealthScore.ts #    查健康分/RUL 寿命排序（最该保养的关节）
│   │   │   │   ├── generateReport.ts  #     生成运维报告
│   │   │   │   ├── pushNotification.ts #    webhook 推送通知
│   │   │   │   ├── dock.ts           #     机巢/起降场状态查询 + 遥测数据源注入
│   │   │   │   ├── state-source.ts    #     数据源注入 · setRobotStateSource/setAlertSource 桥接 Zustand
│   │   │   │   └── types.ts          #     Tool/ToolParameterSchema 类型
│   │   │   └── index.ts                #   包入口 · 统一导出
│   │   └── __tests__/
│   │       └── tools.test.ts          #   工具集单元测试
│   │
│   ├── digital-twin/                   # React 包 · R3F 3D 数字孪生渲染
│   │   ├── src/
│   │   │   ├── robots/
│   │   │   │   ├── index.ts            #     机器人模型注册表 · renderRobotModel(brand) 按品牌分发
│   │   │   │   ├── G1Humanoid.tsx      #     宇树 G1 人形机器人 · URDF+STL 真实模型 + 程序化步态 + 模块级永久 anchor 防重挂载
│   │   │   │   ├── gaitMath.ts         #     步态纯函数库 · 步频/步幅角/航向跟踪/朝向映射/tick 插值（可单测）
│   │   │   │   ├── __tests__/          #     步态数学单元测试 · gaitMath.test.ts（33 例）
│   │   │   │   ├── IndustrialRobotModel.tsx # 工业机械臂 URDF 模型 · 4 品牌高细节 STL + useFrame 关节插值
│   │   │   │   ├── G1Dog.tsx           #     宇树 G1 几何简化模型（降级用）
│   │   │   │   ├── PeanutBot.tsx       #     擎朗花生机器人 · URDF+6 件 STL 程序化模型 + 失败降级几何版
│   │   │   │   ├── FanucArm.tsx        #     FANUC M-20iD 6 轴机械臂 · 基座+6关节+法兰+夹爪（降级几何版）
│   │   │   │   ├── KukaArm.tsx         #     KUKA KR6 6 轴机械臂 · 橙色涂装+关节联动（降级几何版）
│   │   │   │   ├── JointChain.tsx      #     关节链基元 · JointPivot/LinkSegment/JointBall
│   │   │   │   └── nativeG1.ts         #     原生 three.js G1 加载（非 R3F · 供 AMap GLCustomLayer 用）
│   │   │   ├── dance/
│   │   │   │   ├── useDancePlayer.ts   #     舞蹈播放器 hook · 关键帧插值驱动
│   │   │   │   └── subject3-keyframes.ts #   舞蹈关键帧定义 + G1 关节名映射
│   │   │   ├── environment/
│   │   │   │   ├── Floor.tsx           #   地面 · 商用哑光细网格 / 工业混凝土膨胀缝双场景 · CSS 变量桥接
│   │   │   │   ├── SlamMap.tsx         #   SLAM 建图叠加 · 障碍物渲染
│   │   │   │   └── collision.ts       #   碰撞检测工具 · AABB 包围盒 · 穿模检测
│   │   │   ├── config/
│   │   │   │   └── industrial-models.ts #  工业模型配置 · 4 品牌 URDF 路径/关节映射/缩放
│   │   │   ├── map/
│   │   │   │   └── mapCoords.ts        #   室外模式坐标转换 · 经纬度 → 世界坐标（GCJ-02）
│   │   │   ├── hooks/
│   │   │   │   └── useScenePalette.ts  #   3D 场景色彩钩子 · CSS 变量 → Three.js 色值桥接
│   │   │   ├── overlays/
│   │   │   │   ├── StateMachine.tsx    #   状态机徽章 · IDLE/MOVING/WORKING/CHARGING · sm/md/lg 三档
│   │   │   │   ├── TrajectoryLine.tsx #   轨迹线 · 历史路径渲染
│   │   │   │   ├── GlowTrajectory.tsx  #   发光轨迹 · 渐变尾迹效果
│   │   │   │   ├── StatusBadge.tsx    #   状态标签 · 3D 空间中悬浮文字
│   │   │   │   └── HUDLabel.tsx       #   HUD 标签 · drei Html(transform+sprite) 3D 空间锚定 ID/品牌/状态/电量
│   │   │   ├── RobotViewer.tsx         #   3D 查看器主组件 · Canvas+AdaptiveDpr+Suspense+HUDLabel+故障关节闪烁
│   │   │   ├── FleetViewer.tsx         #   舰队全景查看器 · 多机同屏（商用遥测坐标+工业产线槽位）
│   │   │   │                           #     点击聚焦相机飞行 · 告警联动红光环 · HUD 标签 · autoFocus
│   │   │   └── index.ts                #   包入口（重导出 G1Humanoid/FleetViewer/StateMachine 等）
│   │   ├── scripts/
│   │   │   └── generate-peanut-stl.mjs #  Peanut 6 件 STL 程序化生成（Lathe/Torus/Sphere + STLExporter）
│   │   ├── tsconfig.json
│   │   └── vitest.config.ts            #   Vitest 配置 · node 环境 + src/**/*.test.ts（防外部配置劫持）
│   │
│   └── ui-kit/                         # React 包 · 跨页面共用 UI 组件
│       ├── src/
│       │   ├── RobotCard.tsx            #   机器人卡片 · 状态色 + 电量条 + 在线指示
│       │   ├── RobotStatusCard.tsx     #   机器人状态卡 · 大尺寸详情展示
│       │   ├── BatteryGauge.tsx        #   电量仪表盘 · SVG 环形进度
│       │   ├── HealthGauge.tsx        #   健康分圆环 · 霓虹玻璃风 · ≥80 绿/≥60 黄/<60 红
│       │   ├── AlertItem.tsx            #   告警条目 · 级别图标 + 消息 + 关闭
│       │   ├── AlertCard.tsx           #   告警卡片 · 大尺寸告警展示 · CSS 变量主题适配
│       │   ├── TenantLogo.tsx          #   租户 Logo · 首字母 + 品牌色渐变
│       │   ├── GlassCard.tsx           #   玻璃拟态卡片容器 · highlight 高亮态
│       │   ├── NeonBadge.tsx           #   霓虹徽章 · 品牌色映射 + 发光效果
│       │   ├── StatusDot.tsx           #   状态点 · online/offline/warn/error/doing 六态
│       │   ├── TaskTimeline.tsx        #   任务时间线 · done/doing/todo/warn/error 节点
│       │   ├── ThemeProvider.tsx        #   主题 Provider · data-theme 属性注入 + applyPrimaryColor 品牌色派生
│       │   └── index.ts                 #   包入口 · 统一导出
│       └── tsconfig.json
│
├── supabase/                            # Supabase 后端 · 数据库迁移 + Edge Functions
│   ├── migrations/
│   │   ├── 001_init.sql                #   建表 + RLS 策略（tenants/robots/robot_states/sop_templates/alerts/webhook_configs）
│   │   ├── 002_patch.sql               #   补丁迁移
│   │   ├── 003_fix_sop_id_type.sql     #   SOP ID 类型修复
│   │   ├── 004_data_retention_and_auth_fix.sql # 数据保留 + 认证修复（写入节流 5s/清理 30 天/告警去重）
│   │   ├── 004_fix_auth_and_rls.sql    #   认证与 RLS 修复
│   │   └── 005_verify_retention.sql    #   数据保留策略验证脚本
│   └── functions/
│       └── set-tenant-claim/
│           └── index.ts                #   Edge Function · 注册时写入 tenant_slug 到 user_metadata
│
├── python-edge/                        # Python 边缘驱动 · 研华/树莓派网关侧拉取工业真机
│   ├── fanuc_focas/
│   │   ├── config.yaml                 #   FANUC 真机配置 · R 寄存器映射 + 报警码字典
│   │   ├── focas_client.py             #   FOCAS 客户端封装 · ctypes fwlib32 + fanucpy
│   │   └── parser.py                   #   原始数据 → UDM JSON（与 adapter-fanuc.ts 对齐）
│   ├── edge-poller.py                  #   主轮询器 · 遍历品牌配置 → 拉 → 转 UDM → 发 MQTT
│   └── requirements.txt                #   paho-mqtt / pyyaml / fanucpy / opcua / pymodbus
│
├── roboticsops-edge/                   # Python 边缘采集 · 低空设备（机巢/起降场）
│   ├── collectors/
│   │   ├── dji_dock_collector.py       #   大疆机场采集器 · 开放 API 拉机巢+无人机状态（token 提前 60s 刷新）
│   │   ├── autel_dock_collector.py     #   道通机巢采集器
│   │   └── vertiport_collector.py      #   起降场设施采集器
│   └── main.py                         #   采集主循环 · mock 模式（3 采集器）→ UDM payload → 发 MQTT
│
├── scripts/
│   └── gen-industrial-stls.mjs        # 工业品牌 STL 生成脚本 · 程序化生成 4 品牌最小可用 mesh（官方 CAD 缺失时 URDF 直渲不降级）
│
├── mock-ws-server.js                   # Mock WebSocket 服务器 · 3 端口分流 + 状态推进解耦（全局单 ticker+广播）
│                                       #   :8080 宇树 G1（8 方向避障巡航）  :8081 普渡 Peanut（直线往返）
│                                       #   :8082 工业 4 品牌（FANUC/KUKA/ESTUN/YASKAWA 梯形速度插补 2Hz/台）+ 一键演示剧本
│                                       #   :8082 OTA 状态轮播 8s/帧（mock 降级模式）
│                                       #   支持 /control WS 指令 + MQTT 订阅（mock-control 面板双向控制入口）
├── mock-control/                       # Mock 控制面板子项目 · 路演双向控制演示（doc/mock-control-panel-dev-guide.md）
│   ├── config/devices.yaml             #   6 台设备定义（2 商用 + 4 工业臂 · 初始状态/端口/健康分）
│   ├── config/topics.yaml              #   MQTT 主题约定（command/telemetry/alert 通道）
│   ├── server/                         #   Control Service · :3000 Express + SSE
│   │   ├── state-engine.js             #     内存状态树 · 指令应用 + 遥测回写 + 健康分重算
│   │   ├── command-handler.js          #     Zod 校验 → 状态应用 → 桥接下发（22 种指令）
│   │   ├── scenario-engine.js          #     4 个预设剧本 · 服务端推进（一键演示/级联告警/故障恢复/全部复位）
│   │   ├── mqtt-bridge.js              #     MQTT/WS 双通道桥接 · 无 broker 自动降级 WS 直连
│   │   └── routes/                     #     REST：/api/command /api/devices /api/scenario /api/telemetry/stream
│   ├── web/                            #   Control UI · 原生 JS 单页（设备网格/控制面板/场景剧本/实时日志）
│   └── test/                           #   Vitest · 30 单测 + 5 集成（UI→API→WS→mock→遥测闭环）
├── mock-simple.mjs                     # 极简 mock（仅 :8080 单机位移 · 调试用）
├── fanuc-ai-prompt-pack.md             # FANUC 边缘驱动 AI Prompt 完整包 · 0 基础分段复制生成 Python 采集代码
├── pnpm-workspace.yaml                 # Monorepo 工作区配置 · packages/* + apps/*
├── tsconfig.base.json                  # TypeScript 基础配置 · paths alias 跨包引用
├── package.json                        # 根 package.json · dev/build/mock/dev:industrial/test:adapter-kit/build:all
├── .gitignore
├── README.md
├── FEATURES.md                         # 已实现功能清单 + 变更日志（doc-sync skill 维护）
├── doc/                                 # 文档目录（32 份）
│   ├── robot-ops-solo-CODE-RULES.md     #   软著合规代码规则 · 8 章 16 条
│   ├── robot-ops-solo-软著提过率规则.md  #   软著提过率规则手册
│   ├── robot-ops-solo-UI风格开发文档.md  #   UI 风格开发文档
│   ├── 机器人商家HMI - 轻量OTA升级模块 前端开发文档.md # OTA 前端开发文档
│   ├── OTA-README.md                     #   OTA 配套说明 · 运行步骤/迁移路径/合规红线
│   ├── mock_ota_demo.py                  #   OTA 本地 Mock 验证脚本
│   ├── requirements-ota-mock.txt         #   OTA Mock 脚本依赖 · paho-mqtt/fastapi/cryptography
│   ├── 低空机巢接入完整开发文档.md        #   低空经济接入 · DJI/Autel 机巢 + 起降场完整方案
│   ├── robot-ops-solo-Agent开发指南.md   #   Agent 开发指南 · robot-agent-kit 工具扩展
│   ├── robot-ops-solo-AMAP-OUTDOOR.md    #   高德室外地图 · GPS/GCJ-02/路径规划
│   ├── robot-ops-solo-G1-HUMANOID.md     #   G1 人形模型 · URDF+STL 加载与步态
│   ├── robot-ops-solo-G1-FULL-RESTORE.md  #   G1 完整还原记录
│   ├── robot-ops-solo-DANCE.md           #   舞蹈功能设计
│   ├── robot-ops-solo-ROBOT-LOCOMOTION.md #   机器人运动控制
│   ├── robot-ops-solo-3D-VIEW-CLEAN.md   #   3D 视图清理
│   ├── robot-ops-solo-COMPLETE.md        #   完成度记录
│   ├── robot-ops-solo-UNITREE-SCALE.md    #   宇树模型比例
│   ├── robot-ops-solo-Day2-Day3开发文档.md # Day2/3 开发计划
│   ├── robot-ops-solo-下一步开发文档.md    #   后续规划
│   ├── robot-ops-solo-多品牌接入开发文档.md # 多品牌接入指南
│   ├── robot-ops-solo-DEV-GUIDE.md        #   通用开发指南
│   ├── robot-ops-solo-industrial-dev-guide.md # 工业扩展开发指南 · 完整 13 章架构设计
│   ├── robot-ops-solo-SOP-HOTPOT.md       #   SOP 火锅店场景设计
│   ├── robot-ops-solo-SPEAK-FEATURE.md    #   语音播报功能设计
│   ├── robot-ops-solo-SUPABASE.md         #   Supabase 后端设计
│   ├── robot-ops-solo-UI-INSPIRATION.md   #   UI 灵感参考
│   ├── robot-ops-solo-UI-OPTIMIZATION.md  #   UI 优化文档
│   ├── robot-ops-solo-优化方案.md          #   代码优化方案
│   ├── human-coder-skill.md               #   人工编码风格 skill
│   ├── mock-control-panel-dev-guide.md     #   Mock 控制面板开发指南 · 双向控制/场景剧本/MQTT-WS 降级
│   └── POC-现场执行清单.md                 #   POC 现场执行清单
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
│  FANUC/KUKA/ESTUN/YASKAWA│   │  :8080 G1     :8081 Peanut        │
└───────────┬──────────────┘   │  :8082 工业 2Hz/台 + OTA 轮播     │
            │ FOCAS/OPC-UA/    └──────────────┬───────────────────┘
            │ Modbus/Ethernet-KRL             │ WebSocket 遥测帧
┌───────────▼──────────────┐                  │
│  python-edge/ 边缘驱动    │                  │
│  focas_client / opcua   │                  │
│  parser.py → UDM JSON   │                  │
└───────────┬──────────────┘                  │
            │ MQTT: industrial/robot/+/tele   │
┌───────────┴───────────┐                     │
│  roboticsops-edge/     │                     │
│  低空采集（机巢/起降场）│                     │
│  dji/autel collector  │                     │
└───────────┬──────────────┘                  │
            │ MQTT: aerial/device/+/tele      │
            ▼                                 ▼
┌──────────────────────────────────────────────────────────────┐
│                     adapter-kit · 适配层                       │
│  mqtt-client → industrial/robot/+/tele 主题订阅                │
│  ws-client   → WebSocket 多路连接                              │
│  adaptByBrandEnhanced(brand, raw)                              │
│    商用 brand → commercial/index.ts → adaptCommercial          │
│    工业 brand → industrial/_registry → adaptFanuc/Kuka/...     │
│    低空 brand → aerial/_registry → adaptDJIDock/Vertiport/...  │
│  adapter-gps  → WGS-84 → GCJ-02（室外 GPS 纠偏）               │
│  health/      → calcHealthScore 按 device_class 加权健康分      │
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
│+低空dock │   │              │  │            │  │               │
│/vertiport│   │              │  │            │  │               │
└────┬─────┘   └───────┬──────┘  └─────┬──────┘  └──────┬────────┘
     │                 │                │                 │
     ▼                 ▼                ▼                 ▼
┌────────────────────────────────────────────────────────────────┐
│                    React 组件层                                  │
│  Dashboard RobotsPage TwinPage FleetMapPage FleetPage          │
│  AlertsPage SopPage OtaPage ChatPanel(全局右下角)                │
│  ├─ 商用：控制按钮 + 电量 + SLAM 路径                            │
│  ├─ 工业：只读监控角标 + AIInsightPanel                          │
│  │       6 轴关节遥测卡片（负载率/温度/健康分）                    │
│  │       运行时统计（通电时长/周期数）                             │
│  │       告警 raw_code 徽标 + 中文描述                            │
│  ├─ 低空：DockCard 机巢卡 + VertiportCard 起降场卡（RobotCards 墙）│
│  ├─ TwinPage：按 brand 切换 FanucArm / KukaArm / G1Dog / Peanut │
│  └─ FleetMapPage：AMap GLCustomLayer + Three.js 室外 3D        │
└──────────────┬──────────────────────┬─────────────────────┬────┘
               │                      │                     │
      ┌────────▼─────┐        ┌──────▼──────┐       ┌──────▼─────┐
      │ digital-twin │        │  sop-editor  │       │ agent-kit  │
      │ 3D 渲染      │        │ 画布编排 +    │       │ LLM 工具编排│
      │ FanucArm     │        │ 工业运维 4 节点│       │ 9 工具      │
      │ KukaArm      │        │ ReadAlarm/    │       │ (状态/告警/ │
      │ G1Dog        │        │ Predict/      │       │ SOP/报告/  │
      │ PeanutBot    │        │ Maintenance/  │       │ 推送)      │
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
| `/devices` | RobotsPage | 机器人列表 · 商用显示控制按钮（启动/停止/回充/重启） · 工业显示只读监控（`/robots` 旧路径自动重定向） |
| `/devices/:id` | RobotsPage | 选中指定机器人 · 工业显示 6 轴关节遥测 + 运行时统计 + AIInsightPanel |
| `/sop` | SopPage | SOP 流程编排画布 · 商用动作节点 + 工业运维 4 节点（告警/预测/保养/日志） |
| `/sop-sim` | SopSimPage | SOP 仿真运行 · 无实机预览 |
| `/twin` | TwinPage | 3D 孪生 · 舰队全景（多机同屏 + 点击聚焦相机飞行 + 一键演示剧本） |
| `/twin/:id` | TwinPage | 单机聚焦视图 · URL 直达（?joint=N 故障关节闪烁） |
| `/fleet-map` | FleetMapPage | 室外地图 · 高德真实路线 + GPS 实时轨迹 + 地图上 3D 机器人（需 VITE_AMAP_JS_KEY）· **2026-09-08 起入口与路由已注释隐藏，代码保留待低空二期开放** |
| `/fleet` | FleetPage | 设备总览 · 异构设备卡片墙（地面机器人/机巢/起降场 tab 筛选） |
| `/alerts` | AlertsPage | 告警中心 · 级别筛选 + 搜索 + 播报历史 + 点击条目 3D 定位（?focus=&joint=） |
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
- `:8080` 推送宇树 G1 商用遥测（8 方向避障巡航）
- `:8081` 推送普渡 Peanut 商用遥测（直线往返）
- `:8082` 推送 FANUC / KUKA / 埃斯顿 / 安川 工业遥测（2Hz/台 · 梯形速度插补）+ 一键演示剧本
- `:8082` 推送 OTA 状态轮播（每 8 秒一台设备的下一个状态）
- Robots 页面可同时看到商用 + 工业两种类型机器人，工业机器人显示"只读监控 + AI 洞察面板"
- Twin 页面舰队全景同屏 6 台机器人 · 一键演示完整剧本（负载爬升→告警→AI 诊断→webhook）
- Fleet 页面异构设备卡片墙（含机巢/起降场）· 右下角 ChatPanel 可对话查状态/告警/SOP
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

### 低空设备对接（roboticsops-edge · 机巢/起降场）

```bash
cd roboticsops-edge
python3 main.py        # mock 模式（3 采集器）→ UDM payload → 发 MQTT
# 生产接入：替换 collectors/ 为真实厂商 API（参考 doc/低空机巢接入完整开发文档.md）
```

### Mock 控制面板（路演双向控制演示）

```bash
# 方式一：一条命令同时起 mock 遥测源 + 控制面板
pnpm dev:control                    # = mock-ws-server(:8080/:8081/:8082) + Control Service(:3000)

# 方式二：分步启动（两条终端）
node mock-ws-server.js              # 1️⃣ mock 遥测源（:8080/:8081/:8082）
pnpm mock:control                   # 2️⃣ Control Service + Control UI（:3000）

# 打开 http://localhost:3000
# - 设备网格：6 台设备实时状态卡片（点击选中联动控制面板）
# - 控制面板：生命周期启停/关节温度滑块/告警触发与清空/模拟离线/模式切换
# - 场景剧本：一键演示（负载爬升→告警锁定→降温恢复）/ 级联告警 / 故障恢复 / 全部复位
# - 实时日志：SSE 推送遥测状态翻转、告警广播、剧本进度
# 传输自动降级：有 mosquitto 走 MQTT，没有走 WS 直连（页面顶栏显示当前模式）

# 停止（Ctrl+C 只停前台进程，mock 遥测源会残留 → 一键清理）
pnpm kill:mock                       # 清理 8080-8082 / 3000 残留进程，修复 EADDRINUSE
```

### 单元测试

```bash
pnpm test:adapter-kit              # adapter-kit 全部测试（商用 + 工业 + 低空共 9 个套件）
pnpm --filter digital-twin test    # digital-twin 步态数学测试（33 例 · 防太空步/螃蟹步/转向抽搐回归）
pnpm --filter robot-agent-kit test # agent-kit 工具集测试
pnpm --filter web-console test     # web-console 组件测试（ExtensionPanel/HealthGauge/TrendChart）
pnpm test:mock-control             # mock-control 控制面板测试（30 单测 + 5 集成闭环）
pnpm test                          # 全 workspace 测试
pnpm build:all                     # 递归构建所有包
```

## 登录账号

### 两种运行模式

| 模式 | 说明 | 登录方式 |
|------|------|---------|
| **Mock 模式**（未配置 Supabase） | 全量功能可用，数据走本地 localStorage + mock-ws-server | 无需登录，直接访问 `/` 进入 |
| **Supabase 模式**（已配置 `VITE_SUPABASE_URL`） | 云端鉴权 + 多租户隔离 + 实时告警推送 | 账号密码登录 / 魔法链接免密登录 |

### Supabase 测试账号

> ⚠️ **2026-08-28 数据优化**：已对数据库进行写入节流（5 秒/次）+ 自动清理（30 天过期）+ 告警去重。
> 旧项目因 500MB 免费配额已满进入只读模式，需新建 Supabase 项目并重新初始化。
>
> 新账号创建步骤：
> 1. 新建 Supabase 项目 → 执行 `supabase/migrations/001_init.sql` → `004_data_retention_and_auth_fix.sql`
> 2. **Authentication → Providers → Email → 关闭 "Confirm email"**（未配置 SMTP 无法发邮件）
> 3. **Authentication → Users → Add new user** 创建以下账号

| 邮箱 | 密码 | 租户标识 | 租户名称 | 用途 |
|------|------|---------|---------|------|
| test@example.com | 见下方说明 | testco | Test Company | 商用机器人（宇树/Keenon）验证 |
| test_industrial@test.com | 见下方说明 | default | 工业扩展验证账号 | 工业机器人（FANUC/KUKA/ESTUN）+ OTA 验证 |

> 💡 密码在 Supabase Dashboard 创建账号时自行设定，然后更新到此表格中。
> 💡 登录页勾选"记住账号"可将凭据保存在本地 localStorage，下次自动填充。

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

# 室外地图（可选，留空 /fleet-map 页面地图不加载）
VITE_AMAP_JS_KEY=                    # 高德 JS API Key
VITE_AMAP_SECURITY_CODE=             # 高德 securityJsCode（JS API 安全密钥）
VITE_AMAP_WEB_KEY=                   # 高德 Web 服务 Key（路径规划/地理编码 REST）

# Agent 助手（可选，留空走本地 mock 中文回复）
VITE_AGENT_MODE=enabled              # enabled/disabled；disabled 时走本地 mock 回复
VITE_OPENAI_API_KEY=                 # OpenAI API Key（可选）
VITE_ANTHROPIC_API_KEY=              # Anthropic API Key（可选）
VITE_WECHAT_WORK_WEBHOOK=            # 企业微信机器人 webhook（可选）
VITE_DINGTALK_WEBHOOK=               # 钉钉机器人 webhook（可选）
```

> 降级策略：未配置 `VITE_SUPABASE_URL` 时存储层降级 localStorage；未配置 `VITE_AI_SAAS_URL` 时 AI 面板走 mock 分析；未配置 `VITE_MQTT_BROKER_URL` 时走 mock-ws-server 工业广播；未配置 LLM Key 时 ChatPanel 走 robot-agent-kit 本地 mock；未配置 AMap Key 时室外地图页提示并跳过加载。全部不填即可全量开发体验。
