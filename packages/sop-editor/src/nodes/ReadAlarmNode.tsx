import { Handle, Position, type NodeProps } from '@xyflow/react'
import { AlertCircle } from 'lucide-react'
import { NodeEditButton } from './NodeEditButton'

const ACCENT = '#ff3d71'

export interface ReadAlarmNodeData {
  robotId?: string
  condition?: string
  label?: string
}

export function ReadAlarmNode({ id, data, selected }: NodeProps) {
  const d = data as unknown as ReadAlarmNodeData
  return (
    <div
      className="sop-node readAlarm"
      style={{
        position: 'relative',
        padding: '10px 14px',
        borderRadius: 8,
        background: 'var(--bg-elev-2)',
        border: selected ? `2px solid ${ACCENT}` : '1px solid var(--border-base)',
        boxShadow: selected ? `0 0 16px ${ACCENT}66` : 'none',
        minWidth: 140,
        color: 'var(--text-primary)',
      }}
    >
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 4, background: ACCENT, borderRadius: '8px 8px 0 0' }} />
      <NodeEditButton nodeId={id} />
      <Handle type="target" position={Position.Top} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 600, fontSize: 13 }}>
        <AlertCircle size={14} color={ACCENT} />
        <span>{d.label ?? '读报警码'}</span>
      </div>
      <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 4 }}>
        {d.robotId || '未指定机器人'}
      </div>
      <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
        条件: {d.condition || '任意报警'}
      </div>
      <Handle type="source" position={Position.Bottom} />
    </div>
  )
}
