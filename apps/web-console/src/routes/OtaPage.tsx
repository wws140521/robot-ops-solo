// 2026-08-21 创建 OTA 管理页，实现设备升级控制+进度展示+前置校验+日志
// 对应《前端开发文档》第 7 节 UI 结构 + 第 9 节容错优化
import { useEffect, useMemo } from 'react'
import { GlassCard, NeonBadge, StatusDot } from 'ui-kit'
import { useOtaStore, triggerMockFail, type OtaState } from '../stores/otaStore'
import { useRobotStore } from '../stores/robotStore'
import { Download, CheckCircle, XCircle, Loader, AlertTriangle, RefreshCw, Eraser } from 'lucide-react'

// 2026-08-21 状态 → 颜色/图标映射（前端开发文档第 5 节）
const STATE_CONFIG: Record<OtaState, { color: string; icon: typeof Download; label: string }> = {
  idle:        { color: 'var(--text-tertiary)',  icon: Download,     label: '待升级' },
  pending:    { color: 'var(--status-working)', icon: Loader,        label: '等待响应' },
  downloading:{ color: 'var(--status-online)',  icon: Loader,        label: '下载中' },
  upgrading:  { color: 'var(--primary)',         icon: Loader,        label: '升级中' },
  success:    { color: 'var(--status-online)',  icon: CheckCircle,   label: '升级成功' },
  fail:       { color: 'var(--status-error)',   icon: XCircle,       label: '升级失败' },
}

function ProgressBar({ value, state }: { value: number; state: OtaState }) {
  const color = STATE_CONFIG[state].color
  return (
    <div
      style={{
        width: '100%',
        height: 8,
        background: 'var(--bg-elev-3)',
        borderRadius: 4,
        overflow: 'hidden',
        marginTop: 8,
      }}
    >
      <div
        style={{
          width: `${value}%`,
          height: '100%',
          background: color,
          borderRadius: 4,
          transition: 'width 0.5s ease',
          boxShadow: state === 'upgrading' || state === 'downloading'
            ? `0 0 8px ${color}`
            : 'none',
        }}
      />
    </div>
  )
}

function OtaStatusCard({ robotId }: { robotId: string }) {
  const status = useOtaStore((s) => s.statuses[robotId])
  const robot = useRobotStore((s) => s.robots[robotId])
  const startUpgrade = useOtaStore((s) => s.startUpgrade)
  const availableVersion = useOtaStore((s) => s.availableVersion)
  const preCheck = useOtaStore((s) => s.preCheck)

  const checkResult = useMemo(() => preCheck(robotId), [robotId, robot?.online, robot?.batteryPct, robot?.status])
  const config = status ? STATE_CONFIG[status.state] : STATE_CONFIG.idle
  const Icon = config.icon
  const isUpgrading = status && ['pending', 'downloading', 'upgrading'].includes(status.state)

  return (
    <GlassCard style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* 设备信息 + 版本号 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <StatusDot status={robot?.online ? 'online' : 'offline'} />
          <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>
            {robotId}
          </span>
          <NeonBadge brand={robot?.brand ?? 'unknown'} />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--text-muted)' }}>
          <span>当前: <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}>{robot?.model ?? '—'}</span></span>
          <span>→</span>
          <span>可升级: <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--primary)' }}>{availableVersion}</span></span>
        </div>
      </div>

      {/* 进度条 + 状态文字 */}
      {status && status.state !== 'idle' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Icon size={14} style={{ color: config.color }} />
              <span style={{ fontSize: 13, fontWeight: 500, color: config.color }}>
                {config.label}
              </span>
            </div>
            <span style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>
              {status.progress}%
            </span>
          </div>
          <ProgressBar value={status.progress} state={status.state} />
          {status.errorMsg && (
            <div style={{ marginTop: 6, fontSize: 12, color: 'var(--status-error)', display: 'flex', gap: 4 }}>
              <AlertTriangle size={12} style={{ flexShrink: 0, marginTop: 2 }} />
              {status.errorMsg}
            </div>
          )}
        </div>
      )}

      {/* 前置校验提示 */}
      {!status && !checkResult.ok && (
        <div style={{ fontSize: 12, color: 'var(--status-working)', display: 'flex', gap: 4 }}>
          <AlertTriangle size={12} style={{ flexShrink: 0, marginTop: 2 }} />
          {checkResult.reasons.join('、')}
        </div>
      )}

      {/* 操作按钮 */}
      <div style={{ display: 'flex', gap: 8 }}>
        <button
          onClick={() => startUpgrade(robotId)}
          disabled={isUpgrading || !checkResult.ok}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '8px 16px',
            borderRadius: 'var(--radius-sm)',
            border: `1px solid ${isUpgrading || !checkResult.ok ? 'var(--border-subtle)' : 'var(--primary)'}`,
            background: isUpgrading || !checkResult.ok ? 'transparent' : 'var(--primary-dim)',
            color: isUpgrading || !checkResult.ok ? 'var(--text-disabled)' : 'var(--primary)',
            fontSize: 13,
            fontWeight: 600,
            cursor: isUpgrading || !checkResult.ok ? 'not-allowed' : 'pointer',
            transition: 'all 0.2s var(--ease-out)',
          }}
        >
          <Download size={14} />
          {isUpgrading ? '升级中...' : '一键升级'}
        </button>

        {/* 模拟失败按钮（演示容错交互，前端开发文档第 8 节） */}
        {isUpgrading && (
          <button
            onClick={() => triggerMockFail(robotId)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '8px 12px',
              borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--status-error)',
              background: 'transparent',
              color: 'var(--status-error)',
              fontSize: 12,
              cursor: 'pointer',
              opacity: 0.7,
            }}
          >
            <XCircle size={12} />
            模拟失败
          </button>
        )}

        {/* 重试按钮 */}
        {status?.state === 'fail' && (
          <button
            onClick={() => startUpgrade(robotId)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '8px 16px',
              borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--primary)',
              background: 'transparent',
              color: 'var(--primary)',
              fontSize: 13,
              fontWeight: 500,
              cursor: 'pointer',
            }}
          >
            <RefreshCw size={14} />
            重试
          </button>
        )}
      </div>
    </GlassCard>
  )
}

function OtaLogList() {
  const logs = useOtaStore((s) => s.logs)
  const clearLogs = useOtaStore((s) => s.clearLogs)

  const levelColor: Record<string, string> = {
    info: 'var(--text-muted)',
    warn: 'var(--status-working)',
    error: 'var(--status-error)',
  }

  return (
    <GlassCard style={{ padding: 16, flex: 1, overflow: 'auto', maxHeight: 400 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>升级操作日志</span>
        <button
          onClick={clearLogs}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            padding: '4px 10px',
            borderRadius: 'var(--radius-sm)',
            border: '1px solid var(--border-subtle)',
            background: 'transparent',
            color: 'var(--text-tertiary)',
            fontSize: 11,
            cursor: 'pointer',
          }}
        >
          <Eraser size={11} />
          清空
        </button>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {logs.length === 0 ? (
          <span style={{ fontSize: 12, color: 'var(--text-disabled)', padding: '20px 0', textAlign: 'center' }}>
            暂无日志
          </span>
        ) : (
          logs.map((log, i) => (
            <div
              key={i}
              style={{
                display: 'flex',
                gap: 8,
                fontSize: 12,
                fontFamily: 'var(--font-mono)',
                padding: '4px 0',
                borderBottom: i < logs.length - 1 ? '1px solid var(--border-subtle)' : 'none',
              }}
            >
              <span style={{ color: 'var(--text-disabled)', flexShrink: 0 }}>
                {new Date(log.timestamp).toLocaleTimeString()}
              </span>
              <span style={{ color: 'var(--text-tertiary)', flexShrink: 0, width: 120, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {log.robotId}
              </span>
              <span style={{ color: levelColor[log.level] ?? 'var(--text-muted)' }}>
                {log.message}
              </span>
            </div>
          ))
        )}
      </div>
    </GlassCard>
  )
}

export function OtaPage() {
  const robots = useRobotStore((s) => s.robots)
  const statuses = useOtaStore((s) => s.statuses)
  const availableVersion = useOtaStore((s) => s.availableVersion)

  const robotIds = Object.keys(robots)
  const activeCount = Object.values(statuses).filter(
    (s) => ['pending', 'downloading', 'upgrading'].includes(s.state)
  ).length
  const successCount = Object.values(statuses).filter((s) => s.state === 'success').length
  const failCount = Object.values(statuses).filter((s) => s.state === 'fail').length

  // 2026-08-21 批量升级：仅对通过前置校验的设备下发
  const batchUpgrade = () => {
    const store = useOtaStore.getState()
    robotIds.forEach((id) => {
      const check = store.preCheck(id)
      if (check.ok) {
        store.startUpgrade(id)
      }
    })
  }

  // 2026-08-21 批量升级按钮 disabled 条件
  const batchDisabled = activeCount > 0 || robotIds.length === 0

  return (
    <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 20, height: '100%', overflow: 'auto' }}>
      {/* 页头 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
            OTA 升级管理
          </h2>
          <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '4px 0 0' }}>
            轻量 OTA · 仅升级边缘网关软件 · 绝不升级机器人控制器固件
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <span style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            padding: '2px 10px',
            border: '1px solid var(--primary)',
            borderRadius: 999,
            fontSize: 12,
            background: 'rgba(255,255,255,0.04)',
            color: 'var(--primary)',
          }}>
            可升级版本 {availableVersion}
          </span>
          <button
            onClick={batchUpgrade}
            disabled={batchDisabled}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '8px 16px',
              borderRadius: 'var(--radius-sm)',
              border: `1px solid ${batchDisabled ? 'var(--border-subtle)' : 'var(--primary)'}`,
              background: batchDisabled ? 'transparent' : 'var(--primary-dim)',
              color: batchDisabled ? 'var(--text-disabled)' : 'var(--primary)',
              fontSize: 13,
              fontWeight: 600,
              cursor: batchDisabled ? 'not-allowed' : 'pointer',
            }}
          >
            <Download size={14} />
            批量升级（{robotIds.length} 台）
          </button>
        </div>
      </div>

      {/* 统计栏 */}
      <div style={{ display: 'flex', gap: 12 }}>
        <GlassCard style={{ padding: 12, flex: 1, textAlign: 'center' }}>
          <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>
            {robotIds.length}
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>设备总数</div>
        </GlassCard>
        <GlassCard style={{ padding: 12, flex: 1, textAlign: 'center' }}>
          <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--primary)', fontFamily: 'var(--font-mono)' }}>
            {activeCount}
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>升级中</div>
        </GlassCard>
        <GlassCard style={{ padding: 12, flex: 1, textAlign: 'center' }}>
          <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--status-online)', fontFamily: 'var(--font-mono)' }}>
            {successCount}
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>成功</div>
        </GlassCard>
        <GlassCard style={{ padding: 12, flex: 1, textAlign: 'center' }}>
          <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--status-error)', fontFamily: 'var(--font-mono)' }}>
            {failCount}
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>失败</div>
        </GlassCard>
      </div>

      {/* 设备卡片列表 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: 12 }}>
        {robotIds.length === 0 ? (
          <GlassCard style={{ padding: 40, textAlign: 'center', gridColumn: '1 / -1' }}>
            <span style={{ color: 'var(--text-muted)', fontSize: 14 }}>
              暂无设备，请先在机器人页面添加设备
            </span>
          </GlassCard>
        ) : (
          robotIds.map((id) => <OtaStatusCard key={id} robotId={id} />)
        )}
      </div>

      {/* 升级日志 */}
      <OtaLogList />
    </div>
  )
}
