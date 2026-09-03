// SOP 存储层 —— Supabase 持久化 + localStorage 离线降级
// 对应 SUPABASE.md 第五节 5.1
// 放在 web-console（非 sop-editor 包）以避免循环依赖：sop-editor 是 web-console 的依赖，
// 若 sopStorage 放 sop-editor 且 import web-console 的 supabase，会形成包循环。
import { supabase, isSupabaseEnabled, getCurrentTenantSlug } from './supabase'
import type { SopGraph } from 'sop-editor'

// ============================================================
// 类型
// ============================================================
export interface StoredSop {
  id: string
  name: string
  description?: string
  industry: string
  brand: string
  model: string
  graph: SopGraph
  version: number
  is_published: boolean
  updated_at: string
  created_at: string
}

// 保存 SOP 模板，新建或更新都会让 version 自增
export async function saveSop(
  graph: SopGraph,
  options?: { description?: string; is_published?: boolean }
): Promise<StoredSop> {
  // Supabase 没配就走 localStorage 降级
  if (!isSupabaseEnabled) {
    return saveSopLocal(graph, options)
  }

  const tenantSlug = await getCurrentTenantSlug()

  // 查是否已存在（按 graph.id 拿 version）
  const { data: existing } = await supabase!
    .from('sop_templates')
    .select('id, version')
    .eq('id', graph.id)
    .maybeSingle()

  const payload = {
    id: graph.id,
    name: graph.name,
    description: options?.description ?? '',
    industry: graph.industry,
    brand: graph.brand,
    model: graph.model,
    graph: graph,
    nodes_count: graph.nodes.length,
    is_published: options?.is_published ?? false,
    tenant_slug: tenantSlug,
    version: (existing?.version ?? 0) + 1,
  }

  const { data, error } = await supabase!
    .from('sop_templates')
    .upsert(payload, { onConflict: 'id' })
    .select()
    .single()

  if (error) throw error
  return data as StoredSop
}

// 读取单个 SOP 模板
export async function loadSop(id: string): Promise<StoredSop | null> {
  if (!isSupabaseEnabled) {
    return loadSopLocal(id)
  }

  const { data, error } = await supabase!
    .from('sop_templates')
    .select('*')
    .eq('id', id)
    .maybeSingle()

  if (error) throw error
  return data as StoredSop | null
}

// 列出当前租户所有 SOP 模板，支持按行业/品牌/发布状态过滤
export async function listSops(filters?: {
  industry?: string
  brand?: string
  is_published?: boolean
}): Promise<StoredSop[]> {
  if (!isSupabaseEnabled) {
    return listSopsLocal(filters)
  }

  let query = supabase!
    .from('sop_templates')
    .select('*')
    .order('updated_at', { ascending: false })

  if (filters?.industry) query = query.eq('industry', filters.industry)
  if (filters?.brand) query = query.eq('brand', filters.brand)
  if (filters?.is_published !== undefined)
    query = query.eq('is_published', filters.is_published)

  const { data, error } = await query
  if (error) throw error
  return (data ?? []) as StoredSop[]
}

// 删除 SOP 模板
export async function deleteSop(id: string): Promise<void> {
  if (!isSupabaseEnabled) {
    return deleteSopLocal(id)
  }

  const { error } = await supabase!.from('sop_templates').delete().eq('id', id)

  if (error) throw error
}

// 发布或取消发布 SOP 模板
export async function publishSop(id: string, published: boolean): Promise<void> {
  if (!isSupabaseEnabled) return

  const { error } = await supabase!
    .from('sop_templates')
    .update({ is_published: published })
    .eq('id', id)

  if (error) throw error
}

// 克隆别人的发布模板，生成自己的副本
export async function cloneSop(id: string, newName?: string): Promise<StoredSop> {
  const original = await loadSop(id)
  if (!original) throw new Error('模板不存在')

  const tenantSlug = await getCurrentTenantSlug()
  const {
    data: { user },
  } = await supabase!.auth.getUser()

  const { data, error } = await supabase!
    .from('sop_templates')
    .insert({
      id: `sop-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      name: newName ?? `${original.name} (副本)`,
      description: original.description,
      industry: original.industry,
      brand: original.brand,
      model: original.model,
      graph: original.graph,
      nodes_count: original.graph.nodes.length,
      tenant_slug: tenantSlug,
      created_by: user?.id,
    })
    .select()
    .single()

  if (error) throw error
  return data as StoredSop
}

// 把 SOP 图导出成 JSON 文件，触发浏览器下载
export function exportSopFile(graph: SopGraph) {
  const blob = new Blob([JSON.stringify(graph, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${graph.name.replace(/\s+/g, '-')}-${Date.now()}.json`
  a.click()
  URL.revokeObjectURL(url)
}

// 从用户选择的 JSON 文件导入 SOP 图
export function importSopFile(file: File): Promise<SopGraph> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      try {
        const graph = JSON.parse(reader.result as string)
        resolve(graph as SopGraph)
      } catch (e) {
        reject(e)
      }
    }
    reader.readAsText(file)
  })
}

// ===== 离线降级：localStorage =====
const LOCAL_PREFIX = 'sop:template:'

// localStorage 版保存，Supabase 没配时兜底用
function saveSopLocal(
  graph: SopGraph,
  options?: { description?: string; is_published?: boolean }
): StoredSop {
  const key = LOCAL_PREFIX + graph.id
  const existing = localStorage.getItem(key)
  const prev = existing ? (JSON.parse(existing) as StoredSop) : null
  const stored: StoredSop = {
    id: graph.id,
    name: graph.name,
    description: options?.description ?? '',
    industry: graph.industry,
    brand: graph.brand,
    model: graph.model,
    graph,
    version: (prev?.version ?? 0) + 1,
    is_published: options?.is_published ?? false,
    updated_at: new Date().toISOString(),
    created_at: prev?.created_at ?? new Date().toISOString(),
  }
  localStorage.setItem(key, JSON.stringify(stored))
  return stored
}

// localStorage 版读取
function loadSopLocal(id: string): StoredSop | null {
  const raw = localStorage.getItem(LOCAL_PREFIX + id)
  return raw ? (JSON.parse(raw) as StoredSop) : null
}

// localStorage 版列表，按更新时间倒序
function listSopsLocal(filters?: {
  industry?: string
  brand?: string
  is_published?: boolean
}): StoredSop[] {
  const items: StoredSop[] = []
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i)!
    if (key.startsWith(LOCAL_PREFIX)) {
      const item = JSON.parse(localStorage.getItem(key)!) as StoredSop
      if (filters?.industry && item.industry !== filters.industry) continue
      if (filters?.brand && item.brand !== filters.brand) continue
      if (filters?.is_published !== undefined && item.is_published !== filters.is_published)
        continue
      items.push(item)
    }
  }
  return items.sort((a, b) => b.updated_at.localeCompare(a.updated_at))
}

// localStorage 版删除
function deleteSopLocal(id: string) {
  localStorage.removeItem(LOCAL_PREFIX + id)
}
