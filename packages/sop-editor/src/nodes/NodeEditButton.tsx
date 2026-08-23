import { useSopStore } from '../hooks/useSopStore'

// 节点右上角编辑按钮：hover 时出现，点击打开属性编辑弹窗
// 默认隐藏避免视觉噪音，鼠标移入节点才显示
export function NodeEditButton({ nodeId }: { nodeId: string }) {
  const startEdit = useSopStore((s) => s.startEdit)
  return (
    <button
      className="node-edit-btn"
      onClick={(e) => {
        e.stopPropagation()
        startEdit(nodeId)
      }}
      title="编辑属性"
      style={{
        position: 'absolute',
        top: 4,
        right: 4,
        width: 24,
        height: 24,
        borderRadius: 6,
        border: 'none',
        background: 'var(--border-subtle)',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 0,
        zIndex: 5,
        opacity: 0,
        transition: 'opacity 0.15s, background 0.15s',
        color: 'var(--text-tertiary)',
      }}
      onMouseEnter={(e) => {
        ;(e.currentTarget as HTMLButtonElement).style.background = 'var(--bg-elev-3)'
        ;(e.currentTarget as HTMLButtonElement).style.color = 'var(--text-primary)'
      }}
      onMouseLeave={(e) => {
        ;(e.currentTarget as HTMLButtonElement).style.background = 'var(--border-subtle)'
        ;(e.currentTarget as HTMLButtonElement).style.color = 'var(--text-tertiary)'
      }}
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 20h9" />
        <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
      </svg>
    </button>
  )
}
