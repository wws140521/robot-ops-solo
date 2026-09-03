// 工业品牌注册表，fanuc/kuka/estun/yaskawa 这几个老家伙
// 新来的品牌先写 adapter 再注册，别让野协议数据混进来
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
