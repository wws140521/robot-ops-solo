---
name: "doc-sync"
description: "Synchronizes README.md architecture sections and FEATURES.md changelog after code changes. Invoke when user updates code, adds features, refactors structure, adds/removes files, or asks to sync docs."
---

# Doc Sync (代码变更文档同步)

代码发生变更后，自动同步更新 `README.md` 的架构章节与 `FEATURES.md` 的已实现功能清单，确保文档与代码始终一致。

## 何时触发

**必须触发**（以下任一情况完成后立即执行）：
- 新增功能模块（新适配器、新节点、新页面、新组件、新协议）
- 重构现有结构（目录迁移、文件改名、模块拆分）
- 架构变更（数据流调整、新增数据通道、状态层改造）
- 文件增删（新建/删除 .ts/.tsx/.py/.sql 文件）
- 依赖/脚本/环境变量变更（package.json scripts、.env 变量）
- 用户明确要求"同步文档"、"更新 README"、"记录功能"

**不触发**：
- 纯 bug 修复（未改变功能边界）
- 仅修改注释/格式
- 仅修改测试用例（不改被测代码的对外接口）

## 执行流程

### 第 1 步：识别变更范围

用 git diff / git status 确认本次变更影响的模块：
- adapter-kit（适配器层）
- digital-twin（3D 渲染层）
- sop-editor（SOP 编排层）
- web-console（应用层：routes/stores/lib/components/styles）
- python-edge（边缘驱动）
- supabase（后端迁移）
- 根目录（mock-ws-server / package.json / 配置）

### 第 2 步：更新 README.md

按变更影响的章节精准更新，**不要重写整个文件**：

| 变更类型 | 更新 README 章节 |
|---|---|
| 新增/删除技术栈、协议、依赖 | `## 技术栈` 表格 |
| 新增/删除/移动文件、目录 | `## 项目架构` 目录树 |
| 数据流调整、新通道、新分流 | `## 数据流架构` ASCII 图 |
| 路由变更、页面功能调整 | `## 页面路由` 表格 |
| 新增 scripts、启动方式 | `## 快速启动` |
| 新增/删除环境变量 | `## 环境变量` |
| 新增测试账号 | `## 测试账号` |

更新规则：
- 目录树中每个文件后保留简短功能注释（`# 说明`）
- ASCII 图保持对齐，新增节点用 `┌─▼─┐` 连接
- 技术栈表格按"层级 | 技术 | 说明"三列格式

### 第 3 步：更新 FEATURES.md

`FEATURES.md` 是已实现功能清单 + 变更日志，结构固定：

```
## 已实现功能

### <模块名>
- <功能点> · <状态：✅已实现 / 🚧开发中 / 📋规划中>

## 变更日志

### <YYYY-MM-DD> · <变更摘要>
- <变更点 1>
- <变更点 2>
```

更新规则：
- 新功能 → 在对应模块下追加功能点（状态标 ✅）
- 修改现有功能 → 更新描述，状态保持 ✅
- 规划中功能 → 状态标 📋（用户提到但未实现）
- 每次更新在 `## 变更日志` 顶部追加一条（最新在最上）

### 第 4 步：验证一致性

更新完成后做以下检查：
1. README 目录树中的文件路径与实际 `LS`/`Glob` 结果一致
2. FEATURES.md 中标 ✅ 的功能在代码中能 `Grep` 到对应实现
3. 环境变量列表与 `.env.example` 一致
4. scripts 列表与 `package.json` 一致

发现不一致时，以**代码为准**修正文档。

## 注意事项

- 文档语言：中文（与用户保持一致）
- 文件引用：使用 `[名称](file:///绝对路径#L行号)` 可点击链接
- 不创建多余文档：只维护 README.md + FEATURES.md 两份
- 提交规范：用户未明确要求提交 git 时不自动 commit
