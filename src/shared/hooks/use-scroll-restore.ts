"use client";

import { useEffect } from "react";
import { restoreScrollPosition } from "@/shared/lib/public-profile-navigation";

export function useScrollRestore() {
  useEffect(() => {
    restoreScrollPosition();
  }, []);
}
