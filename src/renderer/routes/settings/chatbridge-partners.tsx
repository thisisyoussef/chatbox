import { createFileRoute } from '@tanstack/react-router'
import { PartnerPortal } from '@/components/settings/chatbridge/PartnerPortal'

export const Route = createFileRoute('/settings/chatbridge-partners')({
  component: RouteComponent,
})

export function RouteComponent() {
  return <PartnerPortal />
}
