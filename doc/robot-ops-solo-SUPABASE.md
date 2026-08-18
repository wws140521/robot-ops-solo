# Robot-Ops-Solo Supabase 完整方案

> 多租户机器人运维中台的 BaaS 架构、建表、RLS、存储层代码、迁移策略
> 版本：v1.0 | 更新：2026-03

---

## 一、为什么直接用 Supabase

| 维度 | 说明 |
|------|------|
| 零运维 | 不写后端、不买服务器、不配 HTTPS |
| 内置 Auth | 邮箱/魔法链接/SSO，多租户登录免开发 |
| Postgres + jsonb | 关系查询 + SOP 图结构天然适配 |
| 行级安全（RLS） | 多租户数据隔离一行 SQL 搞定 |
| 实时订阅 | `supabase.channel()` 替代自己写 WS hub |
| 免费起步 | 500MB 库、50k MAU、1GB 存储，够用到有收入 |
| 未来可迁出 | Postgres 标准协议，数据随时 pg_dump 走人 |

**核心理念：Supabase 不是"以后再说"，它就是你的后端。**

---

## 二、项目初始化（30 分钟）

### 2.1 创建 Supabase 项目

1. 打开 https://supabase.com → 注册登录
2. 点 "New Project"
3. 填：
   - Project name: `robot-ops-solo`
   - Database password: 生成并**妥善保存**（第一次填完看不到第二次）
   - Region: 选 `Northeast Asia (Tokyo)` 或 `Singapore`（离北京近）
4. 等 2 分钟建库

### 2.2 拿到密钥

进入项目 → Settings → API：

| 字段 | 存到哪 |
|------|--------|
| Project URL | `.env` 的 `VITE_SUPABASE_URL` |
| anon public key | `.env` 的 `VITE_SUPABASE_ANON_KEY` |
| service_role key | **只存服务端**，不进前端 env |

### 2.3 前端配置

`apps/web-console/.env`：

```env
VITE_SUPABASE_URL=https://xxxxxxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIs...
```

`apps/web-console/src/lib/supabase.ts`：

```ts
import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!url || !anonKey) {
  console.warn('[Supabase] 未配置 env，走纯前端 mock 模式')
}

export const supabase = url && anonKey
  ? createClient(url, anonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
      },
      realtime: {
        params: { eventsPerSecond: 10 },
      },
    })
  : null

export const isSupabaseEnabled = !!supabase
```

---

## 三、数据库表设计（6 张表）

### 3.1 ER 图

```
tenants ──┐
          ├── robots ── alerts
          ├── sop_templates
          └── robot_states (实时快照)
```

### 3.2 完整建表 SQL

在 Supabase → SQL Editor 里**一次性粘贴执行**：

```sql
-- ============================================================
-- 1. tenants 表（贴牌租户）
-- ============================================================
create table tenants (
  slug          text primary key,            -- "laowang" / "hotpot01"
  name          text not null,               -- "老王机器人"
  logo_url      text,
  primary_color text default '#3b82f6',
  contact_name  text,
  contact_phone text,
  plan          text default 'free',         -- free / pro / enterprise
  created_at    timestamptz default now(),
  updated_at    timestamptz default now()
);

-- ============================================================
-- 2. robots 表（机器人资产）
-- ============================================================
create table robots (
  id            uuid primary key default gen_random_uuid(),
  robot_id      text not null,               -- 厂商侧唯一 ID
  name          text,                        -- "传菜一号"
  brand         text not null,               -- "unitree" / "keenon" / "pudutech"
  model         text not null,               -- "g1" / "peanut" / "bellabot2"
  tenant_slug   text not null references tenants(slug) on delete cascade,
  ws_endpoint   text,                       -- ws://... 连接地址
  mqtt_broker   text,                       -- mqtt://... 可选
  status        text default 'offline',      -- online / offline / error / charging
  battery_pct   int default 0,
  location      jsonb default '{"x":0,"y":0,"theta":0}',
  metadata      jsonb default '{}',         -- 厂商特定扩展字段
  created_at    timestamptz default now(),
  updated_at    timestamptz default now(),
  unique(tenant_slug, robot_id)             -- 同租户内 robot_id 唯一
);

create index idx_robots_tenant on robots(tenant_slug);
create index idx_robots_brand  on robots(brand);

-- ============================================================
-- 3. robot_states 表（实时状态快照，时序数据）
-- ============================================================
create table robot_states (
  id            bigserial primary key,
  robot_id      text not null,
  tenant_slug   text not null,
  battery_pct   int,
  voltage       numeric(5,2),
  online        boolean default true,
  position      jsonb,                      -- {"x":1.2,"y":3.4,"theta":0.5}
  joints        jsonb,                      -- {"hip":0.1,"knee":-0.2}
  status        text,                       -- idle / moving / working / error
  error_code    text,
  raw_msg       jsonb,                      -- 原始 WS 消息（调试用）
  created_at    timestamptz default now()
);

create index idx_states_robot_time on robot_states(robot_id, created_at desc);
create index idx_states_tenant on robot_states(tenant_slug, created_at desc);

-- 自动清理 30 天前的旧数据（可选，省存储）
-- select add_retention_policy('robot_states', interval '30 days');

-- ============================================================
-- 4. sop_templates 表（SOP 模板）
-- ============================================================
create table sop_templates (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,               -- "火锅店晚市传菜 v1"
  description   text,
  industry      text not null,               -- "hotpot" / "pharmacy" / "mall"
  brand         text not null,               -- 适配的机器人品牌
  model         text not null,               -- 适配的机型
  graph         jsonb not null,              -- SopGraph 完整 JSON
  nodes_count   int default 0,               -- 冗余字段，加速列表查询
  is_published  boolean default false,       -- 是否发布给租户使用
  version       int default 1,
  tenant_slug   text not null references tenants(slug) on delete cascade,
  created_by    uuid,                       -- auth.users.id
  created_at    timestamptz default now(),
  updated_at    timestamptz default now()
);

create index idx_sop_tenant on sop_templates(tenant_slug, industry);
create index idx_sop_published on sop_templates(is_published) where is_published = true;

-- ============================================================
-- 5. alerts 表（告警记录）
-- ============================================================
create table alerts (
  id            uuid primary key default gen_random_uuid(),
  robot_id      text not null,
  tenant_slug   text not null,
  level         text not null,               -- info / warn / error
  code          text not null,               -- "LOW_BATTERY" / "SPEAK" / "OFFLINE"
  message       text not null,
  resolved      boolean default false,
  resolved_at   timestamptz,
  resolved_by   uuid,
  metadata      jsonb default '{}',
  created_at    timestamptz default now()
);

create index idx_alerts_tenant_time on alerts(tenant_slug, created_at desc);
create index idx_alerts_unresolved on alerts(tenant_slug) where resolved = false;

-- ============================================================
-- 6. webhook_configs 表（企微/钉钉告警推送配置）
-- ============================================================
create table webhook_configs (
  id            uuid primary key default gen_random_uuid(),
  tenant_slug   text not null references tenants(slug) on delete cascade,
  name          text not null,               -- "店长手机"
  type          text not null,               -- "wechat" / "dingtalk" / "feishu"
  url           text not null,               -- webhook URL
  secret        text,                        -- 签名密钥（钉钉需要）
  events        text[] default array['error', 'warn'],  -- 触发事件级别
  enabled       boolean default true,
  created_at    timestamptz default now()
);

-- ============================================================
-- 自动更新 updated_at 的触发器
-- ============================================================
create or replace function touch_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger trg_tenants_updated   before update on tenants       for each row execute function touch_updated_at();
create trigger trg_robots_updated    before update on robots        for each row execute function touch_updated_at();
create trigger trg_sop_updated       before update on sop_templates for each row execute function touch_updated_at();
```

---

## 四、行级安全（RLS）策略

**这是多租户隔离的核心，不能省。**

```sql
-- ============================================================
-- 开启 RLS
-- ============================================================
alter table tenants          enable row level security;
alter table robots           enable row level security;
alter table robot_states     enable row level security;
alter table sop_templates    enable row level security;
alter table alerts           enable row level security;
alter table webhook_configs  enable row level security;

-- ============================================================
-- 辅助函数：从 JWT 拿当前用户的 tenant_slug
-- ============================================================
create or replace function current_tenant_slug()
returns text as $$
  select coalesce(
    current_setting('request.jwt.claims', true)::json->>'tenant_slug',
    ''
  );
$$ language sql stable;

-- ============================================================
-- tenants 策略：用户只能看自己的租户
-- ============================================================
create policy "tenant_self_read" on tenants
  for select using (slug = current_tenant_slug());

create policy "tenant_self_update" on tenants
  for update using (slug = current_tenant_slug());

-- ============================================================
-- robots 策略
-- ============================================================
create policy "robots_tenant_isolation" on robots
  for all using (tenant_slug = current_tenant_slug())
  with check (tenant_slug = current_tenant_slug());

-- ============================================================
-- robot_states 策略
-- ============================================================
create policy "states_tenant_isolation" on robot_states
  for all using (tenant_slug = current_tenant_slug())
  with check (tenant_slug = current_tenant_slug());

-- ============================================================
-- sop_templates 策略
-- ============================================================
create policy "sop_tenant_isolation" on sop_templates
  for all using (tenant_slug = current_tenant_slug())
  with check (tenant_slug = current_tenant_slug());

-- 额外：已发布的模板，所有登录用户可读（模板市场）
create policy "sop_published_read" on sop_templates
  for select using (is_published = true);

-- ============================================================
-- alerts 策略
-- ============================================================
create policy "alerts_tenant_isolation" on alerts
  for all using (tenant_slug = current_tenant_slug())
  with check (tenant_slug = current_tenant_slug());

-- ============================================================
-- webhook_configs 策略
-- ============================================================
create policy "webhook_tenant_isolation" on webhook_configs
  for all using (tenant_slug = current_tenant_slug())
  with check (tenant_slug = current_tenant_slug());
```

### 4.1 JWT 中注入 tenant_slug

Supabase Auth 默认 JWT 不含 `tenant_slug`，需要在**用户注册/登录时写入**。

**方案 A：用 Supabase Edge Function（推荐）**

```ts
// supabase/functions/set-tenant-claim/index.ts
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

serve(async (req) => {
  const { tenant_slug } = await req.json()
  const authHeader = req.headers.get('Authorization')!
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  // 用 admin API 更新用户的 app_metadata
  const userId = JSON.parse(atob(authHeader.replace('Bearer ', '').split('.')[1])).sub
  await supabase.auth.admin.updateUserById(userId, {
    app_metadata: { tenant_slug }
  })

  return new Response(JSON.stringify({ ok: true }), { headers: { 'Content-Type': 'application/json' } })
})
```

**方案 B：注册时直接写入（更简单）**

在 `lib/supabase.ts` 里注册后立刻设 metadata：

```ts
// 注册时把 tenant_slug 写进 user_metadata
export async function signUp(email: string, password: string, tenantSlug: string) {
  const { data, error } = await supabase!.auth.signUp({
    email,
    password,
    options: {
      data: { tenant_slug: tenantSlug }
    }
  })
  return { data, error }
}
```

> ⚠️ 方案 B 的 `tenant_slug` 在 `user_metadata` 里，RLS 函数要改成读 `user_metadata`：
> `current_setting('request.jwt.claims', true)::json->'user_metadata'->>'tenant_slug'`

---

## 五、存储层代码（替换原 sopStorage.ts）

### 5.1 SOP 存储层

`packages/sop-editor/src/storage/sopStorage.ts`：

```ts
import { supabase, isSupabaseEnabled } from '../../../apps/web-console/src/lib/supabase'
import type { SopGraph } from '../schema/sop-schema'

// ============================================================
// 类型
// ============================================================
export interface StoredSop {
  id: string
  name: string
  description?: string
  industry: string
  brand: string
  model: string
  graph: SopGraph
  version: number
  is_published: boolean
  updated_at: string
  created_at: string
}

// ============================================================
// 工具：拿当前 tenant_slug
// ============================================================
async function getCurrentTenantSlug(): Promise<string> {
  if (!supabase) return 'default'
  const { data: { user } } = await supabase.auth.getUser()
  return user?.user_metadata?.tenant_slug ?? 'default'
}

// ============================================================
// 保存（新建或更新）
// ============================================================
export async function saveSop(
  graph: SopGraph,
  options?: { description?: string; is_published?: boolean }
): Promise<StoredSop> {
  // 离线降级：localStorage
  if (!isSupabaseEnabled) {
    return saveSopLocal(graph, options)
  }

  const tenantSlug = await getCurrentTenantSlug()

  // 查是否已存在（按 graph.id）
  const { data: existing } = await supabase!
    .from('sop_templates')
    .select('id, version')
    .eq('id', graph.id)
    .maybeSingle()

  const payload = {
    id: graph.id,
    name: graph.name,
    description: options?.description ?? '',
    industry: graph.industry,
    brand: graph.brand,
    model: graph.model,
    graph: graph,
    nodes_count: graph.nodes.length,
    is_published: options?.is_published ?? false,
    tenant_slug: tenantSlug,
    version: (existing?.version ?? 0) + 1,
  }

  const { data, error } = await supabase!
    .from('sop_templates')
    .upsert(payload, { onConflict: 'id' })
    .select()
    .single()

  if (error) throw error
  return data as StoredSop
}

// ============================================================
// 读取单个
// ============================================================
export async function loadSop(id: string): Promise<StoredSop | null> {
  if (!isSupabaseEnabled) {
    return loadSopLocal(id)
  }

  const { data, error } = await supabase!
    .from('sop_templates')
    .select('*')
    .eq('id', id)
    .maybeSingle()

  if (error) throw error
  return data as StoredSop | null
}

// ============================================================
// 列出当前租户所有模板
// ============================================================
export async function listSops(filters?: {
  industry?: string
  brand?: string
  is_published?: boolean
}): Promise<StoredSop[]> {
  if (!isSupabaseEnabled) {
    return listSopsLocal(filters)
  }

  let query = supabase!
    .from('sop_templates')
    .select('*')
    .order('updated_at', { ascending: false })

  if (filters?.industry)    query = query.eq('industry', filters.industry)
  if (filters?.brand)       query = query.eq('brand', filters.brand)
  if (filters?.is_published !== undefined)
    query = query.eq('is_published', filters.is_published)

  const { data, error } = await query
  if (error) throw error
  return (data ?? []) as StoredSop[]
}

// ============================================================
// 删除
// ============================================================
export async function deleteSop(id: string): Promise<void> {
  if (!isSupabaseEnabled) {
    return deleteSopLocal(id)
  }

  const { error } = await supabase!
    .from('sop_templates')
    .delete()
    .eq('id', id)

  if (error) throw error
}

// ============================================================
// 发布/取消发布
// ============================================================
export async function publishSop(id: string, published: boolean): Promise<void> {
  if (!isSupabaseEnabled) return

  const { error } = await supabase!
    .from('sop_templates')
    .update({ is_published: published })
    .eq('id', id)

  if (error) throw error
}

// ============================================================
// 克隆模板（基于别人的发布模板建自己的副本）
// ============================================================
export async function cloneSop(id: string, newName?: string): Promise<StoredSop> {
  const original = await loadSop(id)
  if (!original) throw new Error('模板不存在')

  const tenantSlug = await getCurrentTenantSlug()
  const { data: { user } } = await supabase!.auth.getUser()

  const { data, error } = await supabase!
    .from('sop_templates')
    .insert({
      name: newName ?? `${original.name} (副本)`,
      description: original.description,
      industry: original.industry,
      brand: original.brand,
      model: original.model,
      graph: original.graph,
      nodes_count: original.graph.nodes.length,
      tenant_slug: tenantSlug,
      created_by: user?.id,
    })
    .select()
    .single()

  if (error) throw error
  return data as StoredSop
}

// ============================================================
// 导出为 JSON 文件（前端下载）
// ============================================================
export function exportSopFile(graph: SopGraph) {
  const blob = new Blob([JSON.stringify(graph, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${graph.name.replace(/\s+/g, '-')}-${Date.now()}.json`
  a.click()
  URL.revokeObjectURL(url)
}

// ============================================================
// 从 JSON 文件导入
// ============================================================
export function importSopFile(file: File): Promise<SopGraph> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      try {
        const graph = JSON.parse(reader.result as string)
        resolve(graph as SopGraph)
      } catch (e) { reject(e) }
    }
    reader.readAsText(file)
  })
}

// ============================================================
// ===== 离线降级：localStorage =====
// ============================================================
const LOCAL_PREFIX = 'sop:template:'

function saveSopLocal(graph: SopGraph, options?: any): StoredSop {
  const key = LOCAL_PREFIX + graph.id
  const existing = localStorage.getItem(key)
  const prev = existing ? JSON.parse(existing) : null
  const stored: StoredSop = {
    id: graph.id,
    name: graph.name,
    description: options?.description ?? '',
    industry: graph.industry,
    brand: graph.brand,
    model: graph.model,
    graph,
    version: (prev?.version ?? 0) + 1,
    is_published: options?.is_published ?? false,
    updated_at: new Date().toISOString(),
    created_at: prev?.created_at ?? new Date().toISOString(),
  }
  localStorage.setItem(key, JSON.stringify(stored))
  return stored
}

function loadSopLocal(id: string): StoredSop | null {
  const raw = localStorage.getItem(LOCAL_PREFIX + id)
  return raw ? JSON.parse(raw) : null
}

function listSopsLocal(filters?: any): StoredSop[] {
  const items: StoredSop[] = []
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i)!
    if (key.startsWith(LOCAL_PREFIX)) {
      const item = JSON.parse(localStorage.getItem(key)!)
      if (filters?.industry && item.industry !== filters.industry) continue
      if (filters?.brand && item.brand !== filters.brand) continue
      items.push(item)
    }
  }
  return items.sort((a, b) => b.updated_at.localeCompare(a.updated_at))
}

function deleteSopLocal(id: string) {
  localStorage.removeItem(LOCAL_PREFIX + id)
}
```

### 5.2 机器人状态存储层

`apps/web-console/src/lib/robotStorage.ts`：

```ts
import { supabase, isSupabaseEnabled } from './supabase'
import type { UnifiedRobotState } from 'robot-adapter-kit'

// ============================================================
// 写入实时状态（WS 收到消息后调用）
// ============================================================
export async function writeRobotState(
  state: UnifiedRobotState,
  tenantSlug: string,
  rawMsg?: any
) {
  if (!isSupabaseEnabled) return  // 离线模式不写库

  const { error } = await supabase!
    .from('robot_states')
    .insert({
      robot_id: state.robotId,
      tenant_slug: tenantSlug,
      battery_pct: state.batteryPct,
      voltage: state.voltage,
      online: state.online,
      position: state.position,
      joints: state.joints ?? null,
      status: state.status,
      error_code: state.errorCode ?? null,
      raw_msg: rawMsg ?? null,
    })

  if (error) console.error('[writeRobotState]', error)

  // 同时更新 robots 表的最新状态
  await supabase!
    .from('robots')
    .upsert({
      robot_id: state.robotId,
      brand: state.brand,
      model: state.model,
      tenant_slug: tenantSlug,
      status: state.status,
      battery_pct: state.batteryPct,
      location: state.position,
    }, { onConflict: 'tenant_slug,robot_id' })
}

// ============================================================
// 读取历史轨迹（用于 3D 大屏回放）
// ============================================================
export async function getRobotTrajectory(
  robotId: string,
  fromTime: number,
  toTime: number
) {
  if (!isSupabaseEnabled) return []

  const { data, error } = await supabase!
    .from('robot_states')
    .select('position, created_at')
    .eq('robot_id', robotId)
    .gte('created_at', new Date(fromTime).toISOString())
    .lte('created_at', new Date(toTime).toISOString())
    .order('created_at', { ascending: true })

  if (error) { console.error(error); return [] }
  return data ?? []
}

// ============================================================
// 列出当前租户所有机器人
// ============================================================
export async function listRobots() {
  if (!isSupabaseEnabled) return []

  const { data, error } = await supabase!
    .from('robots')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) { console.error(error); return [] }
  return data ?? []
}
```

### 5.3 告警存储层

`apps/web-console/src/lib/alertStorage.ts`：

```ts
import { supabase, isSupabaseEnabled } from './supabase'
import type { UnifiedAlert } from 'robot-adapter-kit'

export async function writeAlert(alert: UnifiedAlert, tenantSlug: string) {
  if (!isSupabaseEnabled) return

  const { error } = await supabase!
    .from('alerts')
    .insert({
      robot_id: alert.robotId,
      tenant_slug: tenantSlug,
      level: alert.level,
      code: alert.code,
      message: alert.message,
    })

  if (error) console.error('[writeAlert]', error)
}

export async function listAlerts(unresolvedOnly = false) {
  if (!isSupabaseEnabled) return []

  let query = supabase!
    .from('alerts')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(100)

  if (unresolvedOnly) query = query.eq('resolved', false)

  const { data, error } = await query
  if (error) { console.error(error); return [] }
  return data ?? []
}

export async function resolveAlert(alertId: string) {
  if (!isSupabaseEnabled) return

  const { error } = await supabase!
    .from('alerts')
    .update({
      resolved: true,
      resolved_at: new Date().toISOString(),
    })
    .eq('id', alertId)

  if (error) console.error('[resolveAlert]', error)
}
```

---

## 六、实时订阅（替代 WS Hub 的部分功能）

Supabase Realtime 可以直接把数据库变更推到前端，**省掉你自己维护 WS 的麻烦**。

### 6.1 启用 Realtime

在 Supabase → Database → Replication → 开启 `robot_states` 和 `alerts` 表的 realtime。

### 6.2 前端订阅

`apps/web-console/src/lib/realtime.ts`：

```ts
import { supabase } from './supabase'
import { useRobotStore } from '../stores/robotStore'
import { useAlertStore } from '../stores/alertStore'

export function subscribeRobotStates(robotId: string) {
  return supabase!
    .channel(`robot:${robotId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'robot_states',
        filter: `robot_id=eq.${robotId}`,
      },
      (payload) => {
        const row = payload.new
        useRobotStore.getState().updateRobot(robotId, {
          robotId,
          brand: row.brand ?? 'unknown',
          model: row.model ?? 'unknown',
          batteryPct: row.battery_pct ?? 0,
          voltage: row.voltage ?? 0,
          online: row.online ?? true,
          position: row.position ?? { x: 0, y: 0, theta: 0 },
          joints: row.joints ?? undefined,
          status: row.status ?? 'idle',
          errorCode: row.error_code ?? undefined,
          lastSeen: new Date(row.created_at).getTime(),
        })
      }
    )
    .subscribe()
}

export function subscribeAlerts(onNewAlert: (alert: any) => void) {
  return supabase!
    .channel('alerts:new')
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'alerts',
      },
      (payload) => {
        onNewAlert(payload.new)
      }
    )
    .subscribe()
}
```

### 6.3 在 App.tsx 里启动

```tsx
// apps/web-console/src/App.tsx
import { useEffect } from 'react'
import { subscribeAlerts } from './lib/realtime'
import { useAlertStore } from './stores/alertStore'

export default function App() {
  useEffect(() => {
    const channel = subscribeAlerts((alert) => {
      useAlertStore.getState().addAlert(alert)
      // 同时触发企微推送（如果配了 webhook）
      pushWebhook(alert)
    })
    return () => { supabase?.removeChannel(channel) }
  }, [])

  // ... 其余不变
}
```

---

## 七、Webhook 告警推送（企微/钉钉）

`apps/web-console/src/lib/webhook.ts`：

```ts
import { supabase, isSupabaseEnabled } from './supabase'

interface AlertPayload {
  level: string
  code: string
  message: string
  robot_id: string
}

// ============================================================
// 查当前租户启用的 webhook 配置
// ============================================================
async function getActiveWebhooks(level: string) {
  if (!isSupabaseEnabled) return []

  const { data, error } = await supabase!
    .from('webhook_configs')
    .select('*')
    .eq('enabled', true)
    .contains('events', [level])

  if (error) { console.error(error); return [] }
  return data ?? []
}

// ============================================================
// 发送告警到企微/钉钉
// ============================================================
export async function pushWebhook(alert: AlertPayload) {
  const webhooks = await getActiveWebhooks(alert.level)

  for (const wh of webhooks) {
    try {
      let body: any

      if (wh.type === 'wechat') {
        // 企业微信机器人
        body = {
          msgtype: 'markdown',
          markdown: {
            content: `## 🤖 机器人告警\n> **机器人**: ${alert.robot_id}\n> **级别**: ${alert.level}\n> **内容**: ${alert.message}\n> **时间**: ${new Date().toLocaleString('zh-CN')}`,
          },
        }
      } else if (wh.type === 'dingtalk') {
        // 钉钉机器人（需签名，此处简化版）
        body = {
          msgtype: 'markdown',
          markdown: {
            title: '机器人告警',
            text: `## 🤖 机器人告警\n\n- **机器人**: ${alert.robot_id}\n- **级别**: ${alert.level}\n- **内容**: ${alert.message}`,
          },
        }
      } else if (wh.type === 'feishu') {
        // 飞书机器人
        body = {
          msg_type: 'interactive',
          card: {
            header: { title: { content: '🤖 机器人告警', tag: 'plain_text' } },
            elements: [{
              tag: 'div',
              text: {
                content: `**机器人**: ${alert.robot_id}\n**级别**: ${alert.level}\n**内容**: ${alert.message}`,
                tag: 'lark_md',
              },
            }],
          },
        }
      } else {
        continue
      }

      await fetch(wh.url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
    } catch (err) {
      console.error(`[webhook:${wh.type}] 推送失败`, err)
    }
  }
}
```

---

## 八、Auth 页面（登录/注册）

### 8.1 登录页

`apps/web-console/src/routes/Login.tsx`：

```tsx
import { useState } from 'react'
import { supabase } from '../lib/supabase'

export function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const { error } = await supabase!.auth.signInWithPassword({ email, password })
    if (error) setError(error.message)
    else window.location.href = '/'

    setLoading(false)
  }

  async function handleMagicLink(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    const { error } = await supabase!.auth.signInWithOtp({ email })
    if (error) setError(error.message)
    else setError('✅ 魔法链接已发送，请查收邮箱')
    setLoading(false)
  }

  return (
    <div style={{
      display: 'flex', justifyContent: 'center', alignItems: 'center',
      height: '100vh', background: '#0f172a', color: 'white'
    }}>
      <form onSubmit={handleLogin} style={{
        background: '#1e293b', padding: 32, borderRadius: 16,
        width: 360, display: 'flex', flexDirection: 'column', gap: 16
      }}>
        <h2 style={{ margin: 0, textAlign: 'center' }}>🤖 Robot Ops 登录</h2>

        <input
          type="email" placeholder="邮箱" required
          value={email} onChange={e => setEmail(e.target.value)}
          style={{ padding: 12, borderRadius: 8, border: 'none', fontSize: 14 }}
        />
        <input
          type="password" placeholder="密码" required
          value={password} onChange={e => setPassword(e.target.value)}
          style={{ padding: 12, borderRadius: 8, border: 'none', fontSize: 14 }}
        />

        {error && <div style={{ color: '#f87171', fontSize: 13 }}>{error}</div>}

        <button type="submit" disabled={loading} style={{
          padding: 12, borderRadius: 8, border: 'none',
          background: '#3b82f6', color: 'white', fontSize: 15, cursor: 'pointer'
        }}>
          {loading ? '登录中...' : '登录'}
        </button>

        <button type="button" onClick={handleMagicLink} disabled={loading} style={{
          padding: 12, borderRadius: 8, border: '1px solid #475569',
          background: 'transparent', color: 'white', fontSize: 14, cursor: 'pointer'
        }}>
          发送魔法链接（免密登录）
        </button>
      </form>
    </div>
  )
}
```

### 8.2 注册页（含 tenant_slug 绑定）

`apps/web-console/src/routes/SignUp.tsx`：

```tsx
import { useState } from 'react'
import { supabase } from '../lib/supabase'

export function SignUp() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [tenantSlug, setTenantSlug] = useState('')
  const [tenantName, setTenantName] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')

  async function handleSignUp(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setMessage('')

    // 1. 创建 auth 用户，tenant_slug 写入 user_metadata
    const { data, error } = await supabase!.auth.signUp({
      email,
      password,
      options: {
        data: { tenant_slug: tenantSlug }
      }
    })

    if (error) { setMessage(error.message); setLoading(false); return }

    // 2. 在 tenants 表插入租户记录
    const { error: tenantError } = await supabase!
      .from('tenants')
      .insert({
        slug: tenantSlug,
        name: tenantName,
        primary_color: '#3b82f6',
      })

    if (tenantError) {
      setMessage('注册成功但租户创建失败：' + tenantError.message)
    } else {
      setMessage('✅ 注册成功！请查收验证邮件后登录')
    }

    setLoading(false)
  }

  return (
    <div style={{
      display: 'flex', justifyContent: 'center', alignItems: 'center',
      height: '100vh', background: '#0f172a', color: 'white'
    }}>
      <form onSubmit={handleSignUp} style={{
        background: '#1e293b', padding: 32, borderRadius: 16,
        width: 400, display: 'flex', flexDirection: 'column', gap: 16
      }}>
        <h2 style={{ margin: 0, textAlign: 'center' }}>🚀 创建账号</h2>

        <input type="email" placeholder="邮箱" required value={email}
          onChange={e => setEmail(e.target.value)}
          style={{ padding: 12, borderRadius: 8, border: 'none' }} />

        <input type="password" placeholder="密码（至少 6 位）" required value={password}
          onChange={e => setPassword(e.target.value)}
          style={{ padding: 12, borderRadius: 8, border: 'none' }} />

        <input placeholder="租户标识（英文，如 laowang）" required value={tenantSlug}
          onChange={e => setTenantSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
          style={{ padding: 12, borderRadius: 8, border: 'none' }} />

        <input placeholder="租户名称（如 老王机器人）" required value={tenantName}
          onChange={e => setTenantName(e.target.value)}
          style={{ padding: 12, borderRadius: 8, border: 'none' }} />

        {message && <div style={{ color: '#34d399', fontSize: 13 }}>{message}</div>}

        <button type="submit" disabled={loading} style={{
          padding: 12, borderRadius: 8, border: 'none',
          background: '#3b82f6', color: 'white', fontSize: 15, cursor: 'pointer'
        }}>
          {loading ? '创建中...' : '创建账号'}
        </button>
      </form>
    </div>
  )
}
```

---

## 九、文件清单（新建 + 修改）

### 新建文件

| 文件 | 用途 |
|------|------|
| `apps/web-console/.env` | Supabase URL + anon key |
| `apps/web-console/src/lib/supabase.ts` | Supabase 客户端 + 开关判断 |
| `apps/web-console/src/lib/robotStorage.ts` | 机器人状态读写 |
| `apps/web-console/src/lib/alertStorage.ts` | 告警读写 |
| `apps/web-console/src/lib/webhook.ts` | 企微/钉钉/飞书推送 |
| `apps/web-console/src/lib/realtime.ts` | Supabase Realtime 订阅 |
| `apps/web-console/src/routes/Login.tsx` | 登录页 |
| `apps/web-console/src/routes/SignUp.tsx` | 注册页 |
| `packages/sop-editor/src/storage/sopStorage.ts` | SOP 存储（Supabase + localStorage 降级）|
| `supabase/migrations/001_init.sql` | 建表 + RLS SQL |
| `supabase/functions/set-tenant-claim/index.ts` | Edge Function（JWT 注入 tenant_slug）|

### 修改文件

| 文件 | 改什么 |
|------|--------|
| `apps/web-console/src/App.tsx` | 启动 realtime 订阅 + 路由保护 |
| `apps/web-console/src/lib/wsHub.ts` | WS 收到消息后额外调 `writeRobotState` + `writeAlert` |
| `apps/web-console/src/stores/robotStore.ts` | 初始化时从 Supabase 加载机器人列表 |
| `packages/sop-editor/src/SopEditor.tsx` | 保存按钮调 `saveSop` + 加载按钮调 `listSops` |

---

## 十、操作步骤（按顺序）

### Step 1：建 Supabase 项目（30 分钟）
→ 见第二节

### Step 2：执行建表 SQL（10 分钟）
→ 复制第三节的 SQL → Supabase SQL Editor → Run

### Step 3：执行 RLS 策略（10 分钟）
→ 复制第四节的 SQL → Run

### Step 4：配置 .env（5 分钟）
→ 复制 `.env.example` 为 `.env` → 填入 URL 和 anon key

### Step 5：安装依赖（5 分钟）
```bash
pnpm add @supabase/supabase-js
```

### Step 6：逐个创建文件（1-2 小时）
→ 按第九节清单，从 `lib/supabase.ts` 开始

### Step 7：改 wsHub.ts（30 分钟）
→ 在收到消息的 handler 里加 `writeRobotState` + `writeAlert` 调用

### Step 8：部署 Edge Function（20 分钟）
```bash
# 安装 Supabase CLI
npm install -g supabase
supabase login
supabase link --project-ref xxxxxxxxx
supabase functions deploy set-tenant-claim
```

### Step 9：测试（30 分钟）
1. 打开 `/signup` → 注册账号 → 验证邮箱
2. 登录 → 看到空 Dashboard
3. 启动 mock-ws-server.js → 数据写入 `robot_states` 表
4. Supabase 控制台 → Table Editor → 看到数据流入
5. 打开 SOP 画布 → 拖节点 → 保存 → 刷新页面 → 数据还在（从 Supabase 加载）

---

## 十一、验证清单

| # | 验证项 | 怎么验 |
|---|--------|--------|
| 1 | Supabase 连接成功 | 控制台无 `[Supabase] 未配置` 警告 |
| 2 | 注册账号 | `/signup` 填表 → 收到验证邮件 |
| 3 | 登录态持久 | 刷新页面不丢登录 |
| 4 | RLS 生效 | 用租户 A 的账号只能看到 A 的数据 |
| 5 | WS 数据写入 | mock 推消息 → `robot_states` 表有新行 |
| 6 | Realtime 推送 | 前端不开 WS，仅靠 realtime 收到状态更新 |
| 7 | SOP 保存 | 画布保存 → 刷新 → 数据还在 |
| 8 | SOP 多版本 | 改同一模板再保存 → version 自增 |
| 9 | 告警写入 | 电量 < 20% → `alerts` 表有新行 |
| 10 | Webhook 推送 | 配企微机器人 URL → 告警时群收到消息 |
| 11 | 离线降级 | 故意填错 anon key → localStorage 模式正常工作 |
| 12 | 数据导出 | SOP 导出 .json 文件可下载 |

---

## 十二、成本估算

| 项目 | 免费额度 | 超出后 |
|------|---------|--------|
| 数据库存储 | 500 MB | $0.125/GB/月 |
| 月活用户 | 50,000 | $25/1k MAU |
| 实时连接 | 200 并发 | $10/100 并发 |
| 存储带宽 | 5 GB/月 | $0.09/GB |
| Edge Functions | 500k 次/月 | $2/10k 次 |

**单人起步到第一个付费客户：完全免费。**
**10 个租户、每家 5 台机器人：约 $10-25/月。**

---

## 十三、备份与迁移

### 自动备份
Supabase 自动每日备份（免费版保留 7 天，Pro 版保留 30 天）。

### 手动导出
```bash
# 安装 Supabase CLI
supabase db dump --linked > backup-$(date +%Y%m%d).sql
```

### 迁出 Supabase
```bash
# 导出为纯 Postgres dump
supabase db dump --linked --data-only > data.sql
# 导入到任何 Postgres 实例
psql -d your_new_db -f data.sql
```

**你不会被锁死。**

---

## 十四、常见问题

**Q：RLS 策略写错了导致所有数据读不到怎么办？**
A：Supabase SQL Editor 里 `disable row level security;` 临时关掉调试，修好再开。

**Q：实时订阅收不到消息？**
A：检查三处：① 表是否开启了 replication ② `supabase.channel()` 的 filter 语法是否正确 ③ anon key 是否有 select 权限。

**Q：service_role key 泄露了怎么办？**
A：Supabase → Settings → API → 点 "regenerate" 重置。同时检查数据库是否有异常操作。

**Q：10 万条 robot_states 后查询变慢？**
A：给 `robot_states` 加分区表（按月份），或只保留 30 天数据 + 聚合统计表。

**Q：客户要求数据存在自己服务器？**
A：Supabase 可自托管（Docker 一键部署），或 pg_dump 导出给他。你的代码只需改 URL 和 key。

---

## 十五、总结

| 问题 | 答案 |
|------|------|
| 为什么直接用 Supabase | 零运维后端、内置 Auth/RLS/Realtime、免费起步 |
| 离线能用吗 | 能，所有存储层都有 localStorage 降级 |
| 多租户安全吗 | RLS 行级隔离，每个租户只看自己的数据 |
| 以后能迁出吗 | 标准 Postgres，pg_dump 随时走 |
| 现在该做什么 | 建项目 → 跑 SQL → 配 .env → 改 wsHub → 测试 |

**接下来你的动作：**
1. 建 Supabase 项目（30 分钟）
2. 跑建表 + RLS 的 SQL（20 分钟）
3. 按第九节清单逐个建文件
4. 注册第一个账号 → 看到数据流入 → **你的中台正式有"后端"了**

> 文档版本：v1.0 | 适用：Supabase 2026 最新版 + React 18 + Vite 5
> 更新日期：2026-03
