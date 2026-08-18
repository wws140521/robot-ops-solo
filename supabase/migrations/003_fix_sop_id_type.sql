-- 修复 sop_templates 表 id 字段类型
-- 前端生成的 ID 是业务字符串（如 sop-1786695579171），不是 UUID
-- 必须在 Supabase SQL Editor 执行此脚本

-- 1. 把 id 从 uuid 改为 text
alter table sop_templates
  alter column id drop default,
  alter column id type text;

-- 2. 验证
select column_name, data_type from information_schema.columns
where table_name = 'sop_templates' and column_name = 'id';
