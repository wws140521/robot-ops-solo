import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  addEdge,
  BaseEdge,
  EdgeLabelRenderer,
  getBezierPath,
  useNodes,
  type Connection,
  type Node,
  type EdgeProps,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { useCallback, useEffect } from 'react'
import { MoveNode } from './nodes/MoveNode'
import { SpeakNode } from './nodes/SpeakNode'
import { WaitNode } from './nodes/WaitNode'
import { LoopNode } from './nodes/LoopNode'
import { ConditionNode } from './nodes/ConditionNode'
import { BootNode } from './nodes/BootNode'
import { PickupNode } from './nodes/PickupNode'
import { ShutdownNode } from './nodes/ShutdownNode'
import { ReadAlarmNode } from './nodes/ReadAlarmNode'
import { PredictNode } from './nodes/PredictNode'
import { MaintenanceNode } from './nodes/MaintenanceNode'
import { LogNode } from './nodes/LogNode'
import { NodePalette } from './sidebar/NodePalette'
import { NodeEditDialog } from './sidebar/NodeEditDialog'
import { useSopStore } from './hooks/useSopStore'
import type { SopNode } from './schema/sop-schema'

const nodeTypes = {
  boot: BootNode,
  move: MoveNode,
  wait: WaitNode,
  pickup: PickupNode,
  speak: SpeakNode,
  loop: LoopNode,
  condition: ConditionNode,
  shutdown: ShutdownNode,
  readAlarm: ReadAlarmNode,
  predict: PredictNode,
  maintenance: MaintenanceNode,
  log: LogNode,
}

// 节点类型 → 主题色（与各节点 ACCENT 一致），用于渐变连线取色
const NODE_COLORS: Record<string, string> = {
  boot: '#00e676',
  move: '#00f0ff',
  wait: '#ff8c42',
  pickup: '#7b61ff',
  speak: '#7b61ff',
  loop: '#00e676',
  condition: '#ffd600',
  shutdown: '#ff3d71',
  readAlarm: '#ff3d71',
  predict: '#9d4edd',
  maintenance: '#ff8c42',
  log: '#9aa3b2',
}

// 自定义渐变连线：从源节点色渐变到目标节点色
function GradientEdge({
  id,
  source,
  target,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  label,
  style,
}: EdgeProps) {
  const nodes = useNodes()
  const sourceNode = nodes.find((n) => n.id === source)
  const targetNode = nodes.find((n) => n.id === target)
  const sourceColor = (sourceNode?.type && NODE_COLORS[sourceNode.type]) || '#9aa3b2'
  const targetColor = (targetNode?.type && NODE_COLORS[targetNode.type]) || '#9aa3b2'

  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  })

  const gradientId = `sop-grad-${id}`

  return (
    <>
      <defs>
        <linearGradient
          id={gradientId}
          gradientUnits="userSpaceOnUse"
          x1={sourceX}
          y1={sourceY}
          x2={targetX}
          y2={targetY}
        >
          <stop offset="0%" stopColor={sourceColor} />
          <stop offset="100%" stopColor={targetColor} />
        </linearGradient>
      </defs>
      <BaseEdge path={edgePath} style={{ stroke: `url(#${gradientId})`, strokeWidth: 2, ...style }} />
      {label && (
        <EdgeLabelRenderer>
          <div
            style={{
              position: 'absolute',
              transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
              padding: '2px 8px',
              borderRadius: 10,
              background: 'var(--bg-elev-2)',
              border: '1px solid var(--border-base)',
              fontSize: 11,
              color: 'var(--text-secondary)',
              fontFamily: 'var(--font-mono)',
              pointerEvents: 'none',
            }}
          >
            {label}
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  )
}

const edgeTypes = {
  gradient: GradientEdge,
}

export function SopEditor() {
  const { nodes: storeNodes, edges: storeEdges, addNode, setNodes, setEdges, updateNode, editNodeId, clearEdit } = useSopStore()

  const [nodes, setLocalNodes, onNodesChange] = useNodesState(storeNodes as unknown as Node[])
  const [edges, setLocalEdges, onEdgesChange] = useEdgesState(storeEdges)

  // store 变更（loadGraph/reset/addNode/updateNode）同步到画布本地状态；拖拽只改本地不触发
  useEffect(() => {
    setLocalNodes(storeNodes as unknown as Node[])
    setLocalEdges(storeEdges)
  }, [storeNodes, storeEdges, setLocalNodes, setLocalEdges])

  // editNodeId 变化时同步打开弹窗（来源：节点✏️按钮 或 双击）
  const editingNode = editNodeId ? (storeNodes.find((n) => n.id === editNodeId) ?? null) : null

  const onConnect = useCallback(
    (conn: Connection) => {
      // type 走 defaultEdgeOptions（type: 'gradient'）；这里只补 label
      const newEdges = addEdge({ ...conn, label: '' }, edges)
      setLocalEdges(newEdges)
      setEdges(newEdges)
    },
    [edges, setEdges, setLocalEdges]
  )

  const handleAddNode = (node: SopNode) => {
    addNode(node)
    setLocalNodes([...nodes, node as unknown as Node])
  }

  // 双击节点也打开属性编辑弹窗（快捷方式）
  const onNodeDoubleClick = useCallback((_: unknown, node: Node) => {
    useSopStore.getState().startEdit(node.id)
  }, [])

  const handleSaveNode = (id: string, data: Record<string, unknown>) => {
    updateNode(id, data)
  }

  return (
    <>
      <style>{`
        .sop-node:hover .node-edit-btn {
          opacity: 1 !important;
        }
        @keyframes sop-speak-wave {
          0%, 100% { transform: scaleY(0.3); }
          50% { transform: scaleY(1); }
        }
      `}</style>
      <div style={{ display: 'flex', width: '100%', height: '100%', minHeight: 500 }}>
      <NodePalette onAdd={handleAddNode} />
      <div style={{ flex: 1 }}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onNodeDoubleClick={onNodeDoubleClick}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          fitView
          defaultEdgeOptions={{ type: 'gradient', label: '' }}
        >
          <Background />
          <Controls />
          <MiniMap />
        </ReactFlow>
      </div>
      <NodeEditDialog node={editingNode} onSave={handleSaveNode} onClose={clearEdit} />
      </div>
    </>
  )
}
