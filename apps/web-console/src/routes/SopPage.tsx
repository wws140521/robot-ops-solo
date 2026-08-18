import { SopEditor, useSopStore, graphToPayload, HOTPOT_DINNER_V1, type SopGraph } from 'sop-editor'
import { useState } from 'react'
import { saveSop, listSops, type StoredSop } from '../lib/sopStorage'
import { FileDown, CloudUpload, FolderOpen, Play, Trash2, Download, ChevronDown, Cloud } from 'lucide-react'

export function SopPage() {
  const { nodes, edges, reset, loadGraph } = useSopStore()
  const [exported, setExported] = useState('')
  const [cloudMsg, setCloudMsg] = useState('')
  const [cloudList, setCloudList] = useState<StoredSop[]>([])
  const [showCloud, setShowCloud] = useState(false)
  const [showExport, setShowExport] = useState(false)

  function buildGraph(): SopGraph {
    return {
      id: 'sop-' + Date.now(),
      name: '火锅店晚市传菜',
      industry: 'hotpot',
      brand: 'unitree',
      model: 'g1',
      nodes,
      edges,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }
  }

  const handleExport = () => {
    const payload = graphToPayload(buildGraph())
    setExported(JSON.stringify(payload, null, 2))
    setShowExport(true)
  }

  const handleLoadTemplate = () => {
    loadGraph(HOTPOT_DINNER_V1)
    setExported('')
    setCloudMsg('✅ 已加载火锅店模板')
  }

  const handleSaveCloud = async () => {
    setCloudMsg('保存中...')
    try {
      const graph = buildGraph()
      await saveSop(graph)
      setCloudMsg(`✅ 已保存（${graph.nodes.length} 节点 / ${graph.edges.length} 连线）`)
    } catch (e) {
      setCloudMsg(`❌ 保存失败：${e instanceof Error ? e.message : String(e)}`)
    }
  }

  const handleLoadCloud = async () => {
    setCloudMsg('加载列表中...')
    try {
      const list = await listSops()
      setCloudList(list)
      setShowCloud(true)
      setCloudMsg(list.length === 0 ? '☁️ 暂无已保存模板' : `☁️ 找到 ${list.length} 个模板`)
    } catch (e) {
      setCloudMsg(`❌ 加载失败：${e instanceof Error ? e.message : String(e)}`)
    }
  }

  const handlePickCloud = (sop: StoredSop) => {
    loadGraph(sop.graph)
    setShowCloud(false)
    setCloudMsg(`✅ 已加载：${sop.name} (v${sop.version})`)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: 16 }}>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: 12,
        padding: '14px 20px',
        background: 'var(--bg-glass)',
        backdropFilter: 'blur(12px)',
        border: '1px solid var(--border-base)',
        borderRadius: 'var(--radius-md)',
        boxShadow: 'var(--shadow-card)',
        animation: 'fadeInUp 0.4s var(--ease-out)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{
            width: 4,
            height: 20,
            background: 'linear-gradient(180deg, var(--primary), var(--accent))',
            borderRadius: 2,
            boxShadow: 'var(--glow-primary)',
          }} />
          <span style={{ fontWeight: 600, fontSize: 15, color: 'var(--text-primary)' }}>SOP 任务编排</span>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button className="btn" onClick={handleLoadTemplate} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><FileDown size={14} /> 加载模板</button>
          <button className="btn" onClick={handleSaveCloud} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><CloudUpload size={14} /> 保存云端</button>
          <button className="btn" onClick={handleLoadCloud} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><FolderOpen size={14} /> 云端模板</button>
          <a className="btn" href="#/sop-sim" style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 6 }}><Play size={14} /> 去模拟</a>
          <button className="btn btn-danger" onClick={reset} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><Trash2 size={14} /> 清空</button>
          <button className="btn btn-primary" onClick={handleExport} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><Download size={14} /> 导出 JSON</button>
        </div>
      </div>

      {cloudMsg && (
        <div
          className="card hud-corners"
          style={{
            padding: '8px 16px',
            fontSize: 13,
            animation: 'fadeInUp 0.4s var(--ease-out) 0.05s both',
            color: cloudMsg.startsWith('✅') ? 'var(--status-online)' : cloudMsg.startsWith('❌') ? 'var(--status-error)' : 'var(--text-secondary)',
          }}
        >
          {cloudMsg}
        </div>
      )}

      {showCloud && (
        <div
          className="card hud-corners"
          style={{
            maxHeight: 280,
            overflowY: 'auto',
            animation: 'slideInRight 0.4s var(--ease-out) 0.1s both',
          }}
        >
          <div
            style={{
              padding: '8px 16px',
              fontWeight: 600,
              borderBottom: '1px solid var(--border-subtle)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <span style={{ color: 'var(--text-primary)', display: 'inline-flex', alignItems: 'center', gap: 6 }}><Cloud size={14} /> 云端模板（点击加载到画布）</span>
            <button className="btn" style={{ padding: '2px 10px', fontSize: 12 }} onClick={() => setShowCloud(false)}>
              关闭
            </button>
          </div>
          {cloudList.length === 0 ? (
            <div style={{ padding: 16, color: 'var(--text-tertiary)', fontSize: 13 }}>暂无模板，先编辑画布后点「保存到云端」</div>
          ) : (
            cloudList.map((sop) => (
              <div
                key={sop.id}
                onClick={() => handlePickCloud(sop)}
                style={{
                  padding: '10px 16px',
                  borderBottom: '1px solid var(--border-subtle)',
                  cursor: 'pointer',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  transition: 'background 0.2s',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-elev-3)')}
                onMouseLeave={(e) => (e.currentTarget.style.background = '')}
              >
                <div>
                  <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--text-primary)' }}>{sop.name}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
                    {sop.industry} · {sop.brand}/{sop.model} · v{sop.version} ·{' '}
                    {new Date(sop.updated_at).toLocaleString('zh-CN')}
                  </div>
                </div>
                {sop.is_published && (
                  <span style={{ fontSize: 11, color: 'var(--status-online)', background: 'rgba(0,230,118,0.1)', padding: '2px 8px', borderRadius: 4 }}>
                    已发布
                  </span>
                )}
              </div>
            ))
          )}
        </div>
      )}

      <div
        className="card hud-corners"
        style={{
          flex: 1,
          padding: 0,
          overflow: 'hidden',
          animation: 'fadeInUp 0.4s var(--ease-out) 0.15s both',
          minHeight: 300,
        }}
      >
        <SopEditor />
      </div>

      <div
        className="card hud-corners"
        style={{
          padding: 0,
          overflow: 'hidden',
          animation: 'slideInRight 0.4s var(--ease-out) 0.2s both',
        }}
      >
        <div
          onClick={() => setShowExport(!showExport)}
          style={{
            padding: '10px 16px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            cursor: 'pointer',
            userSelect: 'none',
            background: showExport ? 'var(--bg-elev-2)' : 'transparent',
            transition: 'background 0.2s',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{
              width: 6,
              height: 6,
              borderRadius: '50%',
              background: 'var(--primary)',
              boxShadow: 'var(--glow-primary)',
            }} />
            <span style={{ fontWeight: 600, fontSize: 13, color: 'var(--text-primary)' }}>导出预览</span>
            <span style={{ fontSize: 11, color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)' }}>
              ({nodes.length} nodes / {edges.length} edges)
            </span>
          </div>
          <ChevronDown size={14} style={{
            color: 'var(--text-tertiary)',
            transition: 'transform 0.3s',
            transform: showExport ? 'rotate(180deg)' : 'rotate(0deg)',
          }} />
        </div>
        {showExport && (
          <div style={{ borderTop: '1px solid var(--border-subtle)' }}>
            <pre style={{
              background: 'var(--bg-elev-1)',
              padding: 16,
              margin: 0,
              fontSize: 12,
              overflow: 'auto',
              maxHeight: 260,
              fontFamily: 'var(--font-mono)',
              color: 'var(--text-primary)',
              lineHeight: 1.6,
            }}>
              {exported || '// 点击「导出 JSON」生成预览'}
            </pre>
          </div>
        )}
      </div>
    </div>
  )
}