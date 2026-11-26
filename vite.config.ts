import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import fs from 'fs';
import path from 'path';
import { defineConfig, Plugin } from 'vite';

function copyAssetsFolderPlugin(): Plugin {
  return {
    name: 'copy-root-assets-folder',
    closeBundle() {
      const srcDir = path.resolve(process.cwd(), 'Assets');
      const destDir = path.resolve(process.cwd(), 'dist', 'Assets');
      if (!fs.existsSync(srcDir)) return;
      fs.mkdirSync(destDir, { recursive: true });
      for (const entry of fs.readdirSync(srcDir, { withFileTypes: true })) {
        if (entry.isFile()) {
          fs.copyFileSync(path.join(srcDir, entry.name), path.join(destDir, entry.name));
        }
      }
    }
  };
}

export default defineConfig(() => {
  return {
    plugins: [
      react(),
      tailwindcss(),
      copyAssetsFolderPlugin(),
      VitePWA({
        registerType: 'autoUpdate',
        injectRegister: false, // we register public/firebase-messaging-sw.js ourselves (it handles push)
        includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'icon.svg', 'icon-192.png', 'icon-512.png', 'icon-maskable-512.png'],
        manifest: false,
        workbox: {
          maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
          globPatterns: ['**/*.{js,css,html,ico,png,svg,woff,woff2}'],
          navigateFallbackDenylist: [/^\/api\//, /^\/Assets\//]
        },
        devOptions: {
          enabled: false
        }
      })
    ],
    resolve: {
      alias: {
        '@': path.resolve(process.cwd(), '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
