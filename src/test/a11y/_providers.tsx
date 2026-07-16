/**
 * Shared providers wrapper for a11y tests. Includes the real ThemeProvider
 * (lightweight, no network) plus QueryClient + MemoryRouter.
 */
import { ReactNode } from "react";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { TooltipProvider } from "@/components/ui/tooltip";

export function makeQueryClient() {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } });
}

export function TestProviders({
  children,
  initialEntries = ["/"],
}: {
  children: ReactNode;
  initialEntries?: string[];
}) {
  const client = makeQueryClient();
  return (
    <ThemeProvider>
      <QueryClientProvider client={client}>
        <TooltipProvider>
          <MemoryRouter initialEntries={initialEntries}>{children}</MemoryRouter>
        </TooltipProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}
