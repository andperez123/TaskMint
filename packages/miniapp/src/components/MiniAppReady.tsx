"use client";

import { useEffect } from "react";
import sdk from "@farcaster/frame-sdk";

export function MiniAppReady() {
  useEffect(() => {
    // Signal to the Base App / Warpcast frame that the mini app is loaded
    sdk.actions.ready();
  }, []);

  return null;
}
