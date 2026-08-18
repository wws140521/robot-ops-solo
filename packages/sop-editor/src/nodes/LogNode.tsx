import { Handle, Position, type NodeProps } from '@xyflow/react'
import { FileText } from 'lucide-react'
import { NodeEditButton } from './NodeEditButton'

const ACCENT = '#9aa3b2'

export interface LogNodeData {
  level?: 'info' | 'warn' | 'error'
  message?: string
  label?: string
}

export function LogNode({ id, data, selected }: NodeProps) {
  const d = data as unknown as LogNodeData
  return (
    <div
      className="sop-node log"
      style={{
        position: 'relative',
        padding: '10px 14px',
        borderRadius: 8,
        background: 'var(--bg-elev-2)',
        border: selected ? `2px solid ${ACCENT}` : '1px solid var(--border-base)',
        boxShadow: selected ? `0 0 16px ${ACCENT}66` : 'none',
        minWidth: 130,
        color: 'var(--text-primary)',
      }}
    >
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 4, background: ACCENT, borderRadius: '8px 8px 0 0' }} />
      <NodeEditButton nodeId={id} />
      <Handle type="target" position={Position.Top} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 600, fontSize: 13 }}>
        <FileText size={14} color={ACCENT} />
        <span>{d.label ?? '运维日志'}</span>
      </div>
      <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 4 }}>
        级别: {d.level || 'info'}
      </div>
      {d.message && (
        <div style={{ fontSize: 11, color: 'var(--text-tertiary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 110 }}>
          {d.message}
        </div>
      )}
      <Handle type="source" position={Position.Bottom} />
    </div>
  )
}
