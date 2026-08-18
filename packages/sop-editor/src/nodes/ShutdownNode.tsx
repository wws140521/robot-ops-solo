import { Handle, Position, type NodeProps } from '@xyflow/react'
import { PowerOff } from 'lucide-react'
import type { ShutdownData } from '../schema/sop-schema'
import { NodeEditButton } from './NodeEditButton'

const ACCENT = '#ff3d71'

export function ShutdownNode({ id, data, selected }: NodeProps) {
  const d = data as unknown as ShutdownData
  return (
    <div
      className="sop-node shutdown"
      style={{
        position: 'relative',
        padding: '10px 14px',
        borderRadius: 8,
        background: 'var(--bg-elev-2)',
        border: selected ? `2px solid ${ACCENT}` : '1px solid var(--border-base)',
        boxShadow: selected ? '0 0 16px rgba(255,61,113,0.4)' : 'none',
        minWidth: 120,
        color: 'var(--text-primary)',
      }}
    >
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 4, background: ACCENT, borderRadius: '8px 8px 0 0' }} />
      <NodeEditButton nodeId={id} />
      <Handle type="target" position={Position.Top} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 600, fontSize: 13, color: 'var(--text-primary)' }}>
        <PowerOff size={14} color={ACCENT} />
        <span>{d.label ?? '关机'}</span>
      </div>
      {d.sendReport && (
        <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 4, fontFamily: 'var(--font-mono)' }}>
          日报 → {(d.reportChannels ?? []).join('/')}
        </div>
      )}
    </div>
  )
}
