"use client";

import { Direction } from "radix-ui";
import type { ReactNode } from "react";
import { Toaster } from "@/components/ds/toast";
import { TooltipProvider } from "@/components/ui/tooltip";

/**
 * App-wide providers. Dark mode is postponed (the toggle exists in the design, only the light theme ships),
 * so there is no theme provider: light is the default (no `.dark` class). When dark mode lands, add a
 * theme provider that sets the class without rendering an inline <script> inside the React tree
 * (React 19 warns about client-rendered scripts — that was the next-themes "Console Error").
 */
export function Providers({ dir, children }: { dir: "ltr" | "rtl"; children: ReactNode }) {
  return (
    <Direction.Provider dir={dir}>
      <TooltipProvider>
        {children}
        <Toaster />
      </TooltipProvider>
    </Direction.Provider>
  );
}
