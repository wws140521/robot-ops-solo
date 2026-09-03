import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'

interface TenantTheme {
  primaryColor: string
  logoUrl?: string
  fontFamily?: string
  brandName: string
}

const defaultTheme: TenantTheme = {
  primaryColor: '#39ff8b',
  brandName: 'RobotOps',
}

// 把 hex 转成 rgb，解析失败就返回 null
function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const match = hex.replace('#', '').match(/^([a-f\d]{6})$/i)
  if (!match) return null
  const num = parseInt(match[1], 16)
  return { r: (num >> 16) & 255, g: (num >> 8) & 255, b: num & 255 }
}

// 把主色写到根节点的 CSS 变量，顺便生成几个发光阴影变量
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

const ThemeCtx = createContext<TenantTheme>(defaultTheme)

// 主题上下文提供者，切换主色时自动更新 CSS 变量
export function ThemeProvider({
  theme,
  children,
}: {
  theme?: Partial<TenantTheme>
  children: ReactNode
}) {
  const [t] = useState<TenantTheme>({ ...defaultTheme, ...theme })
  useEffect(() => {
    applyPrimaryColor(t.primaryColor)
    document.documentElement.style.setProperty('--brand-name', `"${t.brandName}"`)
    if (t.fontFamily) document.documentElement.style.setProperty('--font-family', t.fontFamily)
  }, [t])
  return <ThemeCtx.Provider value={t}>{children}</ThemeCtx.Provider>
}

// 取当前主题
export function useTheme() { return useContext(ThemeCtx) }
