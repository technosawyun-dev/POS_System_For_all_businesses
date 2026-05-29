import { useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useAuthStore } from '@/store/auth.store'
import { tenantService } from '@/services/tenant/tenant.service'
import { setFormatterConfig } from '@/lib/formatterConfig'

export function TenantFormatterSync() {
  const tenantId = useAuthStore(s => s.user?.tenant_id)

  const { data: tenant } = useQuery({
    queryKey: ['tenant', tenantId],
    queryFn: () => tenantService.getTenant(tenantId!),
    enabled: !!tenantId,
    staleTime: 10 * 60 * 1000,
  })

  useEffect(() => {
    if (tenant) {
      setFormatterConfig({
        currency: tenant.currency,
        locale: tenant.locale,
        timezone: tenant.timezone,
      })
    }
  }, [tenant])

  return null
}
