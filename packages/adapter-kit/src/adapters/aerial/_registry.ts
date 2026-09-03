/**
 * 低空 / 机巢品牌注册表
 * 新增低空设备只需在此注册 + 创建 adapter 文件
 */
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
