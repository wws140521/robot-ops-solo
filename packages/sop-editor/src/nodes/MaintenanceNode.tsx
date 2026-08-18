import { Handle, Position, type NodeProps } from '@xyflow/react'
import { Wrench } from 'lucide-react'
import { NodeEditButton } from './NodeEditButton'

const ACCENT = '#ff8c42'

const PRIORITY_COLORS: Record<string, string> = {
  low: '#52c41a',
  medium: '#faad14',
  high: '#ff8c42',
  critical: '#ff3d71',
}

export interface MaintenanceNodeData {
  priority?: 'low' | 'medium' | 'high' | 'critical'
  notifyChannel?: 'wecom' | 'dingtalk' | 'feishu' | 'email'
  assignee?: string
  label?: string
}

export function MaintenanceNode({ id, data, selected }: NodeProps) {
  const d = data as unknown as MaintenanceNodeData
  const priority = d.priority || 'medium'
  const accent = PRIORITY_COLORS[priority] || ACCENT
  return (
    <div
      className="sop-node maintenance"
      style={{
        position: 'relative',
        padding: '10px 14px',
        borderRadius: 8,
        background: 'var(--bg-elev-2)',
        border: selected ? `2px solid ${accent}` : '1px solid var(--border-base)',
        boxShadow: selected ? `0 0 16px ${accent}66` : 'none',
        minWidth: 140,
        color: 'var(--text-primary)',
      }}
    >
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 4, background: accent, borderRadius: '8px 8px 0 0' }} />
      <NodeEditButton nodeId={id} />
      <Handle type="target" position={Position.Top} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 600, fontSize: 13 }}>
        <Wrench size={14} color={accent} />
        <span>{d.label ?? '维护工单'}</span>
      </div>
      <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 4 }}>
        优先级: {priority}
      </div>
      <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
        通知: {d.notifyChannel || 'wecom'}
      </div>
      {d.assignee && (
        <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
          负责人: {d.assignee}
        </div>
      )}
      <Handle type="source" position={Position.Bottom} />
    </div>
  )
}
