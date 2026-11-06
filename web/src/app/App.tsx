import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SessionProvider } from './SessionProvider';
import { AppRoutes } from './routes';

/**
 * Client TanStack Query : `staleTime` 60 s sur les listes, `refetchOnWindowFocus`
 * pour les evenements ouverts et les actions en retard (section 11.5).
 */
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      gcTime: 5 * 60_000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <SessionProvider>
        <AppRoutes />
      </SessionProvider>
    </QueryClientProvider>
  );
}
