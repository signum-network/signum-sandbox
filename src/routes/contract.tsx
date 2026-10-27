import { createRoute } from '@tanstack/react-router'
import { Route as rootRoute } from './__root'
import { ContractPage } from '@/components/contracts/ContractPage'

export const Route = createRoute({
  getParentRoute: () => rootRoute,
  path: '/contracts/$contractId',
  component: function ContractRoute() {
    const { contractId } = Route.useParams()
    return <ContractPage param={contractId} />
  },
})
