// 低空机巢和起降场的注册表
// 要加新品牌就往里塞一个 adapter，找不到的直接报错，免得用错模型
import type { UnifiedRobotState, UnifiedAlert } from '../../types/unified'
import { adaptDJIDock } from './adapter-dji-dock'
import { adaptAutelDock } from './adapter-autel-dock'
import { adaptVertiport } from './adapter-vertiport'

export type AerialAdapterFn = (raw: any) => {
  state: UnifiedRobotState
  alerts: UnifiedAlert[]
}

export const aerialRegistry: Record<string, AerialAdapterFn> = {
  'dji-dock': adaptDJIDock,
  'autel-dock': adaptAutelDock,
  'generic-vertiport': adaptVertiport,
}

export function adaptAerial(brand: string, raw: any): { state: UnifiedRobotState; alerts: UnifiedAlert[] } {
  const fn = aerialRegistry[brand.toLowerCase()]
  if (!fn) {
    throw new Error(
      `[adapter-kit] Unknown aerial brand: "${brand}". ` +
      `Registered: ${Object.keys(aerialRegistry).join(', ')}`
    )
  }
  return fn(raw)
}

export function getRegisteredAerialBrands(): string[] {
  return Object.keys(aerialRegistry)
}
