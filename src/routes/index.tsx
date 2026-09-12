import { createRoute } from '@tanstack/react-router'
import { Route as rootRoute } from './__root'
import { StartPage } from '@/components/startpage'

export const Route = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  component: StartPage,
})
