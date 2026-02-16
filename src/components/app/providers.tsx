"use client";

import { Toaster } from "sonner";
import { ThemeProvider, useTheme } from "@/components/app/theme-provider";

function AppToaster() {
  const { theme } = useTheme();

  return <Toaster position="top-right" richColors closeButton theme={theme} />;
}

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      {children}
      <AppToaster />
    </ThemeProvider>
  );
}
