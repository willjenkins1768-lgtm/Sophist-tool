"use client";

import { DRCMProvider } from "@/context/DRCMContext";

export function Providers({ children }: { children: React.ReactNode }) {
  return <DRCMProvider>{children}</DRCMProvider>;
}
