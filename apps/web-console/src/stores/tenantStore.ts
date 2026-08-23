import { create } from 'zustand'

export interface Tenant {
  id: string
  name: string
  logoUrl?: string
  primaryColor: string
  domain: string
}

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const match = hex.replace('#', '').match(/^([a-f\d]{6})$/i)
  if (!match) return null
  const num = parseInt(match[1], 16)
  return { r: (num >> 16) & 255, g: (num >> 8) & 255, b: num & 255 }
}

function applyPrimaryColor(color: string) {
  const r = document.documentElement
  r.style.setProperty('--primary', color)
  r.style.setProperty('--primary-color', color)
  const rgb = hexToRgb(color)
  if (rgb) {
    r.style.setProperty('--primary-dim', `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.15)`)
    r.style.setProperty('--primary-glow', `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.45)`)
    r.style.setProperty(
      '--glow-primary',
      `0 0 12px rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.30)`,
    )
    r.style.setProperty(
      '--glow-primary-lg',
      `0 0 24px rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.20)`,
    )
    r.style.setProperty(
      '--neon-glow',
      `0 0 12px rgba(${rgb.r},${rgb.g},${rgb.b},.45), 0 0 30px rgba(${rgb.r},${rgb.g},${rgb.b},.18)`,
    )
    r.style.setProperty('--neon', color)
    r.style.setProperty('--neon-soft', color)
  }
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
    applyPrimaryColor(tenant.primaryColor)
  },

  applyBranding: () => {
    const t = useTenantStore.getState().tenant
    if (t) {
      applyPrimaryColor(t.primaryColor)
    }
  },
}))
