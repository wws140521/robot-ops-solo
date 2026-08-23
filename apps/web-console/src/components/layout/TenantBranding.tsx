import { useEffect, type ReactNode } from 'react'
import { useTenantStore } from '../../stores/tenantStore'

// 从域名/环境变量识别租户并应用品牌
export function TenantBranding({ children }: { children: ReactNode }) {
  const { tenant, setTenant, applyBranding } = useTenantStore()

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const tenantId = params.get('tenant') ?? 'default'

    const mockTenants: Record<string, any> = {
      default:  { id: 'default',  name: 'Robot-Ops 控制台',  primaryColor: '#39ff8b', domain: 'localhost' },
      laowang:  { id: 'laowang',  name: '老王机器人运营中心', primaryColor: '#fa541c', domain: 'laowang' },
      hotpot01: { id: 'hotpot01', name: '蜀大侠机器人后台',  primaryColor: '#f5222d', domain: 'hotpot01' },
    }

    const t = mockTenants[tenantId] ?? mockTenants.default
    setTenant(t)
  }, [setTenant])

  useEffect(() => {
    applyBranding()
  }, [tenant, applyBranding])

  return <>{children}</>
}
