import { createRoute } from '@tanstack/react-router'
import { Route as rootRoute } from './__root'
import { ConsoleShell } from '@/components/console'

export const Route = createRoute({
  getParentRoute: () => rootRoute,
  path: '/console',
  component: ConsoleShell,
})
