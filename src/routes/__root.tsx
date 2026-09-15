import { createRootRoute, Outlet } from '@tanstack/react-router'
import { ThemeShimmer } from '@/motion'

export const Route = createRootRoute({
  component: () => (
    <div className="relative min-h-screen overflow-x-hidden" style={{ background: 'var(--bg)' }}>
      {/*
        Inset by one cell on every side so the drifting grid never exposes an
        unpainted edge as it travels.
      */}
      <div
        className="motion-grid pointer-events-none fixed -inset-[40px] z-0"
        style={{
          backgroundImage: `
            linear-gradient(var(--grid-line) 1px, transparent 1px),
            linear-gradient(90deg, var(--grid-line) 1px, transparent 1px)`,
          backgroundSize: '40px 40px',
        }}
      />
      <div className="relative z-10">
        <Outlet />
      </div>
      <ThemeShimmer />
    </div>
  ),
})
