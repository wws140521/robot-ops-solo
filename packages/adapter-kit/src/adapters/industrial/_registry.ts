/**
 * 工业品牌注册表
 * 新增品牌只需在此注册 + 创建 adapter 文件
 */
import type { UnifiedRobotState, UnifiedAlert } from '../../types/unified';
import { adaptFanuc } from './adapter-fanuc';
import { adaptKuka } from './adapter-kuka';
import { adaptEstun } from './adapter-estun';
import { adaptYaskawa } from './adapter-yaskawa';

export type AdapterFn = (raw: any) => {
  state: UnifiedRobotState;
  alerts: UnifiedAlert[];
};

export const registry: Record<string, AdapterFn> = {
  fanuc: adaptFanuc,
  kuka: adaptKuka,
  estun: adaptEstun,
  yaskawa: adaptYaskawa,
};

export function adaptIndustrial(
  brand: string,
  raw: any
): { state: UnifiedRobotState; alerts: UnifiedAlert[] } {
  const fn = registry[brand.toLowerCase()];
  if (!fn) {
    throw new Error(
      `[adapter-kit] Unknown industrial brand: "${brand}". ` +
      `Registered: ${Object.keys(registry).join(', ')}`
    );
  }
  return fn(raw);
}

export function getRegisteredIndustrialBrands(): string[] {
  return Object.keys(registry);
}
