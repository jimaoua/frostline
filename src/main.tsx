import { StrictMode } from 'react';
import ReactDOM from 'react-dom/client';
import { RouterProvider, createRouter } from '@tanstack/react-router';
import { routeTree } from './routeTree.gen';
import { registerServiceWorker } from './platform/install';
import './styles/global.css';

// Works at the site root or under a sub-path (GitHub Pages: /frostline/).
const basepath = import.meta.env.BASE_URL.replace(/\/$/, '') || '/';
const router = createRouter({ routeTree, defaultPreload: 'intent', basepath });

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}

registerServiceWorker();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
);
