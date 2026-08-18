import { useState } from 'react'
import type { SopNode } from '../schema/sop-schema'

const nodeTypes: { type: SopNode['type']; label: string; icon: string; defaultData: any }[] = [
  { type: 'boot',      label: '开机',   icon: '🔧', defaultData: { label: '开机自检', action: 'self_check', timeout: 30 } },
  { type: 'move',      label: '移动',   icon: '📍', defaultData: { label: '移动', target: 'A', speed: 0.7 } },
  { type: 'wait',      label: '等待',   icon: '⏱',  defaultData: { label: '等待', seconds: 3, timeout: 60 } },
  { type: 'pickup',    label: '取托盘', icon: '📦', defaultData: { label: '取托盘', checkWeight: true, minWeight: 200 } },
  { type: 'speak',     label: '播报',   icon: '🔊', defaultData: { label: '播报', text: '欢迎光临！', volume: 0.8, lang: 'zh' } },
  { type: 'loop',      label: '循环',   icon: '🔁', defaultData: { label: '循环', count: 3, mode: 'time_range', startTime: '17:50', endTime: '20:30' } },
  { type: 'condition', label: '条件',   icon: '❓', defaultData: { label: '条件', field: 'batteryPct', operator: '<', value: 30, onTrue: '', onFalse: '' } },
  { type: 'shutdown',  label: '关机',   icon: '🔴', defaultData: { label: '关机+发日报', sendReport: true, reportChannels: ['wechat'] } },
]

// 工业运维节点
const industrialNodeTypes: { type: SopNode['type']; label: string; icon: string; defaultData: any }[] = [
  { type: 'readAlarm',   label: '读报警码', icon: '🚨', defaultData: { label: '读报警码', robotId: '', condition: '任意报警' } },
  { type: 'predict',     label: 'AI 预测',  icon: '🧠', defaultData: { label: 'AI 预测', target: 'both', apiEndpoint: '' } },
  { type: 'maintenance', label: '维护工单', icon: '🔧', defaultData: { label: '维护工单', priority: 'medium', notifyChannel: 'wecom' } },
  { type: 'log',         label: '运维日志', icon: '📋', defaultData: { label: '运维日志', level: 'info', message: '' } },
]

let idCounter = 100

export function NodePalette({ onAdd }: { onAdd: (node: SopNode) => void }) {
  const [hoveredType, setHoveredType] = useState<string | null>(null)

  const handleDragStart = (e: React.DragEvent, type: string) => {
    e.dataTransfer.setData('nodeType', type)
  }

  const handleClick = (type: SopNode['type'], label: string, icon: string, defaultData: any) => {
    const node: SopNode = {
      id: `${type}-${++idCounter}`,
      type,
      position: { x: 300 + Math.random() * 200, y: 100 + Math.random() * 200 },
      data: defaultData,
    }
    onAdd(node)
  }

  return (
    <div style={{ width: 140, padding: 12, borderRight: '1px solid var(--border-base)', background: 'var(--bg-elev-1)' }}>
      <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-tertiary)', marginBottom: 8 }}>节点库</div>
      {nodeTypes.map((nt) => {
        const isHovered = hoveredType === nt.type
        return (
          <div
            key={nt.type}
            draggable
            onDragStart={(e) => handleDragStart(e, nt.type)}
            onClick={() => handleClick(nt.type, nt.label, nt.icon, nt.defaultData)}
            onMouseEnter={() => setHoveredType(nt.type)}
            onMouseLeave={() => setHoveredType(null)}
            style={{
              padding: '8px 10px',
              marginBottom: 6,
              background: 'var(--bg-elev-2)',
              border: `1px solid ${isHovered ? 'var(--primary)' : 'var(--border-base)'}`,
              borderRadius: 6,
              cursor: 'grab',
              fontSize: 13,
              userSelect: 'none',
              color: 'var(--text-primary)',
              boxShadow: isHovered ? '0 0 12px rgba(0, 200, 255, 0.25)' : 'none',
              transition: 'border-color 0.15s, box-shadow 0.15s',
            }}
          >
            {nt.icon} {nt.label}
          </div>
        )
      })}

      <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-tertiary)', margin: '12px 0 8px' }}>工业运维</div>
      {industrialNodeTypes.map((nt) => {
        const isHovered = hoveredType === nt.type
        return (
          <div
            key={nt.type}
            draggable
            onDragStart={(e) => handleDragStart(e, nt.type)}
            onClick={() => handleClick(nt.type, nt.label, nt.icon, nt.defaultData)}
            onMouseEnter={() => setHoveredType(nt.type)}
            onMouseLeave={() => setHoveredType(null)}
            style={{
              padding: '8px 10px',
              marginBottom: 6,
              background: 'var(--bg-elev-2)',
              border: `1px solid ${isHovered ? 'var(--accent)' : 'var(--border-base)'}`,
              borderRadius: 6,
              cursor: 'grab',
              fontSize: 13,
              userSelect: 'none',
              color: 'var(--text-primary)',
              boxShadow: isHovered ? '0 0 12px rgba(157, 78, 221, 0.25)' : 'none',
              transition: 'border-color 0.15s, box-shadow 0.15s',
            }}
          >
            {nt.icon} {nt.label}
          </div>
        )
      })}

      <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 12 }}>
        拖拽到画布 / 点击添加
        <br />
        点节点 ✏️ 或双击编辑属性
      </div>
    </div>
  )
}
