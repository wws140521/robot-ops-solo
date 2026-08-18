import type { UnifiedRobotState, UnifiedAlert } from '../types/unified'
import { adaptIncoming, adaptIncomingAlert, adaptCommercial } from './commercial'
import { adaptIndustrial, getRegisteredIndustrialBrands, registry } from './industrial/_registry'

// 工业品牌集合
const INDUSTRIAL_BRANDS = new Set([
  'fanuc', 'kuka', 'estun', 'yaskawa',
])

/**
 * 增强版 adaptByBrand
 * - 工业品牌 → 走 industrial/_registry
 * - 商用品牌 → 走 commercial 逻辑
 */
export function adaptByBrandEnhanced(
  brand: string,
  raw: any
): { state: UnifiedRobotState; alerts: UnifiedAlert[] } {
  const lower = brand.toLowerCase()

  if (INDUSTRIAL_BRANDS.has(lower)) {
    return adaptIndustrial(lower, raw)
  }

  return adaptCommercial(brand, raw)
}

// re-export 保持向后兼容
export { adaptIncoming, adaptIncomingAlert, adaptCommercial }
export { adaptIndustrial, getRegisteredIndustrialBrands, registry }

// 品牌注册表 —— 4 商用 + 4 工业
export const SUPPORTED_BRANDS = ['unitree', 'keenon', 'agibot', 'pudutech'] as const
export type Brand = typeof SUPPORTED_BRANDS[number]
export const INDUSTRIAL_BRAND_LIST = ['fanuc', 'kuka', 'estun', 'yaskawa'] as const
