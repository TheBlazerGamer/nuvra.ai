import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Nuvra.AI',
    short_name: 'Nuvra.AI',
    description: 'Gestão autônoma de tráfego pago no Meta Ads, operada por IA.',
    start_url: '/',
    display: 'standalone',
    background_color: '#010C28',
    theme_color: '#1747E9',
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      {
        src: '/icons/icon-512-maskable.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  };
}
