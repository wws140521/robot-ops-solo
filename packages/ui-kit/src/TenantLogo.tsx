interface Props {
  logoUrl?: string
  tenantName: string
  primaryColor?: string
  size?: number
}

// 租户 Logo + 名称（贴牌用）
export function TenantLogo({ logoUrl, tenantName, primaryColor = '#1890ff', size = 32 }: Props) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      {logoUrl ? (
        <img
          src={logoUrl}
          alt={tenantName}
          style={{ width: size, height: size, borderRadius: 6, objectFit: 'cover' }}
        />
      ) : (
        <div
          style={{
            width: size,
            height: size,
            borderRadius: 6,
            background: primaryColor,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#fff',
            fontWeight: 700,
            fontSize: 14,
          }}
        >
          {tenantName.charAt(0).toUpperCase()}
        </div>
      )}
      <span style={{ fontWeight: 600, fontSize: 15, color: '#333' }}>{tenantName}</span>
    </div>
  )
}
