import { useState, useEffect } from 'react'
import type { SopNode } from '../schema/sop-schema'

interface FieldDef {
  key: string
  label: string
  type: 'text' | 'number' | 'select' | 'checkbox'
  options?: string[]
}

// 每种节点类型可编辑的字段配置
const FIELDS: Record<string, FieldDef[]> = {
  boot: [
    { key: 'label', label: '名称', type: 'text' },
    { key: 'action', label: '动作', type: 'text' },
    { key: 'timeout', label: '超时(秒)', type: 'number' },
    { key: 'onFail', label: '失败处理', type: 'text' },
  ],
  move: [
    { key: 'label', label: '名称', type: 'text' },
    { key: 'target', label: '目标航点', type: 'text' },
    { key: 'speed', label: '速度(m/s)', type: 'number' },
    { key: 'waitForCharge', label: '等待充电', type: 'checkbox' },
    { key: 'chargeTarget', label: '充电目标(%)', type: 'number' },
    { key: 'chargeMinutes', label: '充电时长(分)', type: 'number' },
    { key: 'avoidPedestrian', label: '避让行人', type: 'checkbox' },
    { key: 'minDistance', label: '最小距离(m)', type: 'number' },
    { key: 'x', label: 'X(简版)', type: 'number' },
    { key: 'y', label: 'Y(简版)', type: 'number' },
  ],
  wait: [
    { key: 'label', label: '名称', type: 'text' },
    { key: 'seconds', label: '等待(秒)', type: 'number' },
    { key: 'trigger', label: '触发条件', type: 'text' },
    { key: 'timeout', label: '超时(秒)', type: 'number' },
  ],
  pickup: [
    { key: 'label', label: '名称', type: 'text' },
    { key: 'checkWeight', label: '检测重量', type: 'checkbox' },
    { key: 'minWeight', label: '最小重量(g)', type: 'number' },
  ],
  speak: [
    { key: 'label', label: '名称', type: 'text' },
    { key: 'text', label: '播报文本', type: 'text' },
    { key: 'volume', label: '音量(0-1)', type: 'number' },
    { key: 'lang', label: '语言', type: 'select', options: ['zh', 'en'] },
    { key: 'waitAfter', label: '播报后等待(秒)', type: 'number' },
  ],
  loop: [
    { key: 'label', label: '名称', type: 'text' },
    { key: 'mode', label: '模式', type: 'select', options: ['time_range', 'count'] },
    { key: 'startTime', label: '开始时间', type: 'text' },
    { key: 'endTime', label: '结束时间', type: 'text' },
    { key: 'count', label: '循环次数', type: 'number' },
    { key: 'maxRounds', label: '最大轮次', type: 'number' },
  ],
  condition: [
    { key: 'label', label: '名称', type: 'text' },
    { key: 'field', label: '字段', type: 'select', options: ['batteryPct', 'trayWeight', 'time', 'position'] },
    { key: 'operator', label: '运算符', type: 'select', options: ['<', '<=', '>', '>=', '=='] },
    { key: 'value', label: '阈值', type: 'text' },
    { key: 'onTrue', label: '成立→节点ID', type: 'text' },
    { key: 'onFalse', label: '不成立→节点ID', type: 'text' },
  ],
  shutdown: [
    { key: 'label', label: '名称', type: 'text' },
    { key: 'sendReport', label: '发日报', type: 'checkbox' },
  ],
  readAlarm: [
    { key: 'label', label: '名称', type: 'text' },
    { key: 'robotId', label: '机器人ID', type: 'text' },
    { key: 'condition', label: '触发条件', type: 'text' },
  ],
  predict: [
    { key: 'label', label: '名称', type: 'text' },
    { key: 'target', label: '预测目标', type: 'select', options: ['health_score', 'rul_days', 'both'] },
    { key: 'robotId', label: '机器人ID', type: 'text' },
    { key: 'apiEndpoint', label: 'API地址', type: 'text' },
  ],
  maintenance: [
    { key: 'label', label: '名称', type: 'text' },
    { key: 'priority', label: '优先级', type: 'select', options: ['low', 'medium', 'high', 'critical'] },
    { key: 'notifyChannel', label: '通知渠道', type: 'select', options: ['wecom', 'dingtalk', 'feishu', 'email'] },
    { key: 'assignee', label: '负责人', type: 'text' },
  ],
  log: [
    { key: 'label', label: '名称', type: 'text' },
    { key: 'level', label: '级别', type: 'select', options: ['info', 'warn', 'error'] },
    { key: 'message', label: '消息', type: 'text' },
  ],
}

const TYPE_LABEL: Record<string, string> = {
  boot: '🔧 开机',
  move: '📍 移动',
  wait: '⏱ 等待',
  pickup: '📦 取托盘',
  speak: '🔊 播报',
  loop: '🔁 循环',
  condition: '❓ 条件',
  shutdown: '🔴 关机',
  readAlarm: '🚨 读报警码',
  predict: '🧠 AI 预测',
  maintenance: '🔧 维护工单',
  log: '📋 运维日志',
}

interface Props {
  node: SopNode | null
  onSave: (id: string, data: Record<string, unknown>) => void
  onClose: () => void
}

export function NodeEditDialog({ node, onSave, onClose }: Props) {
  const [data, setData] = useState<Record<string, unknown>>({})

  useEffect(() => {
    if (node) setData({ ...node.data })
  }, [node])

  if (!node) return null

  const fields = FIELDS[node.type] ?? []
  const set = (k: string, v: unknown) => setData((d) => ({ ...d, [k]: v }))

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.6)',
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'var(--bg-elev-1)',
          borderRadius: 10,
          padding: 20,
          width: 380,
          maxHeight: '80vh',
          overflowY: 'auto',
          border: '1px solid var(--border-base)',
          boxShadow: '0 24px 60px rgba(0,0,0,0.5)',
          fontFamily: 'system-ui, -apple-system, sans-serif',
          color: 'var(--text-primary)',
        }}
      >
        <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 16, color: 'var(--text-primary)' }}>
          {TYPE_LABEL[node.type] ?? node.type} · 编辑属性
        </div>

        {fields.map((f) => {
          const val = data[f.key]
          if (f.type === 'checkbox') {
            return (
              <div key={f.key} style={{ marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
                <input
                  type="checkbox"
                  checked={!!val}
                  onChange={(e) => set(f.key, e.target.checked)}
                  id={f.key}
                />
                <label htmlFor={f.key} style={{ fontSize: 13, cursor: 'pointer' }}>{f.label}</label>
              </div>
            )
          }
          if (f.type === 'select') {
            return (
              <div key={f.key} style={{ marginBottom: 12 }}>
                <label style={{ display: 'block', fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4 }}>{f.label}</label>
                <select
                  value={String(val ?? '')}
                  onChange={(e) => set(f.key, e.target.value)}
                  style={{ width: '100%', padding: '6px 8px', border: '1px solid var(--border-base)', borderRadius: 6, fontSize: 13, background: 'var(--bg-elev-2)', color: 'var(--text-primary)' }}
                >
                  {f.options?.map((o) => (
                    <option key={o} value={o}>{o}</option>
                  ))}
                </select>
              </div>
            )
          }
          return (
            <div key={f.key} style={{ marginBottom: 12 }}>
              <label style={{ display: 'block', fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4 }}>{f.label}</label>
              <input
                type={f.type === 'number' ? 'number' : 'text'}
                value={val === undefined || val === null ? '' : String(val)}
                onChange={(e) => set(f.key, f.type === 'number' ? Number(e.target.value) : e.target.value)}
                style={{ width: '100%', padding: '6px 8px', border: '1px solid var(--border-base)', borderRadius: 6, fontSize: 13, boxSizing: 'border-box', background: 'var(--bg-elev-2)', color: 'var(--text-primary)' }}
              />
            </div>
          )
        })}

        <div style={{ display: 'flex', gap: 8, marginTop: 16, justifyContent: 'flex-end' }}>
          <button
            onClick={onClose}
            style={{ padding: '6px 16px', border: '1px solid var(--border-base)', borderRadius: 6, background: 'var(--bg-elev-2)', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: 13 }}
          >
            取消
          </button>
          <button
            onClick={() => { onSave(node.id, data); onClose() }}
            style={{ padding: '6px 16px', border: 'none', borderRadius: 6, background: 'linear-gradient(135deg, var(--primary), var(--accent))', color: '#0a0e1a', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}
          >
            保存
          </button>
        </div>
      </div>
    </div>
  )
}
