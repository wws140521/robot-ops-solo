-- ============================================================
-- 004 补丁：数据保留策略 + 账号快速创建
-- 在 Supabase SQL Editor 粘贴执行
-- 
-- 核心优化：
--   1. robot_states 保留 30 天（5 秒节流后 30 天 ≈ 26MB，500MB 免费配额足够）
--   2. alerts 已解决的保留 30 天
--   3. pg_cron 定时任务自动清理
-- ============================================================

-- 1. 启用 pg_cron 扩展（Supabase 默认已启用，确认一下）
create extension if not exists pg_cron;

-- 2. 自动清理 robot_states 表：每天凌晨 4 点删除 30 天前的数据
--    节流优化后 30 天 ≈ 36GB，仍在 50GB Pro 配额内
select cron.schedule(
  'cleanup_robot_states',
  '0 4 * * *',
  $$
  delete from robot_states
  where created_at < now() - interval '30 days';
  $$
);

-- 3. 自动清理已解决告警：每天凌晨 4:30 删除 30 天前的已解决告警
select cron.schedule(
  'cleanup_resolved_alerts',
  '30 4 * * *',
  $$
  delete from alerts
  where resolved = true
    and resolved_at < now() - interval '30 days';
  $$
);

-- 4. 修复 RLS 策略（如果之前没执行过 002_patch）
drop policy if exists "tenant_signup_insert" on tenants;
create policy "tenant_signup_insert" on tenants
  for insert with check (true);

drop policy if exists "robots_tenant_insert" on robots;
create policy "robots_tenant_insert" on robots
  for insert with check (tenant_slug = current_tenant_slug());

drop policy if exists "alerts_tenant_insert" on alerts;
create policy "alerts_tenant_insert" on alerts
  for insert with check (tenant_slug = current_tenant_slug());

drop policy if exists "sop_tenant_insert" on sop_templates;
create policy "sop_tenant_insert" on sop_templates
  for insert with check (tenant_slug = current_tenant_slug());

-- 5. 清理已存在的旧数据（新项目可能不需要，但保险起见）
-- 只删 robot_states，保留 tenants/robots/alerts/sop_templates
-- delete from robot_states where created_at < now() - interval '7 days';

-- 6. 查看清理任务是否注册成功
select jobid, schedule, command from cron.job;
