import { Handle, Position, type NodeProps } from '@xyflow/react'
import { Brain } from 'lucide-react'
import { NodeEditButton } from './NodeEditButton'

const ACCENT = '#9d4edd'

export interface PredictNodeData {
  target?: string
  apiEndpoint?: string
  robotId?: string
  label?: string
}

export function PredictNode({ id, data, selected }: NodeProps) {
  const d = data as unknown as PredictNodeData
  return (
    <div
      className="sop-node predict"
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
        <Brain size={14} color={ACCENT} />
        <span>{d.label ?? 'AI 预测'}</span>
      </div>
      <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 4 }}>
        目标: {d.target || '健康分+寿命'}
      </div>
      <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
        机器人: {d.robotId || '未指定'}
      </div>
      <Handle type="source" position={Position.Bottom} />
    </div>
  )
}
