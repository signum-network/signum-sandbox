import { createRouter, createHashHistory } from '@tanstack/react-router'
import { Route as rootRoute } from './routes/__root'
import { Route as indexRoute } from './routes/index'
import { Route as consoleRoute } from './routes/console'
import { Route as scenariosRoute } from './routes/scenarios'

const routeTree = rootRoute.addChildren([indexRoute, consoleRoute, scenariosRoute])

export const router = createRouter({
  routeTree,
  history: createHashHistory(),
})

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}
