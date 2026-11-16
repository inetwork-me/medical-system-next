"use client";

import { Direction } from "radix-ui";
import { ThemeProvider } from "next-themes";
import type { ReactNode } from "react";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";

export function Providers({ dir, children }: { dir: "ltr" | "rtl"; children: ReactNode }) {
  return (
    // Dark mode is postponed: the toggle exists in the design, but only the light theme is shipped for now.
    <ThemeProvider attribute="class" defaultTheme="light" forcedTheme="light" disableTransitionOnChange>
      <Direction.Provider dir={dir}>
        <TooltipProvider>
          {children}
          <Toaster />
        </TooltipProvider>
      </Direction.Provider>
    </ThemeProvider>
  );
}
