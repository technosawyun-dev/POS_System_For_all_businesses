import { useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useAuthStore } from '@/store/auth.store'
import { tenantService } from '@/services/tenant/tenant.service'
import { setFormatterConfig } from '@/lib/formatterConfig'
import { useLocaleStore } from '@/i18n/localeStore'

export function TenantFormatterSync() {
  const tenantId = useAuthStore(s => s.user?.tenant_id)
  const setLocale = useLocaleStore(s => s.setLocale)

  const { data: tenant } = useQuery({
    queryKey: ['tenant', tenantId],
    queryFn: () => tenantService.getTenant(tenantId!),
    enabled: !!tenantId,
    staleTime: 10 * 60 * 1000,
  })

  useEffect(() => {
    if (tenant) {
      const mmkLabel = tenant.locale === 'my-MM' ? 'ကျပ်' : 'Kyats'
      setFormatterConfig({
        currency: tenant.currency === 'MMK' ? mmkLabel : tenant.currency,
        locale: tenant.locale,
        timezone: tenant.timezone,
      })
      setLocale(tenant.locale)
    }
  }, [tenant, setLocale])

  return null
}
