import { Handle, Position, type NodeProps } from '@xyflow/react'
import { Timer } from 'lucide-react'
import type { WaitData } from '../schema/sop-schema'
import { NodeEditButton } from './NodeEditButton'

const ACCENT = '#ff8c42'

export function WaitNode({ id, data, selected }: NodeProps) {
  const d = data as unknown as WaitData
  return (
    <div
      className="sop-node wait"
      style={{
        position: 'relative',
        padding: '10px 18px',
        borderRadius: 40,
        background: 'var(--bg-elev-2)',
        border: selected ? `2px solid ${ACCENT}` : '1px solid var(--border-base)',
        boxShadow: selected ? '0 0 16px rgba(255,140,66,0.4)' : 'none',
        minWidth: 100,
        color: 'var(--text-primary)',
      }}
    >
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 4, background: ACCENT, borderRadius: '40px 40px 0 0' }} />
      <NodeEditButton nodeId={id} />
      <Handle type="target" position={Position.Left} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 600, fontSize: 13, color: 'var(--text-primary)' }}>
        <Timer size={14} color={ACCENT} />
        <span>等待</span>
      </div>
      <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 4, fontFamily: 'var(--font-mono)' }}>{d.seconds}s</div>
      <Handle type="source" position={Position.Right} />
    </div>
  )
}
