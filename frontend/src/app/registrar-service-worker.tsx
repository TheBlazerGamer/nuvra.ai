'use client';

import { useEffect } from 'react';

export function RegistrarServiceWorker() {
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch((erro) => {
        console.error('Falha ao registrar service worker:', erro);
      });
    }
  }, []);

  return null;
}
