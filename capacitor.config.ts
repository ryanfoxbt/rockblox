import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.rockblox.app',
  appName: 'RockBlox',
  webDir: 'mobile-shell',
  server: {
    // RockBlox relies on server-rendered routes and API routes (Neon, Blob,
    // Inngest, Replicate) that a static export can't carry, so the native
    // shell loads the live deployment instead of bundled local assets.
    url: 'https://rockblocks.app',
  },
};

export default config;
