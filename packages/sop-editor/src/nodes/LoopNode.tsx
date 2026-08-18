import { Handle, Position, type NodeProps } from '@xyflow/react'
import { Repeat } from 'lucide-react'
import type { LoopData } from '../schema/sop-schema'
import { NodeEditButton } from './NodeEditButton'

const ACCENT = '#00e676'

export function LoopNode({ id, data, selected }: NodeProps) {
  const d = data as unknown as LoopData
  return (
    <div
      className="sop-node loop"
      style={{
        position: 'relative',
        padding: '10px 14px',
        borderRadius: 8,
        background: 'var(--bg-elev-2)',
        border: selected ? `2px solid ${ACCENT}` : '1px solid var(--border-base)',
        boxShadow: selected ? '0 0 16px rgba(0,230,118,0.4)' : 'none',
        minWidth: 100,
        color: 'var(--text-primary)',
      }}
    >
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 4, background: ACCENT, borderRadius: '8px 8px 0 0' }} />
      <NodeEditButton nodeId={id} />
      <Handle type="target" position={Position.Left} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 600, fontSize: 13, color: 'var(--text-primary)' }}>
        <Repeat size={14} color={ACCENT} />
        <span>循环</span>
      </div>
      <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 4, fontFamily: 'var(--font-mono)' }}>×{d.count}</div>
      <Handle type="source" position={Position.Right} />
    </div>
  )
}
