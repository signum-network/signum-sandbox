import { createRoute } from '@tanstack/react-router'
import { Route as rootRoute } from './__root'
import { ScenarioPage } from '@/components/scenarios/ScenarioPage'

export const Route = createRoute({
  getParentRoute: () => rootRoute,
  path: '/scenarios',
  component: ScenarioPage,
})
