# 已实现功能清单 · Robot-Ops-Solo

> 本文档记录项目已实现的功能模块与变更历史。每次代码更新后由 doc-sync skill 同步维护。
> 状态图例：✅ 已实现 · 🚧 开发中 · 📋 规划中

## 已实现功能

### adapter-kit · 跨品牌协议适配层

#### 商用机器人适配器（可下发控制指令）
- ✅ 宇树 G1 适配 · [adapter-unitree.ts](file:///Users/wangwenshuai/Desktop/robot-ops-solo/robot-ops-solo/packages/adapter-kit/src/adapters/commercial/adapter-unitree.ts) · 低级遥测帧 → 统一状态
- ✅ 擎朗 T9 适配 · [adapter-keenon.ts](file:///Users/wangwenshuai/Desktop/robot-ops-solo/robot-ops-solo/packages/adapter-kit/src/adapters/commercial/adapter-keenon.ts) · 状态/关节映射
- ✅ 普渡 Peanut/Bellabot 适配 · [adapter-pudutech.ts](file:///Users/wangwenshuai/Desktop/robot-ops-solo/robot-ops-solo/packages/adapter-kit/src/adapters/commercial/adapter-pudutech.ts)
- ✅ 智元 X1 适配 · [adapter-agibot.ts](file:///Users/wangwenshuai/Desktop/robot-ops-solo/robot-ops-solo/packages/adapter-kit/src/adapters/commercial/adapter-agibot.ts)
- ✅ 商用聚合入口 · [commercial/index.ts](file:///Users/wangwenshuai/Desktop/robot-ops-solo/robot-ops-solo/packages/adapter-kit/src/adapters/commercial/index.ts) · adaptIncoming/adaptCommercial

#### 工业机器人适配器（只读监控）
- ✅ FANUC FOCAS 适配 · [adapter-fanuc.ts](file:///Users/wangwenshuai/Desktop/robot-ops-solo/robot-ops-solo/packages/adapter-kit/src/adapters/industrial/adapter-fanuc.ts) · 6 轴关节 + 告警 + 运行时
- ✅ KUKA OPC UA 适配 · [adapter-kuka.ts](file:///Users/wangwenshuai/Desktop/robot-ops-solo/robot-ops-solo/packages/adapter-kit/src/adapters/industrial/adapter-kuka.ts) · KSS 报警码映射
- ✅ 埃斯顿 Modbus-TCP 适配 · [adapter-estun.ts](file:///Users/wangwenshuai/Desktop/robot-ops-solo/robot-ops-solo/packages/adapter-kit/src/adapters/industrial/adapter-estun.ts) · EST- 报警码映射
- ✅ 安川 Ethernet KRL 适配 · [adapter-yaskawa.ts](file:///Users/wangwenshuai/Desktop/robot-ops-solo/robot-ops-solo/packages/adapter-kit/src/adapters/industrial/adapter-yaskawa.ts)
- ✅ 工业品牌注册表 · [_registry.ts](file:///Users/wangwenshuai/Desktop/robot-ops-solo/robot-ops-solo/packages/adapter-kit/src/adapters/industrial/_registry.ts) · registry 动态注册 + adaptIndustrial 分发
- ✅ 统一分发入口 · [adapters/index.ts](file:///Users/wangwenshuai/Desktop/robot-ops-solo/robot-ops-solo/packages/adapter-kit/src/adapters/index.ts) · adaptByBrandEnhanced 按 brand 路由商用/工业

#### 类型系统
- ✅ 统一状态类型 · [unified.ts](file:///Users/wangwenshuai/Desktop/robot-ops-solo/robot-ops-solo/packages/adapter-kit/src/types/unified.ts) · UnifiedRobotState + IndustrialExtension 嵌入
- ✅ 工业专有类型 · [industrial.ts](file:///Users/wangwenshuai/Desktop/robot-ops-solo/robot-ops-solo/packages/adapter-kit/src/types/industrial.ts) · JointTelemetry/IndustrialAlarm/IndustrialRuntime/ProtocolConfig

#### 协议层
- ✅ WebSocket 客户端 · [ws-client.ts](file:///Users/wangwenshuai/Desktop/robot-ops-solo/robot-ops-solo/packages/adapter-kit/src/protocol/ws-client.ts) · 指数退避重连 + 心跳 + 连接生命周期埋点
- ✅ MQTT 客户端 · [mqtt-client.ts](file:///Users/wangwenshuai/Desktop/robot-ops-solo/robot-ops-solo/packages/adapter-kit/src/protocol/mqtt-client.ts) · 订阅 industrial/robot/+/telemetry + ota/+/status

#### 测试覆盖
- ✅ 宇树适配器测试 · adapter-unitree.test.ts
- ✅ FANUC 适配器测试 · adapter-fanuc.test.ts（关节/告警/协议标识/降级 8 例）
- ✅ KUKA 适配器测试 · adapter-kuka.test.ts（KSS 报警码映射 6 例）
- ✅ 埃斯顿适配器测试 · adapter-estun.test.ts（EST- 报警码映射 7 例）
- ✅ mock 数据管道测试 · mock-pipeline.test.ts（商用 + 工业完整链路）

### digital-twin · 3D 数字孪生渲染

#### 机器人 3D 模型
- ✅ 宇树 G1 人形模型 · [G1Dog.tsx](file:///Users/wangwenshuai/Desktop/robot-ops-solo/robot-ops-solo/packages/digital-twin/src/robots/G1Dog.tsx) · 关节动画
- ✅ 普渡花生机器人模型 · [PeanutBot.tsx](file:///Users/wangwenshuai/Desktop/robot-ops-solo/robot-ops-solo/packages/digital-twin/src/robots/PeanutBot.tsx) · 差速驱动
- ✅ FANUC 6 轴机械臂模型 · [FanucArm.tsx](file:///Users/wangwenshuai/Desktop/robot-ops-solo/robot-ops-solo/packages/digital-twin/src/robots/FanucArm.tsx) · 基座 + 6 关节 + 法兰 + 夹爪
- ✅ KUKA 6 轴机械臂模型 · [KukaArm.tsx](file:///Users/wangwenshuai/Desktop/robot-ops-solo/robot-ops-solo/packages/digital-twin/src/robots/KukaArm.tsx) · 橙色涂装 + 关节联动
- ✅ 模型注册表 · [robots/index.ts](file:///Users/wangwenshuai/Desktop/robot-ops-solo/robot-ops-solo/packages/digital-twin/src/robots/index.ts) · renderRobotModel(brand) 按品牌分发

#### 场景组件
- ✅ 地面网格 · Floor.tsx · SLAM 坐标系可视化 · CSS 变量桥接
- ✅ SLAM 建图叠加 · SlamMap.tsx · 障碍物渲染
- ✅ 碰撞检测 · collision.ts · AABB 包围盒 + 穿模检测埋点
- ✅ 3D 场景色彩钩子 · useScenePalette.ts · CSS 变量 → Three.js 色值桥接
- ✅ 轨迹线 · TrajectoryLine.tsx · 历史路径渲染
- ✅ 发光轨迹 · GlowTrajectory.tsx · 渐变尾迹效果
- ✅ 状态标签 · StatusBadge.tsx · 3D 空间悬浮文字 · CSS 变量主题适配
- ✅ 3D 查看器主组件 · RobotViewer.tsx · Canvas + 相机 + 灯光 + 低性能降级 + 场景色板

### sop-editor · SOP 低代码流程编排

#### 商用节点（8 个）
- ✅ 移动节点 · MoveNode.tsx · 目标坐标 + 速度
- ✅ 话术节点 · SpeakNode.tsx · 文本 + 音量
- ✅ 等待节点 · WaitNode.tsx · 秒数
- ✅ 循环节点 · LoopNode.tsx · 次数 + 条件
- ✅ 启动节点 · BootNode.tsx · 机器人开机
- ✅ 关机节点 · ShutdownNode.tsx · 机器人关机
- ✅ 取放节点 · PickupNode.tsx · 抓取/放置动作
- ✅ 条件分支节点 · ConditionNode.tsx · if/else 路由

#### 工业运维节点（4 个）
- ✅ 读取告警节点 · ReadAlarmNode.tsx · 查询/筛选 raw_code 列表
- ✅ 预测维护节点 · PredictNode.tsx · 调用 AI SaaS 寿命预测
- ✅ 保养维护节点 · MaintenanceNode.tsx · 维护项 + 记录登记
- ✅ 日志记录节点 · LogNode.tsx · 关键事件落盘

#### 编排引擎
- ✅ 节点面板 · NodePalette.tsx · 商用节点分组 + 工业运维分组 · 拖拽创建
- ✅ 节点编辑弹窗 · NodeEditDialog.tsx · 属性表单
- ✅ SOP 执行引擎 · sop-executor.ts · 指令下发到真实机器人
- ✅ SOP 仿真器 · sop-simulator.ts · 无实机模拟执行流程

### web-console · 应用层

#### 页面路由
- ✅ 仪表盘 · Dashboard.tsx · KPI 卡 + 迷你趋势图 + 机器人快览 + 告警流
- ✅ 机器人管理 · RobotsPage.tsx · 商用控制按钮（启动/停止/回充/重启）+ 工业只读监控 + AI 洞察面板
- ✅ SOP 编辑器 · SopPage.tsx · 嵌入 sop-editor 包 + 模板保存/加载
- ✅ SOP 仿真 · SopSimPage.tsx · 无实机运行 SOP 流程预览
- ✅ 3D 孪生大屏 · TwinPage.tsx · 按 brand 切换 FanucArm/KukaArm/G1Dog/PeanutBot + 轨迹回放
- ✅ 告警中心 · AlertsPage.tsx · 级别筛选 + 搜索 + 播报历史 · 工业告警 raw_code 徽标 + 中文描述
- ✅ 租户管理 · TenantsPage.tsx · 贴牌换肤 + 异步数据 + 主题切换
- ✅ OTA 升级管理 · OtaPage.tsx · 设备状态卡片 + 进度条 + 前置校验 + 批量升级 + 模拟失败 + 操作日志
- ✅ 登录页 · LoginPage.tsx · Supabase Auth + 记住账号 + mock 降级
- ✅ 注册页 · SignUp.tsx · 租户标识写入 user_metadata

#### 状态层（Zustand）
- ✅ 机器人状态 · robotStore.ts · updateRobot/setOffline · onlineCount 派生 · 工业扩展字段
- ✅ 告警队列 · alertStore.ts · addAlert/clearAlerts · unreadCount · 工业 raw_code
- ✅ 语音播报 · speakStore.ts · setSpeak + history 播报历史
- ✅ 租户状态 · tenantStore.ts · setTenant + data-tenant 属性驱动贴牌换肤 + applyPrimaryColor 品牌色派生
- ✅ OTA 升级状态 · otaStore.ts · 6 态状态机 + 前置校验 + mock 降级引擎 + 后端 9 态→前端 6 态映射
- ✅ 主题状态 · themeStore.ts · 深/浅主题 · localStorage 持久化

#### 服务层
- ✅ WS/MQTT 中枢 · wsHub.ts · 商用分流 + 工业分流 + OTA 分流(ota_status) + MQTT 连接 + AI 联动
- ✅ AI SaaS 对接 · aiSaaSApi.ts · fetchAIInsight/fetchAINaturalQuery · 未配置走 mock 中文摘要
- ✅ Supabase 客户端 · supabase.ts · isSupabaseEnabled 降级标志
- ✅ 机器人持久化 · robotStorage.ts · writeRobotState + getRobotTrajectory
- ✅ 告警持久化 · alertStorage.ts · writeAlert 写入 Supabase alerts 表
- ✅ 租户 CRUD · tenantStorage.ts · Supabase 启用走数据库，否则 localStorage
- ✅ SOP 存储 · sopStorage.ts · saveSop/listSops + Supabase 持久化
- ✅ 实时推送 · realtime.ts · Supabase Realtime 订阅告警
- ✅ Webhook 推送 · webhook.ts · 企微/钉钉/飞书

#### 组件层
- ✅ 侧边导航 · Sidebar.tsx · 8 路由 NavLink + WS 三态状态角标 + 主题切换
- ✅ 贴牌顶栏 · TenantBranding.tsx · 租户 Logo + 品牌色 + 当前用户信息
- ✅ 语音气泡 · SpeakBubble.tsx + .css · 3D 场景上方悬浮 · TTS 朗读联动
- ✅ AI 运维助手面板 · AIInsightPanel.tsx · 中文告警摘要 + 排查建议 + 健康分/寿命预测

### python-edge · Python 边缘驱动

- ✅ FANUC FOCAS 客户端 · [focas_client.py](file:///Users/wangwenshuai/Desktop/robot-ops-solo/robot-ops-solo/python-edge/fanuc_focas/focas_client.py) · ctypes fwlib32 + fanucpy
- ✅ FANUC 配置 · [config.yaml](file:///Users/wangwenshuai/Desktop/robot-ops-solo/robot-ops-solo/python-edge/fanuc_focas/config.yaml) · R 寄存器映射 + 报警码字典 + MQTT 输出
- ✅ FANUC 数据解析 · [parser.py](file:///Users/wangwenshuai/Desktop/robot-ops-solo/robot-ops-solo/python-edge/fanuc_focas/parser.py) · 原始数据 → UDM JSON（与 adapter-fanuc.ts 对齐）
- ✅ 主轮询器 · [edge-poller.py](file:///Users/wangwenshuai/Desktop/robot-ops-solo/robot-ops-solo/python-edge/edge-poller.py) · 遍历品牌配置 → 拉数据 → 转 UDM → 发 MQTT
- 📋 KUKA OPC UA 客户端 · 待实现
- 📋 埃斯顿 Modbus 客户端 · 待实现

### supabase · 后端

- ✅ 建表迁移 · 001_init.sql · tenants/robots/robot_states/sop_templates/alerts/webhook_configs + RLS
- ✅ 补丁迁移 · 002_patch.sql · tenants insert 策略
- ✅ SOP ID 修复 · 003_fix_sop_id_type.sql · uuid → text
- ✅ Edge Function · set-tenant-claim · 注册时写入 tenant_slug 到 user_metadata

### 根目录

- ✅ Mock WS 服务器 · mock-ws-server.js · 3 端口分流 + OTA 状态轮播（:8080 商用 / :8081 商用+告警 / :8082 工业轮流 + OTA 8s/帧）
- ✅ 根 scripts · dev/build/test/lint/mock/dev:industrial/test:adapter-kit/build:all

## 变更日志

### 2026-08-28 · 埋点日志节流 + WS 孤儿连接修复 + Mock 状态推进解耦

- ✅ adapter-kit 商用适配器日志节流（adaptIncoming 入口 1/50 帧采样 + 宇树/擎朗输入输出 1/50 采样），修复 ~17 条/秒刷满 Console 缓冲区淹没低频埋点的问题
- ✅ adapter-unitree.ts 轴数异常 warn 只报一次（mock G1 固定 4 关节属持续性偏差，逐帧 warn 以 10Hz 刷屏）
- ✅ supabase.ts getCurrentTenantSlug 改用 getSession() 本地会话（原 getUser() 逐帧发起 /auth/v1/user 请求，未登录时产生 ~30 req/s 无效 401）
- ✅ robotStorage/alertStorage 未登录跳过 Supabase 写入 + 一次性提示（原逐帧 RLS 拒绝产生 writeRobotState error 洪泛）
- ✅ ws-client.ts 新增 disposed 标志：disconnect() 后 onclose 不再触发重连，修复 StrictMode 双挂载 + 页面刷新场景下孤儿连接复活
- ✅ mock-ws-server.js G1/Peanut 状态推进改为全局单 ticker + 广播，与连接数解耦（原每连接独立 interval 推进全局电量，实测 5 连接电量 5 倍速递减导致签名节流失效）
- ✅ 浏览器端全链路埋点验证通过：ws-client 连接 → 适配器入口/出口 → wsHub 分流（商用/工业/OTA）→ robotStore 更新 → sendCommand 指令下发（含破坏性操作双击确认）→ 播报/碰撞埋点

### 2026-08-28 · 3D 网格闪烁修复

- ✅ RobotViewer.tsx 提取 SceneEnvironment memo 组件，静态场景（灯光/地面/网格/阴影）仅依赖 palette+showMap，WS 高频帧(~10Hz)不再重建 3D 几何
- ✅ Grid 从 y=0 抬升至 y=0.005（group position），与 Floor(y=0) 拉开深度间距，消除 z-fighting
- ✅ 移除 drei infiniteGrid 属性（原 shader 跟随相机每帧重算导致拖拽时视觉抖动）
- ✅ 降低 Grid 线宽：cellThickness 0.5→0.08、sectionThickness 1→0.15，减少深度缓冲竞争
- ✅ 鼠标拖拽动态验证通过：连续拖拽 30 帧网格线稳定可见无闪烁

### 2026-08-26 · OTA 升级模块 + 深色主题修复 + 数字孪生场景适配 + 软著合规改造

- ✅ 新增 OTA 升级管理页 OtaPage.tsx（设备状态卡片 + 进度条 + 前置校验 + 批量升级 + 模拟失败 + 操作日志）
- ✅ 新增 OTA 状态管理 otaStore.ts（6 态状态机 + 前置校验 + mock 降级引擎 + 后端 9 态→前端 6 态映射）
- ✅ mqtt-client.ts 新增 roboticsops/ota/+/status 订阅 + OTA 状态消息分流
- ✅ wsHub.ts 新增 ota_status WS 消息分流 + connectMqtt 接入 OTA 回调
- ✅ App.tsx 新增 /ota 路由 + Sidebar 新增 OTA 导航项
- ✅ mock-ws-server.js 新增 OTA 状态轮播（8s/帧，3 台设备×6 态循环）
- ✅ 修复深色主题 --text-muted / --viz-* / --primary-color 变量缺失（影响 8+ 组件）
- ✅ tenantStore + ThemeProvider 新增 applyPrimaryColor 同步 8 个品牌色派生变量
- ✅ 品牌色统一恢复霓虹绿 #39ff8b（ThemeProvider/TenantBranding/TenantLogo/SignUp）
- ✅ TenantLogo/StatusBadge/AlertCard/NodeEditButton/SignUp 消除硬编码颜色，全部走 CSS 变量
- ✅ 数字孪生 3D 场景深色适配：新增 --scene-* 变量 + useScenePalette hook 桥接 CSS→Three.js
- ✅ P0 核心源码注释合规改造（13 文件 40 条注释补充日期+开发意图）
- ✅ 新增 22 条 console.log/warn 调试埋点（adapter-kit/sop-editor/web-console/digital-twin）
- ✅ 新增 doc/ 目录：CODE-RULES.md（软著合规规则 8 章 16 条）+ UI 风格文档 + 软著规则手册 + OTA 前端开发文档
- ✅ 新增 mock_ota_demo.py + requirements-ota-mock.txt + OTA-README.md + 轻量OTA开发文档.md

### 2026-08-18 · 工业扩展完整实现 + 文档体系建立

- ✅ 新增工业机器人适配器（FANUC/KUKA/埃斯顿/安川 4 品牌）
- ✅ 新增工业专有类型系统（JointTelemetry/IndustrialAlarm/IndustrialRuntime/ProtocolConfig）
- ✅ adapter-kit 目录重构：commercial/ + industrial/ 子目录分离
- ✅ 新增工业品牌注册表 _registry.ts（支持动态注册）
- ✅ 新增 adaptByBrandEnhanced 统一分发入口（商用/工业路由）
- ✅ mqtt-client 订阅 industrial/robot/+/telemetry 主题
- ✅ 新增 FANUC/KUKA 6 轴机械臂 3D 模型（FanucArm/KukaArm）
- ✅ 新增 robots/index.ts 模型注册表 renderRobotModel(brand)
- ✅ 新增 SOP 工业运维 4 节点（ReadAlarm/Predict/Maintenance/Log）
- ✅ NodePalette 新增工业运维节点分组
- ✅ wsHub 新增工业消息分流（industrial_state/industrial_alert）
- ✅ wsHub 接入 MQTT 连接（connectMqtt 回调写入 store）
- ✅ 新增 AI SaaS 对接 aiSaaSApi.ts（含 mock fallback）
- ✅ 新增 AIInsightPanel 组件（中文摘要 + 排查建议 + 健康分）
- ✅ RobotsPage 工业机器人只读监控模式 + 6 轴关节遥测 + 运行时统计
- ✅ AlertsPage 工业告警 raw_code 徽标 + 中文描述渲染
- ✅ TwinPage 按 brand 切换工业/商用 3D 模型
- ✅ mock-ws-server 新增 :8082 工业端口（FANUC/KUKA/埃斯顿 轮流广播）
- ✅ 新增 python-edge 边缘驱动（FOCAS 客户端 + 解析器 + 轮询器）
- ✅ 新增工业适配器单元测试 3 个（FANUC/KUKA/埃斯顿 共 21 例）
- ✅ 根 package.json 新增 dev:industrial/test:adapter-kit/build:all scripts
- ✅ .env / .env.example 新增 VITE_AI_SAAS_URL/VITE_MQTT_BROKER_URL/VITE_DEFAULT_INDUSTRIAL_BRAND
- ✅ 修复 wsHub.ts mqtt-client 导入路径错误（深层路径 → 包入口）
- ✅ 修复 wsHub.ts connectMqtt 回调 store API 不匹配（addAlerts→addAlert, updateRobot 缺 robotId）
- ✅ README.md 全面更新（技术栈/目录树/数据流/路由/启动/环境变量）
- ✅ 创建 FEATURES.md 开发文档
- ✅ 创建 doc-sync skill（代码变更文档同步）
