import { createRoute } from '@tanstack/react-router'
import { Route as rootRoute } from './__root'
import { ConsoleShell } from '@/components/console'
import { parseConsoleSearch } from '@/lib/consoleNav'

export const Route = createRoute({
  getParentRoute: () => rootRoute,
  path: '/console',
  validateSearch: parseConsoleSearch,
  component: function ConsoleRoute() {
    const { watch } = Route.useSearch()
    return <ConsoleShell watch={watch} />
  },
})
