import { create } from 'zustand'
import type { SopNode, SopEdge } from '../schema/sop-schema'

interface SopStore {
  nodes: SopNode[]
  edges: SopEdge[]
  selectedNodeId: string | null
  editNodeId: string | null

  setNodes: (nodes: SopNode[]) => void
  setEdges: (edges: SopEdge[]) => void
  addNode: (node: SopNode) => void
  updateNode: (id: string, data: Partial<SopNode['data']>) => void
  removeNode: (id: string) => void
  loadGraph: (graph: { nodes: SopNode[]; edges: SopEdge[] }) => void
  selectNode: (id: string | null) => void
  startEdit: (id: string) => void
  clearEdit: () => void
  reset: () => void
}

const initialNodes: SopNode[] = [
  {
    id: 'start',
    type: 'move',
    position: { x: 100, y: 100 },
    data: { x: 0, y: 0, speed: 0.5 },
  },
]

export const useSopStore = create<SopStore>((set) => ({
  nodes: initialNodes,
  edges: [],
  selectedNodeId: null,
  editNodeId: null,

  setNodes: (nodes) => set({ nodes }),
  setEdges: (edges) => set({ edges }),
  addNode: (node) => set((s) => ({ nodes: [...s.nodes, node] })),
  updateNode: (id, data) =>
    set((s) => ({
      nodes: s.nodes.map((n) => (n.id === id ? { ...n, data: { ...n.data, ...data } } : n)),
    })),
  removeNode: (id) =>
    set((s) => ({
      nodes: s.nodes.filter((n) => n.id !== id),
      edges: s.edges.filter((e) => e.source !== id && e.target !== id),
    })),
  loadGraph: (graph) =>
    set({ nodes: graph.nodes, edges: graph.edges, selectedNodeId: null, editNodeId: null }),
  selectNode: (id) => set({ selectedNodeId: id }),
  startEdit: (id) => set({ editNodeId: id }),
  clearEdit: () => set({ editNodeId: null }),
  reset: () => set({ nodes: initialNodes, edges: [], selectedNodeId: null, editNodeId: null }),
}))
