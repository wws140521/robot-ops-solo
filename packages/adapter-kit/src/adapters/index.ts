import type { UnifiedRobotState, UnifiedAlert } from '../types/unified'
import { adaptIncoming, adaptIncomingAlert, adaptCommercial } from './commercial'
import { adaptIndustrial, getRegisteredIndustrialBrands, registry } from './industrial/_registry'
import { adaptAerial, getRegisteredAerialBrands, aerialRegistry } from './aerial/_registry'

// 工业品牌目前就这几个，现场要加新的得先写 adapter
const INDUSTRIAL_BRANDS = new Set([
  'fanuc', 'kuka', 'estun', 'yaskawa',
])

// 低空品牌集合，机巢和起降场都归这里
const AERIAL_BRANDS = new Set([
  'dji-dock', 'autel-dock', 'generic-vertiport',
])

// adaptByBrand 的增强版，先认品牌再决定丢给谁处理
// 工业 → industrial/_registry，低空 → aerial/_registry，剩下的按商用老逻辑
export function adaptByBrandEnhanced(
  brand: string,
  raw: any
): { state: UnifiedRobotState; alerts: UnifiedAlert[] } {
  const lower = brand.toLowerCase()

  if (INDUSTRIAL_BRANDS.has(lower)) {
    return adaptIndustrial(lower, raw)
  }

  if (AERIAL_BRANDS.has(lower)) {
    return adaptAerial(lower, raw)
  }

  return adaptCommercial(brand, raw)
}

// 老代码可能还在用这些名字，先保留，后面再慢慢迁
export { adaptIncoming, adaptIncomingAlert, adaptCommercial }
export { adaptIndustrial, getRegisteredIndustrialBrands, registry }
export { adaptAerial, getRegisteredAerialBrands, aerialRegistry }

// 品牌白名单，4 商用 + 4 工业 + 3 低空，数错了别怪我
export const SUPPORTED_BRANDS = ['unitree', 'keenon', 'agibot', 'pudutech'] as const
export type Brand = typeof SUPPORTED_BRANDS[number]
export const INDUSTRIAL_BRAND_LIST = ['fanuc', 'kuka', 'estun', 'yaskawa'] as const
export const AERIAL_BRAND_LIST = ['dji-dock', 'autel-dock', 'generic-vertiport'] as const
