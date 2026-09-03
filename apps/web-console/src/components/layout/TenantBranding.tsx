import { useEffect, type ReactNode } from 'react'
import { useTenantStore } from '../../stores/tenantStore'

// 根据 URL 参数或域名识别租户，然后套用对应品牌色/Logo
export function TenantBranding({ children }: { children: ReactNode }) {
  const { tenant, setTenant, applyBranding } = useTenantStore()

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const tenantId = params.get('tenant') ?? 'default'

    // 先写死几个 mock 租户，后面再接真实后端
    const mockTenants: Record<string, any> = {
      default:  { id: 'default',  name: 'Robot-Ops 控制台',  primaryColor: '#39ff8b', domain: 'localhost' },
      laowang:  { id: 'laowang',  name: '老王机器人运营中心', primaryColor: '#fa541c', domain: 'laowang' },
      hotpot01: { id: 'hotpot01', name: '蜀大侠机器人后台',  primaryColor: '#f5222d', domain: 'hotpot01' },
    }

    const t = mockTenants[tenantId] ?? mockTenants.default
    setTenant(t)
  }, [setTenant])

  // tenant 变了就重新应用品牌色
  useEffect(() => {
    applyBranding()
  }, [tenant, applyBranding])

  return <>{children}</>
}
