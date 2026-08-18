import { create } from 'zustand'

export interface Tenant {
  id: string
  name: string
  logoUrl?: string
  primaryColor: string
  domain: string
}

interface TenantStore {
  tenant: Tenant | null
  setTenant: (t: Tenant) => void
  applyBranding: () => void
}

export const useTenantStore = create<TenantStore>((set) => ({
  tenant: null,

  setTenant: (tenant) => {
    set({ tenant })
    // 应用品牌色到 CSS 变量
    document.documentElement.style.setProperty('--primary-color', tenant.primaryColor)
  },

  applyBranding: () => {
    const t = useTenantStore.getState().tenant
    if (t) {
      document.documentElement.style.setProperty('--primary-color', t.primaryColor)
    }
  },
}))
