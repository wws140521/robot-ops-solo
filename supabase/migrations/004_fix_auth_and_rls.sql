-- ============================================================
-- 004 补丁：账号修复 + 测试账号快速创建
-- 在 Supabase SQL Editor 粘贴执行
-- ============================================================

-- 1. 确保 tenants 表有 INSERT 策略（如果之前没执行过 002_patch）
drop policy if exists "tenant_signup_insert" on tenants;
create policy "tenant_signup_insert" on tenants
  for insert with check (true);

-- 2. 确保 robots 表有 INSERT 策略（允许租户创建机器人资产）
drop policy if exists "robots_tenant_insert" on robots;
create policy "robots_tenant_insert" on robots
  for insert with check (tenant_slug = current_tenant_slug());

-- 3. 确保 alerts 表有 INSERT 策略（允许写入告警）
drop policy if exists "alerts_tenant_insert" on alerts;
create policy "alerts_tenant_insert" on alerts
  for insert with check (tenant_slug = current_tenant_slug());

-- 4. 确保 sop_templates 表有 INSERT 策略
drop policy if exists "sop_tenant_insert" on sop_templates;
create policy "sop_tenant_insert" on sop_templates
  for insert with check (tenant_slug = current_tenant_slug());

-- ============================================================
-- 查看现有测试账号状态（查询结果会显示在下方）
-- ============================================================
select
  au.id,
  au.email,
  au.confirmed_at,
  au.is_sso_user,
  au.deleted_at,
  t.name as tenant_name,
  t.slug as tenant_slug
from auth.users au
left join tenants t on t.slug = coalesce(
  au.raw_user_meta_data->>'tenant_slug',
  ''
)
where au.email in ('test@example.com', 'test_industrial@test.com')
  and au.deleted_at is null;

-- ============================================================
-- 如果上面查不到账号，说明用户不存在，需要在 Dashboard 创建
-- 如果能查到账号，说明密码不对，需要在 Dashboard 重置密码
-- ============================================================
