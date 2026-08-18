import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'

interface TenantTheme {
  primaryColor: string
  logoUrl?: string
  fontFamily?: string
  brandName: string
}

const defaultTheme: TenantTheme = {
  primaryColor: '#3b82f6',
  brandName: 'RobotOps',
}

const ThemeCtx = createContext<TenantTheme>(defaultTheme)

export function ThemeProvider({
  theme,
  children,
}: {
  theme?: Partial<TenantTheme>
  children: ReactNode
}) {
  const [t] = useState<TenantTheme>({ ...defaultTheme, ...theme })
  useEffect(() => {
    const r = document.documentElement
    r.style.setProperty('--primary-color', t.primaryColor)
    r.style.setProperty('--brand-name', `"${t.brandName}"`)
    if (t.fontFamily) r.style.setProperty('--font-family', t.fontFamily)
  }, [t])
  return <ThemeCtx.Provider value={t}>{children}</ThemeCtx.Provider>
}

export function useTheme() { return useContext(ThemeCtx) }
