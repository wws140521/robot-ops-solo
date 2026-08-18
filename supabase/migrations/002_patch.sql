-- ============================================================
-- 002 补丁：注册流程 RLS 修正 + 开发模式免邮箱确认
-- 在 Supabase SQL Editor 粘贴执行
-- ============================================================

-- 1. 允许注册时插入租户记录（未登录用户建自己的 tenant）
--    安全性：slug 是主键防重复，免费档有租户数量软限制
drop policy if exists "tenant_signup_insert" on tenants;
create policy "tenant_signup_insert" on tenants
  for insert with check (true);

-- 2. 允许注册用户插入自己的机器人/SOP/告警记录（注册后 JWT 带 tenant_slug）
--    （001_init.sql 的 "for all" 策略已覆盖 insert，此处补 robots 的 with check）
--    实际上 001 的 "robots_tenant_isolation" for all 已含 insert，无需补
--    保留此注释说明设计

-- 3. 开发模式：关掉邮箱确认（注册即可登录，生产环境务必改回）
--    新版 Supabase 不允许 SQL 改 auth 配置，请去 Dashboard 操作：
--    Authentication → Providers → Email → 关掉 "Confirm email" 开关
-- update auth.config set mailer_autoconfirm = true where id = 'auth';
