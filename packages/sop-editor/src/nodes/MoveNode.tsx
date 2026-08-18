import { Handle, Position, type NodeProps } from '@xyflow/react'
import { Navigation } from 'lucide-react'
import type { MoveData } from '../schema/sop-schema'
import { NodeEditButton } from './NodeEditButton'

const ACCENT = '#00f0ff'

export function MoveNode({ id, data, selected }: NodeProps) {
  const d = data as unknown as MoveData
  return (
    <div
      className="sop-node move"
      style={{
        position: 'relative',
        padding: '10px 14px',
        borderRadius: 8,
        background: 'var(--bg-elev-2)',
        border: selected ? `2px solid ${ACCENT}` : '1px solid var(--border-base)',
        boxShadow: selected ? '0 0 16px rgba(0,240,255,0.4)' : 'none',
        minWidth: 120,
        color: 'var(--text-primary)',
      }}
    >
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 4, background: ACCENT, borderRadius: '8px 8px 0 0' }} />
      <NodeEditButton nodeId={id} />
      <Handle type="target" position={Position.Left} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 600, fontSize: 13, color: 'var(--text-primary)' }}>
        <Navigation size={14} color={ACCENT} />
        <span>{d.label ?? '移动'}</span>
      </div>
      <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 4, fontFamily: 'var(--font-mono)' }}>
        {d.target ? `→ ${d.target}` : `(${d.x ?? 0}, ${d.y ?? 0})`} {d.speed ? `@${d.speed}m/s` : ''}
      </div>
      {d.waypoints && d.waypoints.length > 0 && (
        <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{d.waypoints.length} 个航点</div>
      )}
      <Handle type="source" position={Position.Bottom} />
    </div>
  )
}
