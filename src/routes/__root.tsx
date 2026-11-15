import { Outlet, createRootRoute } from '@tanstack/react-router';

export const Route = createRootRoute({
  component: RootLayout,
  notFoundComponent: () => <div className="not-found">Nothing out here but snow.</div>,
});

function RootLayout() {
  return <Outlet />;
}
