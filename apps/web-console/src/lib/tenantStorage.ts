// 租户存储层 —— Supabase 持久化 + localStorage 离线降级
// 对应 SUPABASE.md 第五节 5.1
import { supabase, isSupabaseEnabled } from './supabase'

export interface TenantRecord {
  slug: string
  name: string
  logo_url: string | null
  primary_color: string
  contact_name: string | null
  contact_phone: string | null
  plan: string
  created_at: string
  updated_at: string
}

// 离线 mock 数据（与 mock-ws-server 保持一致）
const MOCK_TENANTS: TenantRecord[] = [
  {
    slug: 'laowang',
    name: '老王机器人',
    logo_url: null,
    primary_color: '#ff6b35',
    contact_name: '王经理',
    contact_phone: '138-0000-0001',
    plan: 'pro',
    created_at: new Date('2026-07-01').toISOString(),
    updated_at: new Date('2026-08-10').toISOString(),
  },
  {
    slug: 'hotpot01',
    name: '火锅一号',
    logo_url: null,
    primary_color: '#ef4444',
    contact_name: '李店长',
    contact_phone: '138-0000-0002',
    plan: 'enterprise',
    created_at: new Date('2026-06-15').toISOString(),
    updated_at: new Date('2026-08-12').toISOString(),
  },
  {
    slug: 'pharma01',
    name: '药房配送',
    logo_url: null,
    primary_color: '#22c55e',
    contact_name: '陈主管',
    contact_phone: '138-0000-0003',
    plan: 'free',
    created_at: new Date('2026-07-20').toISOString(),
    updated_at: new Date('2026-08-08').toISOString(),
  },
]

const LS_KEY = 'mock_tenants'

function readMock(): TenantRecord[] {
  try {
    const stored = localStorage.getItem(LS_KEY)
    if (stored) return JSON.parse(stored)
  } catch {}
  return MOCK_TENANTS
}

function writeMock(tenants: TenantRecord[]) {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(tenants))
  } catch {}
}

// 列出所有租户（Supabase 启用时走数据库，否则走 localStorage mock）
export async function listTenants(): Promise<TenantRecord[]> {
  if (!isSupabaseEnabled) return readMock()

  const { data, error } = await supabase!
    .from('tenants')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) {
    console.error('[listTenants]', error)
    return readMock()
  }
  return data as TenantRecord[]
}

// 更新租户信息（贴牌配置：logo、品牌色等）
export async function updateTenant(
  slug: string,
  patch: Partial<Omit<TenantRecord, 'slug' | 'created_at'>>
): Promise<TenantRecord | null> {
  if (!isSupabaseEnabled) {
    const tenants = readMock()
    const idx = tenants.findIndex((t) => t.slug === slug)
    if (idx < 0) return null
    tenants[idx] = { ...tenants[idx], ...patch, updated_at: new Date().toISOString() }
    writeMock(tenants)
    return tenants[idx]
  }

  const { data, error } = await supabase!
    .from('tenants')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('slug', slug)
    .select()
    .single()

  if (error) {
    console.error('[updateTenant]', error)
    return null
  }
  return data as TenantRecord
}

// 新建租户
export async function createTenant(
  tenant: Omit<TenantRecord, 'created_at' | 'updated_at'>
): Promise<TenantRecord | null> {
  if (!isSupabaseEnabled) {
    const tenants = readMock()
    const now = new Date().toISOString()
    const record: TenantRecord = { ...tenant, created_at: now, updated_at: now }
    tenants.unshift(record)
    writeMock(tenants)
    return record
  }

  const { data, error } = await supabase!
    .from('tenants')
    .insert(tenant)
    .select()
    .single()

  if (error) {
    console.error('[createTenant]', error)
    return null
  }
  return data as TenantRecord
}
