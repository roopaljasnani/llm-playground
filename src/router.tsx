import { createBrowserRouter, type RouteObject } from 'react-router';
import App from './App';
import NotFound from './pages/NotFound';
import Playground from './pages/Playground';

export const routes: RouteObject[] = [
  {
    path: '/',
    element: <App />,
    errorElement: (
      <main>
        <NotFound />
      </main>
    ),
    children: [
      {
        index: true,
        element: <Playground />,
      },
      {
        path: '*',
        element: <NotFound />,
      },
    ],
  },
];

export const router = createBrowserRouter(routes);
