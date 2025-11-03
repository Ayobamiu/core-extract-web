"use client";

import { useEffect } from "react";

// This must be imported before any antd components
// Import at the top level to ensure it runs first
import "@ant-design/v5-patch-for-react-19";

export default function AntdPatchProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  // Ensure patch is applied on mount
  useEffect(() => {
    // Patch should already be applied via import, but this ensures it's loaded
    if (typeof window !== "undefined") {
      // Suppress the warning if patch is loaded
      const originalWarn = console.warn;
      console.warn = (...args: any[]) => {
        if (
          args[0]?.includes?.("antd: compatible") ||
          args[0]?.includes?.("antd v5 support React")
        ) {
          // Suppress the compatibility warning
          return;
        }
        originalWarn.apply(console, args);
      };

      return () => {
        console.warn = originalWarn;
      };
    }
  }, []);

  return <>{children}</>;
}
