/**
 * 品牌配置注册表
 * 统一管理所有机器人品牌的颜色、图标、协议、分类，用于 UI 一致性渲染
 */

export interface BrandConfig {
  name: string          // 显示名
  color: string         // 主题色（CSS 变量值或 hex）
  badgeBg: string       // 标签背景色
  icon: string          // emoji 图标
  protocol: string      // 默认协议
  category: 'industrial_arm' | 'mobile_robot' | 'collaborative'
}

export const BRAND_REGISTRY: Record<string, BrandConfig> = {
  fanuc:   { name: 'FANUC',   color: '#3b82f6', badgeBg: '#dbeafe', icon: '🤖', protocol: 'FOCAS',       category: 'industrial_arm' },
  kuka:    { name: 'KUKA',    color: '#ef4444', badgeBg: '#fee2e2', icon: '🦾', protocol: 'OPC_UA',      category: 'industrial_arm' },
  estun:   { name: 'ESTUN',   color: '#f97316', badgeBg: '#ffedd5', icon: '🏭', protocol: 'MODBUS_TCP',  category: 'industrial_arm' },
  yaskawa: { name: 'YASKAWA', color: '#22c55e', badgeBg: '#dcfce7', icon: '⚙️', protocol: 'ETHERNET',    category: 'industrial_arm' },
  abb:     { name: 'ABB',     color: '#a855f7', badgeBg: '#ede9fe', icon: '🔧', protocol: 'OPC_UA',      category: 'industrial_arm' },
  keenon:  { name: 'Keenon',  color: '#06b6d4', badgeBg: '#cffafe', icon: '🚶', protocol: 'REST',        category: 'mobile_robot' },
  unitree: { name: 'Unitree', color: '#9333ea', badgeBg: '#f3e8ff', icon: '🐕', protocol: 'ROS2',       category: 'mobile_robot' },
  pudutech:{ name: 'Pudu',   color: '#0891b2', badgeBg: '#cffafe', icon: '🤖', protocol: 'REST',        category: 'mobile_robot' },
  agibot:  { name: 'AGIBot',  color: '#14b8a6', badgeBg: '#ccfbf1', icon: '🤝', protocol: 'REST',        category: 'mobile_robot' },
}

export function getBrandConfig(brand: string): BrandConfig {
  return BRAND_REGISTRY[brand.toLowerCase()] || {
    name: brand.toUpperCase(),
    color: '#6b7280',
    badgeBg: '#f3f4f6',
    icon: '❓',
    protocol: 'UNKNOWN',
    category: 'collaborative',
  }
}
