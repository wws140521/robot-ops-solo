-- ============================================================
-- Robot-Ops-Solo · Supabase 初始化迁移
-- 对应 SUPABASE.md 第三节（建表）+ 第四节（RLS）
-- 一次性粘贴到 Supabase SQL Editor 执行
-- ============================================================

-- ============================================================
-- 1. tenants 表（贴牌租户）
-- ============================================================
create table if not exists tenants (
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
create table if not exists robots (
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

create index if not exists idx_robots_tenant on robots(tenant_slug);
create index if not exists idx_robots_brand  on robots(brand);

-- ============================================================
-- 3. robot_states 表（实时状态快照，时序数据）
-- 优化说明：
--   1. raw_msg 列保留但不再写入（体积大，调试用，改用结构化字段）
--   2. joints 列保留但不再写入（实时 3D 由 robotStore 消费，历史轨迹不需要）
--   3. 写入节流：每台机器人每 5 秒写一条（见 robotStorage.ts）
--   4. 自动清理：pg_cron 每天删除 30 天前数据（见 004 迁移）
-- ============================================================
create table if not exists robot_states (
  id            bigserial primary key,
  robot_id      text not null,
  tenant_slug   text not null,
  battery_pct   int,
  voltage       numeric(5,2),
  online        boolean default true,
  position      jsonb,                      -- {"x":1.2,"y":3.4,"theta":0.5}
  joints        jsonb,                      -- 保留列，不再写入（实时 3D 用 robotStore）
  status        text,                       -- idle / moving / working / error
  error_code    text,
  raw_msg       jsonb,                      -- 保留列，不再写入（体积大，改用结构化字段）
  created_at    timestamptz default now()
);

create index if not exists idx_states_robot_time on robot_states(robot_id, created_at desc);
create index if not exists idx_states_tenant on robot_states(tenant_slug, created_at desc);

-- 自动清理 30 天前的旧数据（Supabase timescaledb 扩展，可选）
-- select add_retention_policy('robot_states', interval '30 days');

-- ============================================================
-- 4. sop_templates 表（SOP 模板）
-- ============================================================
create table if not exists sop_templates (
  id            text primary key,              -- 业务 ID: sop-{timestamp}
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

create index if not exists idx_sop_tenant on sop_templates(tenant_slug, industry);
create index if not exists idx_sop_published on sop_templates(is_published) where is_published = true;

-- ============================================================
-- 5. alerts 表（告警记录）
-- ============================================================
create table if not exists alerts (
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

create index if not exists idx_alerts_tenant_time on alerts(tenant_slug, created_at desc);
create index if not exists idx_alerts_unresolved on alerts(tenant_slug) where resolved = false;

-- ============================================================
-- 6. webhook_configs 表（企微/钉钉/飞书告警推送配置）
-- ============================================================
create table if not exists webhook_configs (
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

drop trigger if exists trg_tenants_updated on tenants;
create trigger trg_tenants_updated before update on tenants for each row execute function touch_updated_at();

drop trigger if exists trg_robots_updated on robots;
create trigger trg_robots_updated before update on robots for each row execute function touch_updated_at();

drop trigger if exists trg_sop_updated on sop_templates;
create trigger trg_sop_updated before update on sop_templates for each row execute function touch_updated_at();

-- ============================================================
-- 开启 RLS（行级安全，多租户隔离核心）
-- ============================================================
alter table tenants          enable row level security;
alter table robots           enable row level security;
alter table robot_states     enable row level security;
alter table sop_templates    enable row level security;
alter table alerts           enable row level security;
alter table webhook_configs  enable row level security;

-- ============================================================
-- 辅助函数：从 JWT 的 user_metadata 拿当前用户的 tenant_slug
-- （注册时写入 user_metadata，见 SignUp.tsx）
-- ============================================================
create or replace function current_tenant_slug()
returns text as $$
  select coalesce(
    current_setting('request.jwt.claims', true)::json->'user_metadata'->>'tenant_slug',
    ''
  );
$$ language sql stable;

-- ============================================================
-- tenants 策略：用户只能看/改自己的租户
-- ============================================================
drop policy if exists "tenant_self_read" on tenants;
create policy "tenant_self_read" on tenants
  for select using (slug = current_tenant_slug());

drop policy if exists "tenant_self_update" on tenants;
create policy "tenant_self_update" on tenants
  for update using (slug = current_tenant_slug());

-- ============================================================
-- robots 策略
-- ============================================================
drop policy if exists "robots_tenant_isolation" on robots;
create policy "robots_tenant_isolation" on robots
  for all using (tenant_slug = current_tenant_slug())
  with check (tenant_slug = current_tenant_slug());

-- ============================================================
-- robot_states 策略
-- ============================================================
drop policy if exists "states_tenant_isolation" on robot_states;
create policy "states_tenant_isolation" on robot_states
  for all using (tenant_slug = current_tenant_slug())
  with check (tenant_slug = current_tenant_slug());

-- ============================================================
-- sop_templates 策略：租户隔离 + 已发布模板所有登录用户可读（模板市场）
-- ============================================================
drop policy if exists "sop_tenant_isolation" on sop_templates;
create policy "sop_tenant_isolation" on sop_templates
  for all using (tenant_slug = current_tenant_slug())
  with check (tenant_slug = current_tenant_slug());

drop policy if exists "sop_published_read" on sop_templates;
create policy "sop_published_read" on sop_templates
  for select using (is_published = true);

-- ============================================================
-- alerts 策略
-- ============================================================
drop policy if exists "alerts_tenant_isolation" on alerts;
create policy "alerts_tenant_isolation" on alerts
  for all using (tenant_slug = current_tenant_slug())
  with check (tenant_slug = current_tenant_slug());

-- ============================================================
-- webhook_configs 策略
-- ============================================================
drop policy if exists "webhook_tenant_isolation" on webhook_configs;
create policy "webhook_tenant_isolation" on webhook_configs
  for all using (tenant_slug = current_tenant_slug())
  with check (tenant_slug = current_tenant_slug());
