import { useMemo } from 'react'

/**
 * 从全局 CSS 变量读取数字孪生 3D 场景配色
 * —— 保证场景风格与 UI 主题（深色/浅色+贴牌换肤）自动同步
 *   (Three.js mesh 颜色走 JS，不支持 var()，所以用 getComputedStyle 读一次)
 */
export interface ScenePalette {
  bgTop: string
  bgBottom: string
  fog: string
  floor: string
  gridCell: string
  gridSection: string
  shadow: string
  wallPerim: string
  wallInner: string
  wallPerimEmissive: string
  wallInnerEmissive: string
  primary: string
  accent: string
}

const cssVarMap: Array<[keyof ScenePalette, string]> = [
  ['bgTop', '--scene-bg-top'],
  ['bgBottom', '--scene-bg-bottom'],
  ['fog', '--scene-fog'],
  ['floor', '--scene-floor'],
  ['gridCell', '--scene-grid-cell'],
  ['gridSection', '--scene-grid-section'],
  ['shadow', '--scene-shadow'],
  ['wallPerim', '--scene-wall-perim'],
  ['wallInner', '--scene-wall-inner'],
  ['wallPerimEmissive', '--scene-wall-perim-glow'],
  ['wallInnerEmissive', '--scene-wall-inner-glow'],
  ['primary', '--primary'],
  ['accent', '--accent'],
]

// 深色兜底（确保 SSR / 无 DOM 时不崩）
const FALLBACK: ScenePalette = {
  bgTop: '#0f1613',
  bgBottom: '#0a0f0c',
  fog: '#0a0f0c',
  floor: '#121916',
  gridCell: '#1a2420',
  gridSection: '#39ff8b',
  shadow: '#000000',
  wallPerim: '#2a3e34',
  wallInner: '#22342c',
  wallPerimEmissive: '#183a28',
  wallInnerEmissive: '#193545',
  primary: '#39ff8b',
  accent: '#5ecbff',
}

function readCssVar(name: string, fallback: string): string {
  if (typeof window === 'undefined' || !window.getComputedStyle) return fallback
  const v = window.getComputedStyle(document.documentElement).getPropertyValue(name).trim()
  return v || fallback
}

export function useScenePalette(): ScenePalette {
  return useMemo(() => {
    const out: any = {}
    for (const [key, cssVar] of cssVarMap) {
      out[key] = readCssVar(cssVar, FALLBACK[key])
    }
    return out as ScenePalette
    // 依赖 window.location.search（tenant 切换）+ themeStore 间接影响 CSS 变量
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
}
