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

#### 低空设备适配器（机巢/起降场，只读监控）
- ✅ 大疆 Dock 2/3 机巢适配 · [adapter-dji-dock.ts](file:///Users/wangwenshuai/Desktop/robot-ops-solo/robot-ops-solo/packages/adapter-kit/src/adapters/aerial/adapter-dji-dock.ts) · 机场 API JSON → UDM（机巢+无人机双状态，驼峰/下划线字段通吃）
- ✅ 道通机巢适配 · [adapter-autel-dock.ts](file:///Users/wangwenshuai/Desktop/robot-ops-solo/robot-ops-solo/packages/adapter-kit/src/adapters/aerial/adapter-autel-dock.ts) · 国产机巢通用（边缘侧归一化后 UDM 映射）
- ✅ eVTOL 起降场适配 · [adapter-vertiport.ts](file:///Users/wangwenshuai/Desktop/robot-ops-solo/robot-ops-solo/packages/adapter-kit/src/adapters/aerial/adapter-vertiport.ts) · BACnet/Modbus/厂商 API → UDM（充电坪/消防/照明）
- ✅ 低空品牌注册表 · [_registry.ts](file:///Users/wangwenshuai/Desktop/robot-ops-solo/robot-ops-solo/packages/adapter-kit/src/adapters/aerial/_registry.ts) · adaptAerial 分发
- ✅ 室外 GPS 适配 · [adapter-gps.ts](file:///Users/wangwenshuai/Desktop/robot-ops-solo/robot-ops-solo/packages/adapter-kit/src/adapters/adapter-gps.ts) · WGS-84 → GCJ-02 纠偏（防中国区地图 300~500m 偏移）

#### 健康分算法
- ✅ 健康分统一入口 · [health/index.ts](file:///Users/wangwenshuai/Desktop/robot-ops-solo/robot-ops-solo/packages/adapter-kit/src/health/index.ts) · calcHealthScore 按 device_class 路由（ground_robot 取工业关节均值兜底 85）
- ✅ 机巢健康分 · [dock-health.ts](file:///Users/wangwenshuai/Desktop/robot-ops-solo/robot-ops-solo/packages/adapter-kit/src/health/dock-health.ts) · 加权算法（充电温度/舱门/升降台/无人机电量）
- ✅ 起降场健康分 · [vertiport-health.ts](file:///Users/wangwenshuai/Desktop/robot-ops-solo/robot-ops-solo/packages/adapter-kit/src/health/vertiport-health.ts) · 加权算法（充电坪/消防/照明）

#### 工具库
- ✅ 低通滤波 · [smooth.ts](file:///Users/wangwenshuai/Desktop/robot-ops-solo/robot-ops-solo/packages/adapter-kit/src/utils/smooth.ts) · GPS heading/speed/经纬度去抖（角度版处理 ±π 跳变防鬼畜）

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
- ✅ 大疆机巢适配器测试 · adapter-dji-dock.test.ts
- ✅ 道通机巢适配器测试 · adapter-autel-dock.test.ts
- ✅ 起降场适配器测试 · adapter-vertiport.test.ts
- ✅ 低空健康分测试 · health-aerial.test.ts
- ✅ mock 数据管道测试 · mock-pipeline.test.ts（商用 + 工业完整链路）

### agent-kit · LLM 运维助手（robot-agent-kit）

- ✅ Agent 入口 · [agent.ts](file:///Users/wangwenshuai/Desktop/robot-ops-solo/robot-ops-solo/packages/agent-kit/src/agent.ts) · runAgent · 未配 LLM Key 走本地 mock（正则意图匹配 + 中文回复 + 免责声明前缀）
- ✅ 编排器 · [orchestrator.ts](file:///Users/wangwenshuai/Desktop/robot-ops-solo/robot-ops-solo/packages/agent-kit/src/orchestrator.ts) · tool 列表 → OpenAI/Anthropic function calling schema + 按 name 路由执行（换真模型不改代码）
- ✅ 工具注册表 · [registry.ts](file:///Users/wangwenshuai/Desktop/robot-ops-solo/robot-ops-solo/packages/agent-kit/src/registry.ts) · ALL_TOOLS/findTool
- ✅ 查机器人状态工具 · queryRobotState.ts · 在线/运行态/健康分/关节数/告警数/累计运行
- ✅ 查活跃告警工具 · queryAlarms.ts · 按 code 聚类返回
- ✅ SOP 匹配工具 · matchSOP.ts · 按告警码匹配处置流程
- ✅ 健康分/RUL 工具 · queryHealthScore.ts · 最该保养关节排序
- ✅ 报告生成工具 · generateReport.ts · 运维报告
- ✅ 通知推送工具 · pushNotification.ts · webhook 推送
- ✅ 机巢/起降场工具 · dock.ts · queryDockState/queryVertiportState + 遥测数据源注入
- ✅ 数据源桥接 · state-source.ts · setRobotStateSource/setAlertSource 桥接前端 Zustand store
- ✅ 工具集测试 · tools.test.ts

### digital-twin · 3D 数字孪生渲染

#### 机器人 3D 模型
- ✅ 宇树 G1 人形真实模型 · [G1Humanoid.tsx](file:///Users/wangwenshuai/Desktop/robot-ops-solo/robot-ops-solo/packages/digital-twin/src/robots/G1Humanoid.tsx) · URDF+STL 加载 + 程序化步态 + 模块级永久 anchor 防 R3F 重挂载 wireframe
- ✅ 宇树 G1 几何简化模型 · [G1Dog.tsx](file:///Users/wangwenshuai/Desktop/robot-ops-solo/robot-ops-solo/packages/digital-twin/src/robots/G1Dog.tsx) · 降级用
- ✅ 擎朗花生机器人模型 · [PeanutBot.tsx](file:///Users/wangwenshuai/Desktop/robot-ops-solo/robot-ops-solo/packages/digital-twin/src/robots/PeanutBot.tsx) · URDF + 6 件 STL（圆角底盘/防撞圈/双层圆托盘/锥形立柱/圆润头舱/导航灯）· packageMap 管线与工业臂一致 · 加载失败降级几何版 · 差速驱动
- ✅ 工业机械臂 URDF 模型 · [IndustrialRobotModel.tsx](file:///Users/wangwenshuai/Desktop/robot-ops-solo/robot-ops-solo/packages/digital-twin/src/robots/IndustrialRobotModel.tsx) · 4 品牌高细节 STL + useFrame 关节插值
- ✅ FANUC 6 轴机械臂模型 · [FanucArm.tsx](file:///Users/wangwenshuai/Desktop/robot-ops-solo/robot-ops-solo/packages/digital-twin/src/robots/FanucArm.tsx) · 基座 + 6 关节 + 法兰 + 夹爪（降级几何版）
- ✅ KUKA 6 轴机械臂模型 · [KukaArm.tsx](file:///Users/wangwenshuai/Desktop/robot-ops-solo/robot-ops-solo/packages/digital-twin/src/robots/KukaArm.tsx) · 橙色涂装 + 关节联动（降级几何版）
- ✅ 模型注册表 · [robots/index.ts](file:///Users/wangwenshuai/Desktop/robot-ops-solo/robot-ops-solo/packages/digital-twin/src/robots/index.ts) · renderRobotModel(brand) 按品牌分发

#### G1 步态引擎（物理一致性）
- ✅ 步态数学库 · [gaitMath.ts](file:///Users/wangwenshuai/Desktop/robot-ops-solo/robot-ops-solo/packages/digital-twin/src/robots/gaitMath.ts) · 步频/步幅角/航向跟踪/朝向映射/tick 插值纯函数（零依赖可单测）
- ✅ 步距一致（防太空步） · 步频 = 速度÷(2×步长)；步幅角 = asin(步长/2/腿长) → 视觉迈步距离 = 物理移动距离
- ✅ 朝向对齐（防螃蟹步） · Ry(-θ) 映射 URDF 局部 +X 前向到移动方向（走路/舞蹈双模式）
- ✅ 转向平滑（防抽搐） · τ=0.18s 连续航向跟踪 + 速度向量 EMA 滤噪 + 实测 tick 间隔插值
- ✅ 步态单元测试 · [gaitMath.test.ts](file:///Users/wangwenshuai/Desktop/robot-ops-solo/robot-ops-solo/packages/digital-twin/src/robots/__tests__/gaitMath.test.ts) · 33 例（含旧 bug 回归防线）

#### 工业机器人实时同步（交付形态）
- ✅ URDF 关节负载颜色映射 · [IndustrialRobotModel.tsx](file:///Users/wangwenshuai/Desktop/robot-ops-solo/robot-ops-solo/packages/digital-twin/src/robots/IndustrialRobotModel.tsx) · >100% 红 / >80% 黄（叠加自发光）/ 正常恢复品牌原色 · 材质按 mesh 克隆隔离（避免共享材质染红整臂）
- ✅ 故障关节脉冲闪烁 · [IndustrialRobotModel.tsx](file:///Users/wangwenshuai/Desktop/robot-ops-solo/robot-ops-solo/packages/digital-twin/src/robots/IndustrialRobotModel.tsx) faultJoint prop（告警→3D 联动）· 只染故障关节段臂身（link 直接 mesh 子节点）· sin 脉冲 60Hz 压过 2Hz 负载色 · 解除自动还原品牌原色
- ✅ 断连冻结 · 遥测停止 → τ=0.25s 插值收敛至最后目标位形后静止，模型不回退 wireframe；15s 无消息标离线
- ✅ 恢复续动 · WS 重连后从冻结位形平滑恢复运动，无跳变
- ✅ 2Hz 低频快照 + 插值 · 适配 FOCAS/OPC UA 轮询上限的交付节奏（只读监控红线不变）

#### 场景组件
- ✅ 地面网格 · Floor.tsx · SLAM 坐标系可视化 · CSS 变量桥接
- ✅ SLAM 建图叠加 · SlamMap.tsx · 障碍物渲染
- ✅ 碰撞检测 · collision.ts · AABB 包围盒 + 穿模检测埋点
- ✅ 3D 场景色彩钩子 · useScenePalette.ts · CSS 变量 → Three.js 色值桥接
- ✅ 轨迹线 · TrajectoryLine.tsx · 历史路径渲染
- ✅ 发光轨迹 · GlowTrajectory.tsx · 渐变尾迹效果
- ✅ 状态标签 · StatusBadge.tsx · 3D 空间悬浮文字 · CSS 变量主题适配
- ✅ 3D 查看器主组件 · RobotViewer.tsx · Canvas + 相机 + 灯光 + 低性能降级 + 场景色板 + 故障关节闪烁透传
- ✅ 舰队全景查看器 · [FleetViewer.tsx](file:///Users/wangwenshuai/Desktop/robot-ops-solo/robot-ops-solo/packages/digital-twin/src/FleetViewer.tsx) · 一个 Canvas 多机同屏（G1/Peanut 遥测坐标走动 + 4 工业臂产线槽位一字排开）· 单击聚焦相机飞行（指数阻尼）· 再点进单机视图 · 告警联动红脉冲光环 · autoFocusRobotId/autoFocusSeq 外部驱动 · HUD 标签

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
- ✅ 3D 孪生大屏 · TwinPage.tsx · 舰队全景（多机同屏 + 点击聚焦相机飞行）/ 单机聚焦双模式 · 一键演示（负载爬升→超载告警→AI 诊断→webhook 分发）· 告警联动聚焦（?focus=&joint=）
- ✅ 室外地图 · [FleetMapPage.tsx](file:///Users/wangwenshuai/Desktop/robot-ops-solo/robot-ops-solo/apps/web-console/src/routes/FleetMapPage.tsx) · 高德真实路线 + GPS 实时轨迹 + 地图上 3D 机器人（GCJ-02 坐标系 · AMap Key 配置检测提示）
- ✅ 设备总览 · [FleetPage.tsx](file:///Users/wangwenshuai/Desktop/robot-ops-solo/robot-ops-solo/apps/web-console/src/routes/FleetPage.tsx) · 异构设备卡片墙（地面机器人/无人机机巢/eVTOL 起降场/边缘网关 tab 筛选）
- ✅ 告警中心 · AlertsPage.tsx · 级别筛选 + 搜索 + 播报历史 · 工业告警 raw_code 徽标 + 中文描述 · 点击条目 3D 定位（跳孪生页相机飞行 + 故障关节闪烁）
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
- ✅ 一键演示状态 · [demoStore.ts](file:///Users/wangwenshuai/Desktop/robot-ops-solo/robot-ops-solo/apps/web-console/src/stores/demoStore.ts) · demo_status 帧驱动 phase/label/进度（ramp→alarm→recover→done，done 5s 后自动清场）
- ✅ 主题状态 · themeStore.ts · 深/浅主题 · localStorage 持久化

#### 服务层
- ✅ WS/MQTT 中枢 · wsHub.ts · 商用分流 + 工业分流 + OTA 分流(ota_status) + MQTT 连接 + AI 联动
- ✅ AI SaaS 对接 · aiSaaSApi.ts · fetchAIInsight/fetchAINaturalQuery · 未配置走 mock 中文摘要
- ✅ Supabase 客户端 · supabase.ts · isSupabaseEnabled 降级标志
- ✅ 机器人持久化 · robotStorage.ts · writeRobotState + getRobotTrajectory
- ✅ 告警持久化 · alertStorage.ts · writeAlert 写入 Supabase alerts 表
- ✅ 租户 CRUD · tenantStorage.ts · Supabase 启用走数据库，否则 localStorage
- ✅ SOP 存储 · sopStorage.ts · saveSop/listSops + Supabase 持久化
- ✅ 高德 JS API 封装 · [amap.ts](file:///Users/wangwenshuai/Desktop/robot-ops-solo/robot-ops-solo/apps/web-console/src/lib/amap.ts) · POI 搜索/地理编码/逆地理编码 · Key/SecurityCode 配置检测
- ✅ 高德路径规划 · [route.ts](file:///Users/wangwenshuai/Desktop/robot-ops-solo/robot-ops-solo/apps/web-console/src/lib/route.ts) · 步行/驾车路线（室外机器人走人行道）
- ✅ 品牌配置注册表 · [brandRegistry.ts](file:///Users/wangwenshuai/Desktop/robot-ops-solo/robot-ops-solo/apps/web-console/src/lib/brandRegistry.ts) · 颜色/图标/协议/分类集中管理
- ✅ 机器人类型判断 · [robotType.ts](file:///Users/wangwenshuai/Desktop/robot-ops-solo/robot-ops-solo/apps/web-console/src/lib/robotType.ts) · 工业臂/移动/协作 → 控制按钮/电量/3D 模型显隐
- ✅ 实时推送 · realtime.ts · Supabase Realtime 订阅告警
- ✅ Webhook 推送 · webhook.ts · 企微/钉钉/飞书

#### 组件层
- ✅ 侧边导航 · Sidebar.tsx · 10 路由 NavLink + WS 三态状态角标 + 主题切换
- ✅ 贴牌顶栏 · TenantBranding.tsx · 租户 Logo + 品牌色 + 当前用户信息
- ✅ 运维助手聊天面板 · [ChatPanel.tsx](file:///Users/wangwenshuai/Desktop/robot-ops-solo/robot-ops-solo/apps/web-console/src/components/ChatPanel.tsx) · 全局右下角悬浮 · runAgent 对话查状态/告警/健康分/SOP/报告 · 内置演示 SOP 模板匹配
- ✅ 异构设备卡片墙 · [RobotCards.tsx](file:///Users/wangwenshuai/Desktop/robot-ops-solo/robot-ops-solo/apps/web-console/src/components/RobotCards.tsx) · 全部/地面机器人/机巢/起降场 tab 筛选 · WS/MQTT 推帧刷新
- ✅ 无人机机巢卡片 · [DockCard.tsx](file:///Users/wangwenshuai/Desktop/robot-ops-solo/robot-ops-solo/apps/web-console/src/components/DockCard.tsx) · 机巢状态 + 无人机电量 + 健康分色
- ✅ eVTOL 起降场卡片 · [VertiportCard.tsx](file:///Users/wangwenshuai/Desktop/robot-ops-solo/robot-ops-solo/apps/web-console/src/components/VertiportCard.tsx) · 充电坪/消防/照明状态
- ✅ 实时趋势图 · [TrendChart.tsx](file:///Users/wangwenshuai/Desktop/robot-ops-solo/robot-ops-solo/apps/web-console/src/components/TrendChart.tsx) · Chart.js 折线 · 温度/负载/电流/健康分 30 点滚动
- ✅ 健康分仪表盘 · [HealthGauge.tsx](file:///Users/wangwenshuai/Desktop/robot-ops-solo/robot-ops-solo/apps/web-console/src/components/HealthGauge.tsx) · SVG 圆环四段配色
- ✅ 品牌扩展面板 · [ExtensionPanel.tsx](file:///Users/wangwenshuai/Desktop/robot-ops-solo/robot-ops-solo/apps/web-console/src/components/ExtensionPanel.tsx) · FANUC R 寄存器/KUKA 安全门等品牌专有字段
- ✅ 地图 3D 渲染器 · [MapRobotViewer.tsx](file:///Users/wangwenshuai/Desktop/robot-ops-solo/robot-ops-solo/apps/web-console/src/components/map/MapRobotViewer.tsx) · AMap.GLCustomLayer 承载 Three.js 场景（地图上 3D 机器人）
- ✅ 语音气泡 · SpeakBubble.tsx + .css · 3D 场景上方悬浮 · TTS 朗读联动
- ✅ AI 运维助手面板 · AIInsightPanel.tsx · 中文告警摘要 + 排查建议 + 健康分/寿命预测
- ✅ 组件测试 · __tests__/ · ExtensionPanel/HealthGauge/TrendChart（vitest）

### python-edge · Python 边缘驱动（工业真机）

- ✅ FANUC FOCAS 客户端 · [focas_client.py](file:///Users/wangwenshuai/Desktop/robot-ops-solo/robot-ops-solo/python-edge/fanuc_focas/focas_client.py) · ctypes fwlib32 + fanucpy
- ✅ FANUC 配置 · [config.yaml](file:///Users/wangwenshuai/Desktop/robot-ops-solo/robot-ops-solo/python-edge/fanuc_focas/config.yaml) · R 寄存器映射 + 报警码字典 + MQTT 输出
- ✅ FANUC 数据解析 · [parser.py](file:///Users/wangwenshuai/Desktop/robot-ops-solo/robot-ops-solo/python-edge/fanuc_focas/parser.py) · 原始数据 → UDM JSON（与 adapter-fanuc.ts 对齐）
- ✅ 主轮询器 · [edge-poller.py](file:///Users/wangwenshuai/Desktop/robot-ops-solo/robot-ops-solo/python-edge/edge-poller.py) · 遍历品牌配置 → 拉数据 → 转 UDM → 发 MQTT
- 📋 KUKA OPC UA 客户端 · 待实现
- 📋 埃斯顿 Modbus 客户端 · 待实现

### roboticsops-edge · Python 边缘采集（低空设备）

- ✅ 采集主循环 · [main.py](file:///Users/wangwenshuai/Desktop/robot-ops-solo/robot-ops-solo/roboticsops-edge/main.py) · mock 模式 3 采集器 → UDM payload → 发 MQTT（UTC ISO 时间戳防时区错乱）
- ✅ 大疆机场采集器 · [dji_dock_collector.py](file:///Users/wangwenshuai/Desktop/robot-ops-solo/robot-ops-solo/roboticsops-edge/collectors/dji_dock_collector.py) · 开放 API 拉机巢+无人机状态（token 提前 60s 刷新防边界过期）
- ✅ 道通机巢采集器 · [autel_dock_collector.py](file:///Users/wangwenshuai/Desktop/robot-ops-solo/robot-ops-solo/roboticsops-edge/collectors/autel_dock_collector.py)
- ✅ 起降场采集器 · [vertiport_collector.py](file:///Users/wangwenshuai/Desktop/robot-ops-solo/robot-ops-solo/roboticsops-edge/collectors/vertiport_collector.py)

### supabase · 后端

- ✅ 建表迁移 · 001_init.sql · tenants/robots/robot_states/sop_templates/alerts/webhook_configs + RLS
- ✅ 补丁迁移 · 002_patch.sql · tenants insert 策略
- ✅ SOP ID 修复 · 003_fix_sop_id_type.sql · uuid → text
- ✅ 数据保留迁移 · [004_data_retention_and_auth_fix.sql](file:///Users/wangwenshuai/Desktop/robot-ops-solo/robot-ops-solo/supabase/migrations/004_data_retention_and_auth_fix.sql) · 写入节流 5s + 30 天过期清理 + 告警去重
- ✅ 认证 RLS 修复 · 004_fix_auth_and_rls.sql
- ✅ 保留策略验证 · 005_verify_retention.sql
- ✅ Edge Function · set-tenant-claim · 注册时写入 tenant_slug 到 user_metadata

### 根目录

- ✅ Mock WS 服务器 · mock-ws-server.js · 3 端口分流（:8080 G1 避障巡航 / :8081 Peanut 往返 / :8082 工业 2Hz/台 + OTA 8s/帧）+ 一键演示剧本（/demo 触发：负载爬升→超载告警→恢复，demo_status 帧回报进度）+ /control WS 指令入口（mock-control 双向控制）
- ✅ 工业 STL 生成脚本 · [scripts/gen-industrial-stls.mjs](file:///Users/wangwenshuai/Desktop/robot-ops-solo/robot-ops-solo/scripts/gen-industrial-stls.mjs) · 程序化生成 4 品牌最小可用 mesh（官方 CAD 缺失时 URDF 直渲不降级）
- ✅ FANUC AI Prompt 包 · fanuc-ai-prompt-pack.md · 0 基础分段复制生成边缘 Python 采集代码
- ✅ 极简 mock · mock-simple.mjs · 仅 :8080 单机位移（调试用）
- ✅ 根 scripts · dev/build/test/lint/mock/dev:industrial/test:adapter-kit/build:all

### mock-control · Mock 控制面板（双向控制演示 · doc/mock-control-panel-dev-guide.md）

#### Control Service（:3000 Express + SSE）
- ✅ 状态引擎 · [state-engine.js](file:///Users/wangwenshuai/Desktop/robot-ops-solo/robot-ops-solo/mock-control/server/state-engine.js) · YAML 设备定义加载 + 内存状态树 + 遥测回写 + 关节温度驱动健康分重算
- ✅ 指令处理器 · [command-handler.js](file:///Users/wangwenshuai/Desktop/robot-ops-solo/robot-ops-solo/mock-control/server/command-handler.js) · Zod 双层校验（22 种指令类型 + 每种 params 细粒度）→ 状态应用 → 桥接下发
- ✅ 场景引擎 · [scenario-engine.js](file:///Users/wangwenshuai/Desktop/robot-ops-solo/robot-ops-solo/mock-control/server/scenario-engine.js) · 4 个预设剧本服务端推进（一键演示 9 步闭环 / 级联告警 / 故障恢复 / 全部复位双写下发）· EventEmitter 进度广播 · 执行互斥
- ✅ MQTT/WS 桥接 · [mqtt-bridge.js](file:///Users/wangwenshuai/Desktop/robot-ops-solo/robot-ops-solo/mock-control/server/mqtt-bridge.js) · MQTT 优先 + WS 直连自动降级 · 遥测回传 ingState 同步 + 告警转发
- ✅ REST 路由 · [routes/](file:///Users/wangwenshuai/Desktop/robot-ops-solo/robot-ops-solo/mock-control/server/routes) · /api/command（单发+批量）/api/devices /api/scenario（start/stop）/api/telemetry/stream（SSE）

#### Control UI（原生 JS 单页）
- ✅ 设备网格 · 6 台设备实时卡片（状态/电量/健康分）· 点击选中联动控制面板 · SSE state 帧增量更新
- ✅ 控制面板 · 生命周期启停/复位 · 工业臂关节温度滑块（J1-J6 · >60℃ 预警 >75℃ fault）· 告警码下拉触发与清空 · 模拟离线 30s · 手/自动模式切换 · 商用机显示电量滑块
- ✅ 场景剧本 · 4 按钮触发 + SSE 进度条实时推进
- ✅ 实时日志 · 状态翻转/告警广播/剧本进度 · 内存保留 200 条自动滚动

#### 测试覆盖（35 例全通过）
- ✅ 单测 30 例 · state-engine（15）+ command-handler（8）+ scenario-engine（7）
- ✅ 集成 5 例 · control-loop.test.js · UI→API→WS /control→mock-ws-server→遥测帧→状态回读完整闭环

## 变更日志

### 2026-09-09 · 路由页功能体检 + Peanut STL 化 + 3D 稳定性修复 + 订阅性能优化

- ✅ 3D 场景统一「地面得有、其他东西不能有」：保留地面（商用光洁地面+细网格 / 工业混凝土地坪），撤掉充电桩、安全标线、工业基座等全部道具；删除 [IndustrialPedestal.tsx](file:///Users/wangwenshuai/Desktop/robot-ops-solo/robot-ops-solo/packages/digital-twin/src/environment) 与 SceneAssets.tsx（已无引用），FleetViewer/RobotViewer 中工业臂改为直接落地（y=0）
- ✅ Peanut 模型 STL 化：新增 [generate-peanut-stl.mjs](file:///Users/wangwenshuai/Desktop/robot-ops-solo/robot-ops-solo/packages/digital-twin/scripts/generate-peanut-stl.mjs) 程序化生成 6 件 STL（Keenon 无公开仓库）→ `public/models/peanut/meshes/`；[robot.urdf](file:///Users/wangwenshuai/Desktop/robot-ops-solo/robot-ops-solo/apps/web-console/public/models/peanut/robot.urdf) 改 package://peanut_support 引用，PeanutBot.tsx 补 packageMap（与工业臂同管线）；尺寸与旧内联 box 版逐件一致（离地 0.07m 不变）
- ✅ 修复切路由后 3D 模型永久消失：G1 的模块级 `g1AnchorInScene` flag 与工业臂的 `!anchor.parent` 在新 Canvas 的新 scene 下判断失效 → 统一改 `anchor.parent !== scene`（Object3D.add 自动 reparent，与 PeanutBot 同模式）
- ✅ 修复切路由回来 G1 冻结（模型不动、HUD 数字却在动）：缓存命中快路径漏置 useFrame 守卫 `l1MeasuredRef`（首次由 performL1Validation 置位），补 `cachedG1L1Passed` 分支同步置位
- ✅ HUDLabel 改 drei Html `transform + sprite` 模式：修窗口 resize 时「屏幕投影+distanceFactor+occlude」分帧更新导致的标签空白/错位；distanceFactor 4→5.5 并按实测上调字号（远景工业臂卡片屏显 76~116px、字号 5~8px 偏小）；G1 标签高度 1.7→2.25m（原压脸）、Peanut 1.55→1.85m
- ✅ robotStore 订阅性能优化：`FleetRobot` 包 `React.memo`（舰队每帧重渲染 6 台→1~2 台）；TwinPage 单机模式只订当前台 + id 签名下拉、RobotCards/RobotsPage/Dashboard/OtaPage 改「壳订签名 + 行组件订单台」；Dashboard 统计改派生原始值订阅、健康卡/告警流/时间轴空态拆独立订阅组件；导出 CSV 与演示 AI 拉取改 getState 快照
- ✅ 路演健壮性：工业臂健康分改按在线/负载/告警评估（原按 batteryPct 恒 0 → 恒 40 分误读「快坏了」）、平均电量排除无电池设备、HUDLabel 工业臂电量显 N/A、WS 重连上限 10→30 次（覆盖整场演示）、BrowserRouter 补 v7 future flags 消启动警告
- ✅ 新增 [digital-twin/vitest.config.ts](file:///Users/wangwenshuai/Desktop/robot-ops-solo/robot-ops-solo/packages/digital-twin/vitest.config.ts)：显式锁定 node 环境 + test include，避免 vitest 向上查找被机器上无关 vite.config.js 劫持
- ✅ 关闭高德 JSAPI 全局注入：[index.html](file:///Users/wangwenshuai/Desktop/robot-ops-solo/robot-ops-solo/apps/web-console/index.html) 里 `_AMapSecurityConfig` 安全密钥与 `webapi.amap.com/maps` 加载标签整体注释（路由此前已隐藏）——不再每页无谓加载外部 SDK、不再外泄硬编码 key；lib/amap.ts 仅被 MapRobotViewer → FleetMapPage 链路引用，无可达页面受影响，CSP 域名条目保留待低空二期恢复
- ✅ 验证：tsc 三包 0 错误 · 33/33 步态单测通过 · web-console 生产构建成功 · 浏览器实测 Peanut mesh 数=7、造型圆润、场景无道具、TS 无报错

### 2026-09-08 · Mock 控制面板（双向控制 + 场景剧本演示）

- ✅ 新增 mock-control/ 子项目（pnpm-workspace 收录）：Control Service（Express :3000 + SSE）+ Control UI（原生 JS 单页），实现 doc/mock-control-panel-dev-guide.md 全链路——设备网格实时状态、22 种指令 Zod 校验下发、4 个路演剧本服务端推进（换浏览器 Tab 不断）、SSE 实时日志/进度推送
- ✅ mock-ws-server.js 最小侵入改造：/control WS 指令入口 + applyExternalCommand 统一路由（G1/Peanut 启停电量复位离线 · 工业臂启停/关节温度/角度/负载/告警/复位/离线）· MQTT 订阅可选（有 mosquitto 时启用）
- ✅ 修复 reset-all 只重置本地状态导致遥测帧把 error 同步回来的问题：改为逐台经 CommandHandler 下发 reset 双写（StateEngine + mock-ws-server 仿真器）
- ✅ 修复 resetDevice 工业臂 battery null 被 `?? 80` 吞掉的问题（null ?? 80 = 80 → 显示假电量），与 init 逻辑对齐用 `!== undefined` 判空
- ✅ 修复 favicon.ico 404（内联 SVG emoji data URI）
- ✅ 验证：35/35 测试通过 · 浏览器实测 UI 点击（G1 停止 moving→idle）· 级联告警 3 台 error · reset-all 全清（battery 工业臂 null）· full-demo 完整闭环（J2 88℃ fault→45℃ normal · 状态 error→working · 健康分 100）· 控制台 0 错误 0 警告 · SSE 在线


### 2026-09-07 · 架构文档补全（低空经济 + Agent 模块收录）

- ✅ README/FEATURES 与真实代码对齐：补录 robot-agent-kit（LLM 运维助手 9 工具）、低空设备全链路（aerial 适配器 3 品牌 + GPS 纠偏 + 健康分算法 + roboticsops-edge 采集器）、/fleet-map 室外地图 + /fleet 设备总览两页面、ChatPanel/DockCard/VertiportCard/RobotCards/TrendChart 等 7 组件、amap/route/brandRegistry/robotType 4 个 lib、ui-kit 5 个新组件、supabase 004/005 三个迁移、scripts/gen-industrial-stls.mjs、doc/ 目录 31 份文档全量收录
- ✅ 修正过时描述：路由 /robots→/devices、/sop/sim→/sop-sim；mock 端口分流（:8080 G1 / :8081 Peanut / :8082 工业 2Hz/台）；Sidebar 8→10 导航项；环境变量补 AMap/Agent 两组（VITE_AMAP_JS_KEY 等 3 个 + VITE_AGENT_MODE 等 5 个）

### 2026-09-07 · BP 路演三大演示功能（舰队全景 + 一键演示 + 告警 3D 联动）

- ✅ 多机同屏舰队视图：新增 [FleetViewer.tsx](file:///Users/wangwenshuai/Desktop/robot-ops-solo/robot-ops-solo/packages/digital-twin/src/FleetViewer.tsx)，一个 Canvas 同屏渲染全部机器人（G1/Peanut 遥测坐标走动 + FANUC/KUKA/ESTUN/YASKAWA 产线槽位一字排开）；单击聚焦（指数阻尼相机飞行）· 再点进单机视图 · 「返回全景」；/twin 无 id 即舰队模式
- ✅ 一键演示模式：mock 剧本注入（J2 负载爬升 22s → SRVO-023 伺服过载告警锁轴 22s → 解除恢复 12s），/demo 指令走工业通道下发；新增 [demoStore.ts](file:///Users/wangwenshuai/Desktop/robot-ops-solo/robot-ops-solo/apps/web-console/src/stores/demoStore.ts) 消费 demo_status 帧；前端横幅步骤条 + 进度条 + AI 诊断卡（真实 AI 管线）+ webhook 分发确认
- ✅ 告警→3D 联动：告警中心点击条目 → /twin?focus=&joint=&t= 跳转（关节号从消息解析 J2/关节 2/2轴）；相机飞行聚焦 + 目标机脚下红色脉冲光环 + 故障关节臂段红色 sin 脉冲闪烁（仅染该关节段，60Hz 压过 2Hz 负载色，解除自动还原原色）；聚焦机进单机视图时 joint 参数透传闪烁不断档
- ✅ 验证：tsc 0 错误 · 33 例步态单测通过 · 浏览器实测相机飞行聚焦/J2 闪烁 ei 0.25↔0.90 脉冲/光环渲染/告警解除还原原色/控制台无 JS 报错

### 2026-09-07 · 工业机器人实时同步交付（负载颜色映射 + 断连冻结）

- ✅ IndustrialRobotModel 新增关节负载颜色映射：>100% 红(#ff3d71) / >80% 黄(#ffcc00) 叠加自发光 / 正常恢复品牌原色；上色对象为关节 child link，材质按 mesh 克隆隔离（URDF 共享材质防染红整臂）
- ✅ 断连冻结策略验证通过：遥测停止 → τ=0.25s 插值收敛至最后目标位形后静止（35s 无漂移），模型不回退 wireframe，状态标「故障」；WS 重连后从冻结位形平滑续动
- ✅ mock FANUC 负载演示数据调整：J1 85%（黄档）/ J2 118%（红档），交付演示三档颜色齐备
- ✅ dev 调试句柄 `window.__industrialRobots`（仅开发环境）用于浏览器内核层级/材质验证
- ✅ 验证：FANUC 逐关节直接 mesh 颜色精确匹配预期；112 例单测全部通过（47+33+32）；tsc 0 错误

### 2026-09-07 · G1 步态三重修复 + 步态数学库抽取 + 单元测试

- ✅ 修复螃蟹步：朝向公式由 `-θ-π/2` 改为 `Ry(-θ)`（G1 URDF 前向为局部 +X，旧公式恒侧移 90°），走路/舞蹈双模式同步修正，髋轴朝向与移动方向实测偏差 73.8° → 0.0°
- ✅ 修复太空步：步频公式改为 `速度÷(2×步长)`（一个步态周期左右各迈一步）；步幅角按 `asin(步长/2/腿长)` 物理推导，视觉迈步距离 = 物理移动距离，脚不再打滑
- ✅ 修复转向抽搐：移除转向位置冻结状态机（退出转向瞬移 0.5m+），改为 τ=0.18s 连续航向跟踪 + 速度向量 EMA（滤 mock 位置舍入 ±8° 噪声）+ 实测 tick 间隔插值
- ✅ 抽取 [gaitMath.ts](file:///Users/wangwenshuai/Desktop/robot-ops-solo/robot-ops-solo/packages/digital-twin/src/robots/gaitMath.ts) 纯函数库（12 个零依赖函数），G1Humanoid useFrame 内联公式重构为函数调用
- ✅ digital-twin 新增 vitest 测试基础设施 + [gaitMath.test.ts](file:///Users/wangwenshuai/Desktop/robot-ops-solo/robot-ops-solo/packages/digital-twin/src/robots/__tests__/gaitMath.test.ts) 33 例（含旧公式步频翻倍 / 螃蟹步 90° 偏差 / 转向单帧跳变等回归防线）
- ✅ 验证：全 workspace 129 例测试通过、tsc 0 错误、浏览器实测速度零尖峰 + 步距一致性误差 7.4%

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

### 2026-08-28 · 3D 视图专业化升级（HUD 标签 + 金属地面 + 性能降级）

- ✅ 新建 HUDLabel.tsx：drei Html 3D 空间锚定，显示机器人 ID/品牌/状态/电量，distanceFactor=4 自动缩放，occlude="blending" 遮挡半透明
- ✅ Floor.tsx 升级 MeshReflectorMaterial：实时反射/镜像效果，mixStrength=1.2 金属质感，mirror=0.5
- ✅ RobotViewer 添加 AdaptiveDpr(pixelated) + AdaptiveEvents：低配设备自动降低像素比+减少事件监听
- ✅ RobotViewer 添加 Suspense 包裹机器人组件：为后续 useGLTF/URDF 异步加载预留兜底
- ✅ HUDLabel 导出到包入口 index.ts
- ✅ 浏览器验证：Floor 反射清晰可见，HUDLabel 正确锚定在机器人上方显示实时状态

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
