import { create } from 'zustand'

export type ThemeMode = 'dark' | 'light'

const STORAGE_KEY = 'robot-ops-theme'

interface ThemeStore {
  mode: ThemeMode
  toggle: () => void
  setMode: (mode: ThemeMode) => void
  applyTheme: () => void
}

function readStoredTheme(): ThemeMode {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored === 'light' || stored === 'dark') return stored
  } catch {}
  return 'dark'
}

export const useThemeStore = create<ThemeStore>((set, get) => ({
  mode: readStoredTheme(),

  toggle: () => {
    const next = get().mode === 'dark' ? 'light' : 'dark'
    set({ mode: next })
    get().applyTheme()
    try {
      localStorage.setItem(STORAGE_KEY, next)
    } catch {}
  },

  setMode: (mode) => {
    set({ mode })
    get().applyTheme()
    try {
      localStorage.setItem(STORAGE_KEY, mode)
    } catch {}
  },

  applyTheme: () => {
    const { mode } = get()
    document.documentElement.setAttribute('data-theme', mode)
  },
}))
