# robot-ops-solo 优化方案文档

> 基于代码评估结论生成 | 评估日期：2026-08-17
> 当前完善度：85/100 | 目标：97/100

---

## 一、问题总览与优先级

| # | 问题 | 优先级 | 预计工作量 | 风险等级 |
|---|------|--------|-----------|---------|
| P1 | 机器人操作按钮未接 `sendCommand`（启动/停止/回充是占位） | 🔴 高 | 2h | 功能缺失 |
| P2 | 租户管理页使用写死的 mock 数据，未接 Supabase | 🔴 高 | 4h | 数据不真实 |
| P3 | 死文件未清理（`routes/Login.tsx`、`lib/sop-storage.ts`） | 🟡 中 | 0.5h | 维护噪音 |
| P4 | web-console 主应用零测试覆盖 | 🟡 中 | 1-2d | 回归风险 |
| P5 | 告警中心未接实时推送（轮询/手动刷新） | 🟡 中 | 3h | 体验缺陷 |
| P6 | Supabase 密钥硬编码在 `.env` 且已入库检查 | 🔴 高 | 1h | 安全隐患 |
| P7 | WS 断线重连缺少指数退避和状态提示 | 🟢 低 | 2h | 稳定性 |
| P8 | 3D 孪生页在低端设备无降级方案 | 🟢 低 | 4h | 兼容性 |

---

## 二、P1：机器人操作按钮接线

**现状**：`RobotsPage.tsx` 详情面板中「启动/停止/回充」按钮无 onClick 逻辑，而 `wsHub.ts` 已具备 `sendCommand` 能力，只差最后一公里。

**优化方案**：

```tsx
// RobotsPage.tsx — 操作按钮接线示意
const { sendCommand, connectionState } = useWsHub();

const handleCommand = async (cmd: 'start' | 'stop' | 'dock') => {
  if (!selectedRobot) return;
  setCommandPending(true);
  try {
    await sendCommand({
      robotId: selectedRobot.id,
      command: cmd,
      issuedAt: Date.now(),
      issuedBy: user.id,          // 审计字段，接 Supabase auth
    });
    toast.success(`指令已下发：${cmd}`);
  } catch (e) {
    toast.error('指令下发失败，请检查连接');
  } finally {
    setCommandPending(false);
  }
};
```

**增强项**：
- 按钮增加 pending 态 + 防重复点击（`disabled={commandPending}`）
- 下发前二次确认弹窗（停止/回充为破坏性操作）
- 指令结果通过 WS 回执更新机器人状态，而非盲发
- 操作日志写入 Supabase `command_logs` 表（迁移文件 004）

**验收标准**：点击按钮 → WS 发出指令 → 机器人状态 3s 内变更 → 日志表有记录。

---

## 三、P2：租户管理页接真实数据

**现状**：`TenantsPage.tsx` 渲染硬编码数组，与后端 `tenants` 表（迁移 001 已建）脱节。

**优化方案**：

1. **数据层**：新建 `lib/tenantStorage.ts`，仿照 `robotStorage.ts` 模式：

```ts
export async function listTenants() {
  const { data, error } = await supabase
    .from('tenants')
    .select('id, name, plan, logo_url, primary_color, status, created_at')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data;
}
```

2. **权限层**：确认 RLS 策略 — 普通租户成员只能看自己的租户，`role = 'owner' | 'admin'` 才能看完整列表（迁移 005 补 policy）
3. **贴牌配置**：logo 上传走 Supabase Storage（bucket: `tenant-assets`），颜色字段直接驱动 CSS 变量
4. **UI 增强**：租户卡片加 loading skeleton、空态插画、计划（plan）到期倒计时

**验收标准**：增删改查全链路走数据库，刷新后数据持久。

---

## 四、P3：死文件清理

直接删除以下两个未被任何 import 引用的文件：

```bash
rm apps/web-console/src/routes/Login.tsx      # 被 LoginPage.tsx 取代
rm apps/web-console/src/lib/sop-storage.ts    # 被 sopStorage.ts 取代
```

删除后跑一次 `pnpm --filter web-console build` 确认无引用断裂。

> 建议顺手加 ESLint 规则 `unused-imports/no-unused-modules` 防止死文件再次堆积。

---

## 五、P4：补齐 web-console 测试

**现状**：packages 有 3 个测试文件，主应用 0 覆盖。

**优化方案**（Vitest + Testing Library，与 packages 保持一致）：

| 测试目标 | 类型 | 关键用例 |
|---------|------|---------|
| `robotStore.ts` | 单元 | 状态更新、WS 消息分发、乐观更新回滚 |
| `wsHub.ts` | 单元（mock WebSocket） | 连接、重连、sendCommand 超时 |
| `LoginPage.tsx` | 组件 | 表单校验、错误提示、登录成功跳转 |
| `SopEditor` 集成 | 组件 | 节点增删、连线、保存 JSON 导出 |
| `RobotsPage.tsx` | 组件 | 列表渲染、选中态、操作按钮 disabled 逻辑 |

**目录结构**：测试文件与源码同目录（`*.test.tsx`），`vitest.config.ts` 复用 `tsconfig.base.json` 的 paths。

**覆盖率目标**：stores + lib 层 ≥ 80%，路由页面冒烟覆盖。

---

## 六、P6：安全加固（与 P1-P2 并行做）

1. **密钥管理**：`.env` 中的 Supabase `anon key` 虽是公开密钥，但需确认：
   - RLS 已全部启用（逐表检查，不能有任何一张表裸奔）
   - Edge Function 的 `service_role` key 只存在服务端，未打进前端 bundle
2. **bundle 泄露扫描**：`pnpm build` 后 `grep -r "service_role" dist/` 必须为空
3. **CSP 头**：`index.html` 加 Content-Security-Policy meta，限制 connect-src 只允许 Supabase 域名 + WS 地址
4. **命令注入面**：`sendCommand` 的 payload 做白名单校验（只允许枚举值），拒绝任意透传

---

## 七、性能优化清单（低优先级，排期做）

| 项 | 手段 | 预期收益 |
|----|------|---------|
| 路由懒加载 | 8 个页面全部 `React.lazy` + Suspense | 首屏 bundle 减 40%+ |
| 3D 按需加载 | `@react-three/fiber` 动态 import，非孪生页不加载 | Three.js ~600KB 不进主包 |
| React Flow 虚拟化 | 大 SOP（50+ 节点）开启 `onlyRenderVisibleElements` | 编排画布流畅度 |
| WS 消息节流 | 高频遥测数据 200ms throttle 后再写 store | 减少 React 重渲染 |
| 虚拟列表 | 机器人列表 >100 台时上 `@tanstack/virtual` | 长列表滚动 60fps |
| 图片资源 | logo/图标转 WebP，`loading="lazy"` | 静态资源体积 -30% |

---

## 八、P7/P8：稳定性与兼容性

**WS 断线重连**（`wsHub.ts`）：
```
重连策略：1s → 2s → 4s → 8s → 最大 30s，指数退避 + 抖动
UI 层：连接状态角标（绿/黄/红），断线时操作按钮自动禁用并提示
```

**3D 降级方案**（`TwinPage.tsx`）：
- 检测 `navigator.hardwareConcurrency < 4` 或 WebGL 不可用 → 渲染 2D SVG 拓扑图降级视图
- `dpr={[1, 1.5]}` 限制像素比，`frameloop="demand"` 静止时停渲染

---

## 九、执行排期建议

```
第 1 天：P3 死文件清理（0.5h）→ P1 按钮接线（2h）→ P6 安全检查（1h）
第 2 天：P2 租户页接库（4h）→ P5 告警实时推送（3h）
第 3 天：P4 测试补齐（stores/lib 层优先）
第 4 天：性能优化（懒加载 + 3D 按需加载 + 虚拟列表）
第 5 天：P7/P8 稳定性 + 全量回归 + 构建验证
```

每完成一项立即 `pnpm build` 验证，小步提交，避免大颗粒变更。

---

## 十、验收总标准

- [ ] 所有操作按钮产生真实效果并有日志
- [ ] 租户页数据全持久化，RLS 生效
- [ ] `grep -r "service_role" dist/` 为空
- [ ] 测试覆盖率 stores/lib ≥ 80%，CI 全绿
- [ ] Lighthouse Performance ≥ 85，首屏 < 1.5s
- [ ] 断网重连自动恢复，UI 状态同步
