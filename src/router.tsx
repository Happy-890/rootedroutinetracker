import { LoadingScreen } from "@/components/rooted/LoadingScreen";
import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";

export const getRouter = () => {
  const queryClient = new QueryClient();

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    defaultPendingComponent: LoadingScreen,
    defaultPendingMs: 150,
    defaultPendingMinMs: 0,
    defaultPreloadStaleTime: 0,
  });

  return router;
};
