-- ============================================================
-- 验证脚本：数据保留策略是否生效
-- 在 Supabase SQL Editor 粘贴执行，逐段查看结果
-- ============================================================

-- ═══ 1. 检查 pg_cron 扩展是否启用 ═══
-- 预期：显示 "extname: pg_cron"
select extname, extversion from pg_extension where extname = 'pg_cron';

-- ═══ 2. 检查清理任务是否已注册 ═══
-- 预期：显示 cleanup_robot_states 和 cleanup_resolved_alerts 两条记录
select jobid, jobname, schedule, command from cron.job where jobname like 'cleanup%';

-- ═══ 3. 验证清理逻辑是否正确（用 EXPLAIN 看执行计划，不会真的删除数据）═══
-- robot_states 清理：删除 30 天前的数据
explain
select count(*) from robot_states
where created_at < now() - interval '30 days';

-- alerts 清理：删除 30 天前的已解决告警
explain
select count(*) from alerts
where resolved = true
  and resolved_at < now() - interval '30 days';

-- ═══ 4. 估算数据量（当前数据库中的数据）═══
-- 各表行数 + 预估大小
select 'robot_states' as table_name, count(*) as row_count,
  pg_size_pretty(pg_total_relation_size('robot_states')) as total_size
from robot_states
union all
select 'alerts', count(*),
  pg_size_pretty(pg_total_relation_size('alerts'))
from alerts
union all
select 'robots', count(*),
  pg_size_pretty(pg_total_relation_size('robots'))
from robots
union all
select 'sop_templates', count(*),
  pg_size_pretty(pg_total_relation_size('sop_templates'))
from sop_templates;

-- ═══ 5. 估算 30 天数据量（基于当前写入速率）═══
-- 如果有最近的 robot_states 数据，估算每日增长量
select
  count(*) as total_rows,
  count(*) filter (where created_at > now() - interval '1 hour') as rows_last_hour,
  count(*) filter (where created_at > now() - interval '1 day') as rows_last_day,
  round(count(*) filter (where created_at > now() - interval '1 day') / 1000.0, 2) as est_kb_per_day,
  round(count(*) filter (where created_at > now() - interval '1 day') / 1000.0 * 30 / 1024.0, 2) as est_mb_per_30days
from robot_states;

-- ═══ 6. 查看最旧/最新数据时间戳 ═══
select
  min(created_at) as oldest_data,
  max(created_at) as newest_data,
  now() - min(created_at) as data_age
from robot_states;

-- ═══ 7. 手动执行一次清理（如果需要立即清理旧数据，取消注释）═══
-- delete from robot_states where created_at < now() - interval '30 days';
-- delete from alerts where resolved = true and resolved_at < now() - interval '30 days';
