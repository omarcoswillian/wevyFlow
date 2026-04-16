"use client";

import { useEffect } from "react";

export function PWARegister() {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker
        .register("/sw.js")
        .then((reg) => {
          // Auto-update when new SW is available
          reg.onupdatefound = () => {
            const installing = reg.installing;
            if (!installing) return;
            installing.onstatechange = () => {
              if (installing.state === "installed" && navigator.serviceWorker.controller) {
                // New content available — could show a toast here
                console.log("[WavyFlow] Nova versao disponivel. Recarregue para atualizar.");
              }
            };
          };
        })
        .catch((err) => console.warn("[WavyFlow] SW registration failed:", err));
    }
  }, []);

  return null;
}
