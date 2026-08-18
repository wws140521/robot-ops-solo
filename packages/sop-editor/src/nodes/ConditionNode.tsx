import { Handle, Position, type NodeProps } from '@xyflow/react'
import { HelpCircle } from 'lucide-react'
import type { ConditionData, ConditionOperator } from '../schema/sop-schema'
import { NodeEditButton } from './NodeEditButton'

const ACCENT = '#ffd600'
const TRUE_COLOR = '#00e676'
const FALSE_COLOR = '#ff5252'

const OPERATOR_SYMBOL: Record<ConditionOperator, string> = {
  '<': '<',
  '<=': '≤',
  '>': '>',
  '>=': '≥',
  '==': '=',
  eq: '=',
  gt: '>',
  lt: '<',
}

export function ConditionNode({ id, data, selected }: NodeProps) {
  const d = data as unknown as ConditionData
  return (
    <div
      className="sop-node condition"
      style={{
        position: 'relative',
        padding: '10px 14px',
        borderRadius: 8,
        background: 'var(--bg-elev-2)',
        border: selected ? `2px solid ${ACCENT}` : '1px solid var(--border-base)',
        boxShadow: selected ? '0 0 16px rgba(255,214,0,0.4)' : 'none',
        minWidth: 120,
        color: 'var(--text-primary)',
      }}
    >
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 4, background: ACCENT, borderRadius: '8px 8px 0 0' }} />
      <NodeEditButton nodeId={id} />
      <Handle type="target" position={Position.Top} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 600, fontSize: 13, color: 'var(--text-primary)' }}>
        <HelpCircle size={14} color={ACCENT} />
        <span>{d.label ?? '条件'}</span>
      </div>
      <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 4, fontFamily: 'var(--font-mono)' }}>
        {d.field} {OPERATOR_SYMBOL[d.operator] ?? d.operator} {d.value}
      </div>
      {/* true / false 出口分色标签 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6, fontSize: 10, fontFamily: 'var(--font-mono)' }}>
        <span style={{ color: TRUE_COLOR, fontWeight: 600 }}>✓ 真</span>
        <span style={{ color: FALSE_COLOR, fontWeight: 600 }}>✗ 假</span>
      </div>
      <Handle
        type="source"
        position={Position.Bottom}
        id="true"
        style={{ left: '30%', background: TRUE_COLOR, border: '1px solid #fff' }}
      />
      <Handle
        type="source"
        position={Position.Bottom}
        id="false"
        style={{ left: '70%', background: FALSE_COLOR, border: '1px solid #fff' }}
      />
    </div>
  )
}
