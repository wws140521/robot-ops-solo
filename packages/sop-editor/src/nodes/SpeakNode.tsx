import { Handle, Position, type NodeProps } from '@xyflow/react'
import { Volume2 } from 'lucide-react'
import type { SpeakData } from '../schema/sop-schema'
import { NodeEditButton } from './NodeEditButton'

const ACCENT = '#7b61ff'

// 3 条竖线声波动画（keyframes 定义在 SopEditor.tsx 全局 style 中）
function SpeakWave() {
  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 2, height: 14, marginLeft: 4 }}>
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          style={{
            display: 'inline-block',
            width: 2,
            height: '100%',
            background: ACCENT,
            borderRadius: 1,
            transformOrigin: 'center',
            animation: `sop-speak-wave 1s ease-in-out ${i * 0.15}s infinite`,
          }}
        />
      ))}
    </div>
  )
}

export function SpeakNode({ id, data, selected }: NodeProps) {
  const d = data as unknown as SpeakData
  return (
    <div
      className="sop-node speak"
      style={{
        position: 'relative',
        padding: '10px 14px',
        borderRadius: 8,
        background: 'var(--bg-elev-2)',
        border: selected ? `2px solid ${ACCENT}` : '1px solid var(--border-base)',
        boxShadow: selected ? '0 0 16px rgba(123,97,255,0.4)' : 'none',
        minWidth: 140,
        color: 'var(--text-primary)',
      }}
    >
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 4, background: ACCENT, borderRadius: '8px 8px 0 0' }} />
      <NodeEditButton nodeId={id} />
      <Handle type="target" position={Position.Left} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 600, fontSize: 13, color: 'var(--text-primary)' }}>
        <Volume2 size={14} color={ACCENT} />
        <span>播报</span>
        <SpeakWave />
      </div>
      <div
        style={{
          fontSize: 11,
          color: 'var(--text-tertiary)',
          marginTop: 4,
          maxWidth: 160,
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          fontFamily: 'var(--font-mono)',
        }}
      >
        {d.text || '(空话术)'}
      </div>
      <Handle type="source" position={Position.Right} />
    </div>
  )
}
