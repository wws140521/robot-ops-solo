import { Handle, Position, type NodeProps } from '@xyflow/react'
import { Package } from 'lucide-react'
import type { PickupData } from '../schema/sop-schema'
import { NodeEditButton } from './NodeEditButton'

const ACCENT = '#7b61ff'

export function PickupNode({ id, data, selected }: NodeProps) {
  const d = data as unknown as PickupData
  return (
    <div
      className="sop-node pickup"
      style={{
        position: 'relative',
        padding: '10px 14px',
        borderRadius: 8,
        background: 'var(--bg-elev-2)',
        border: selected ? `2px solid ${ACCENT}` : '1px solid var(--border-base)',
        boxShadow: selected ? '0 0 16px rgba(123,97,255,0.4)' : 'none',
        minWidth: 120,
        color: 'var(--text-primary)',
      }}
    >
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 4, background: ACCENT, borderRadius: '8px 8px 0 0' }} />
      <NodeEditButton nodeId={id} />
      <Handle type="target" position={Position.Top} />
      <Handle type="source" position={Position.Bottom} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 600, fontSize: 13, color: 'var(--text-primary)' }}>
        <Package size={14} color={ACCENT} />
        <span>{d.label ?? '取托盘'}</span>
      </div>
      {d.checkWeight && (
        <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 4, fontFamily: 'var(--font-mono)' }}>
          称重 ≥ {d.minWeight ?? 200}g
        </div>
      )}
    </div>
  )
}
