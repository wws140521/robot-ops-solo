# Robot-Ops-Solo

单人前端 · 跨品牌机器人运维中台 · Monorepo

## 技术栈

| 层级 | 技术 | 说明 |
|------|------|------|
| 构建 | pnpm workspace + Vite 5 + TypeScript 5 | Monorepo 多包管理，bundler 模块解析 |
| 框架 | React 18 + React Router 6 + Zustand | 函数组件 + Hooks 状态管理 |
| 3D 渲染 | @react-three/fiber + @react-three/drei | WebGL 数字孪生，低性能设备降级 |
| SOP 编排 | @xyflow/react (React Flow 12) | 拖拽式低代码流程画布 |
| 后端 | Supabase (PostgreSQL + Auth + Realtime) | 多租户 RLS 隔离，离线 localStorage 降级 |
| 协议 | WebSocket + MQTT | 跨品牌机器人遥测与反向控制 |

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
│       │   │   │                       #     操作按钮接线 sendCommand · pending 防重复 · 破坏性二次确认
│       │   │   ├── SopPage.tsx         #   /sop SOP 编辑器 · 嵌入 sop-editor 包 + 模板保存/加载
│       │   │   ├── SopSimPage.tsx      #   /sop/sim SOP 仿真 · 无实机运行 SOP 流程预览
│       │   │   ├── TwinPage.tsx        #   /twin 3D 孪生大屏 · 全屏沉浸式 3D 场景 + 轨迹回放
│       │   │   ├── AlertsPage.tsx      #   /alerts 告警中心 · 级别筛选 + 搜索 + 播报历史
│       │   │   │                       #     AlertsPage.css 定义告警卡片/统计/列表样式
│       │   │   ├── TenantsPage.tsx     #   /tenants 租户管理 · 异步加载 tenantStorage + loading skeleton
│       │   │   │                       #     贴牌换肤预览 · plan 标签 · 主题切换入口
│       │   │   ├── LoginPage.tsx      #   /login 登录页 · Supabase Auth + 记住账号 + mock 降级
│       │   │   └── SignUp.tsx          #   /signup 注册页 · 租户标识写入 user_metadata
│       │   │
│       │   ├── stores/                 # ── 状态层（Zustand 全局状态）
│       │   │   ├── robotStore.ts       #   机器人状态 Map · updateRobot/setOffline · onlineCount 派生
│       │   │   ├── alertStore.ts       #   告警队列 · addAlert/clearAlerts · unreadCount 未读计数
│       │   │   ├── speakStore.ts       #   语音播报事件 · setSpeak + history 播报历史
│       │   │   ├── tenantStore.ts      #   当前租户 · setTenant + data-tenant 属性驱动贴牌换肤
│       │   │   └── themeStore.ts       #   深/浅主题 · data-theme 属性 · localStorage 持久化
│       │   │
│       │   ├── lib/                    # ── 服务层（数据持久化 + WS 通信 + 实时推送）
│       │   │   ├── wsHub.ts            #   WebSocket 连接中枢 · startWS/stopAllWS/sendCommand
│       │   │   │                       #     指数退避重连状态管理 · 消息分流(state/alert/speak)
│       │   │   ├── supabase.ts         #   Supabase 客户端 · isSupabaseEnabled 降级标志
│       │   │   │                       #     getCurrentTenantSlug 从 JWT 提取租户标识
│       │   │   ├── robotStorage.ts     #   机器人状态持久化 · writeRobotState + getRobotTrajectory
│       │   │   ├── alertStorage.ts     #   告警持久化 · writeAlert 写入 Supabase alerts 表
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
│       │   │       └── SpeakBubble.css #   气泡动画样式 · slideIn + fadeIn
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
│   │   │   │   └── unified.ts          #   统一状态类型 · UnifiedRobotState + UnifiedAlert
│   │   │   ├── adapters/
│   │   │   │   ├── adapter-unitree.ts  #   宇树 G1 适配 · 低级遥测帧 → 统一状态
│   │   │   │   ├── adapter-keenon.ts   #   擎朗 T9 适配 · 状态/关节映射
│   │   │   │   ├── adapter-pudutech.ts #   普渡 Peanut/Bellabot 适配
│   │   │   │   ├── adapter-agibot.ts   #   智元 X1 适配
│   │   │   │   └── index.ts            #   adaptByBrand 工厂 · 按品牌名分发
│   │   │   ├── protocol/
│   │   │   │   ├── ws-client.ts        #   WebSocket 客户端 · 指数退避重连+抖动 · 心跳
│   │   │   │   └── mqtt-client.ts      #   MQTT 客户端 · 备用协议支持
│   │   │   └── index.ts                #   包入口 · 统一导出
│   │   └── __tests__/
│   │       ├── adapter-unitree.test.ts #   宇树适配器单元测试
│   │       └── mock-pipeline.test.ts   #   mock 数据管道测试
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
│   │   │   │   └── NodeEditButton.tsx  #     节点编辑触发器 · 内联编辑入口
│   │   │   ├── sidebar/
│   │   │   │   ├── NodePalette.tsx     #   左侧节点面板 · 拖拽创建节点 · 默认数据
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
│   │   │   │   ├── G1Dog.tsx            #   宇树 G1 人形机器人 3D 模型 · 关节动画
│   │   │   │   └── PeanutBot.tsx       #   普渡花生机器人 3D 模型 · 差速驱动
│   │   │   ├── environment/
│   │   │   │   ├── Floor.tsx           #   地面网格 · SLAM 坐标系可视化
│   │   │   │   ├── SlamMap.tsx         #   SLAM 建图叠加 · 障碍物渲染
│   │   │   │   └── collision.ts       #   碰撞检测工具 · AABB 包围盒
│   │   │   ├── overlays/
│   │   │   │   ├── TrajectoryLine.tsx #   轨迹线 · 历史路径渲染
│   │   │   │   ├── GlowTrajectory.tsx  #   发光轨迹 · 渐变尾迹效果
│   │   │   │   └── StatusBadge.tsx    #   状态标签 · 3D 空间中悬浮文字
│   │   │   ├── RobotViewer.tsx         #   3D 查看器主组件 · Canvas + 相机 + 灯光 + 低性能降级
│   │   │   └── index.ts                #   包入口
│   │   └── tsconfig.json
│   │
│   └── ui-kit/                         # React 包 · 跨页面共用 UI 组件
│       ├── src/
│       │   ├── RobotCard.tsx            #   机器人卡片 · 状态色 + 电量条 + 在线指示
│       │   ├── RobotStatusCard.tsx     #   机器人状态卡 · 大尺寸详情展示
│       │   ├── BatteryGauge.tsx        #   电量仪表盘 · SVG 环形进度
│       │   ├── AlertItem.tsx            #   告警条目 · 级别图标 + 消息 + 关闭
│       │   ├── AlertCard.tsx           #   告警卡片 · 大尺寸告警展示
│       │   ├── TenantLogo.tsx          #   租户 Logo · 首字母 + 品牌色渐变
│       │   ├── ThemeProvider.tsx        #   主题 Provider · data-theme 属性注入
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
├── mock-ws-server.js                   # Mock WebSocket 服务器 · 模拟机器人遥测数据推送
├── pnpm-workspace.yaml                 # Monorepo 工作区配置 · packages/* + apps/*
├── tsconfig.base.json                  # TypeScript 基础配置 · paths alias 跨包引用
├── package.json                        # 根 package.json · dev/build/mock 脚本
├── .gitignore
├── README.md
├── robot-ops-solo-DEV-GUIDE.md          # 开发指南
├── robot-ops-solo-SOP-HOTPOT.md         # SOP 火锅店场景设计
├── robot-ops-solo-SPEAK-FEATURE.md      # 语音播报功能设计
├── robot-ops-solo-SUPABASE.md           # Supabase 后端设计
├── robot-ops-solo-UI-INSPIRATION.md     # UI 灵感参考
├── robot-ops-solo-UI-OPTIMIZATION.md    # UI 优化文档
└── robot-ops-solo-优化方案.md            # 代码优化方案
```

## 数据流架构

```
                          ┌─────────────────────────────────────┐
                          │           Mock WS Server             │
                          │   (mock-ws-server.js :8080)         │
                          └──────────────┬──────────────────────┘
                                         │ WebSocket 遥测帧
                          ┌──────────────▼──────────────────────┐
                          │         adapter-kit                  │
                          │  ws-client → adaptByBrand →          │
                          │  UnifiedRobotState / UnifiedAlert    │
                          └──────────────┬──────────────────────┘
                                         │ 统一格式
                ┌────────────────────────▼────────────────────────┐
                │                  wsHub.ts                        │
                │  消息分流：state → robotStore                   │
                │           alert → alertStore + writeAlert        │
                │           speak → speakStore + TTS              │
                │  反向控制：sendCommand(robotId, topic, payload)  │
                └──────┬──────────────┬──────────────┬───────────┘
                       │              │              │
              ┌────────▼──┐   ┌───────▼──────┐  ┌────▼─────────┐
              │ robotStore │   │ alertStore   │  │ speakStore   │
              │ (Zustand)  │   │ (Zustand)    │  │ (Zustand)    │
              └─────┬──────┘   └───────┬──────┘  └──────┬──────┘
                    │                  │                │
              ┌─────▼──────────────────▼────────────────▼──────┐
              │              React 组件树                       │
              │  Dashboard · RobotsPage · AlertsPage · TwinPage │
              │  SopPage · TenantsPage · LoginPage              │
              └─────────────────────────────────────────────────┘
                       │              │              │
              ┌────────▼────┐  ┌───────▼──────┐  ┌────▼──────┐
              │ digital-twin│  │  sop-editor   │  │  ui-kit   │
              │  3D 渲染    │  │  画布编排     │  │  共用组件  │
              └─────────────┘  └──────────────┘  └───────────┘
                       │              │              │
              ┌────────▼──────────────▼──────────────▼──────────┐
              │               Supabase (可选)                     │
              │  Auth · PostgreSQL (RLS) · Realtime · Storage    │
              │  离线降级 → localStorage                          │
              └───────────────────────────────────────────────────┘
```

## 页面路由

| 路径 | 组件 | 功能 |
|------|------|------|
| `/` | Dashboard | KPI 仪表盘 · 机器人在线数/平均电量/告警/任务 + 迷你趋势图 |
| `/robots` | RobotsPage | 机器人列表 + 3D 实时视图 + 操作面板（启动/停止/回充/重启） |
| `/robots/:id` | RobotsPage | 选中指定机器人 · URL 可分享 |
| `/sop` | SopPage | SOP 流程编排画布 · 模板保存/加载 |
| `/sop/sim` | SopSimPage | SOP 仿真运行 · 无实机预览 |
| `/twin` | TwinPage | 3D 孪生大屏 · 全屏沉浸场景 + 轨迹回放 |
| `/alerts` | AlertsPage | 告警中心 · 级别筛选 + 搜索 + 播报历史 |
| `/tenants` | TenantsPage | 租户管理 · 贴牌换肤 + 异步数据 + 主题切换 |
| `/login` | LoginPage | 登录 · Supabase Auth + mock 降级 |
| `/signup` | SignUp | 注册 · 租户标识写入 user_metadata |

## 快速启动

```bash
pnpm install
node mock-ws-server.js &
pnpm --filter web-console dev
```

打开 http://localhost:5173

## 测试账号

> 以下账号已注册在 Supabase 云端，可直接登录使用。

| 邮箱 | 密码 | 租户标识 | 租户名称 |
|------|------|---------|---------|
| test@example.com | testpass123 | testco | Test Company |

登录页勾选"记住账号"可将凭据保存在本地 localStorage，下次自动填充。

## 环境变量

```bash
# apps/web-console/.env
VITE_SUPABASE_URL=          # Supabase 项目 URL（留空走纯前端 mock 模式）
VITE_SUPABASE_ANON_KEY=     # Supabase 匿名公钥（非 service_role）
VITE_DEFAULT_TENANT=        # 默认租户标识（未登录时使用）
```

> 未配置 `VITE_SUPABASE_URL` 时，所有存储层自动降级到 localStorage，不破坏开发流程。
