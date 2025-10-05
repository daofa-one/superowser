import { crx } from '@crxjs/vite-plugin'
import Vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vite'
import { fileURLToPath, URL } from 'url'
import manifest from './manifest.config'

// https://vitejs.dev/config/
export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      '~': fileURLToPath(new URL('./src', import.meta.url)),
      src: fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  plugins: [
    crx({ manifest }),
    Vue()
  ],
  build: {
    rollupOptions: {
      input: {
        sidepanel: 'sidepanel/index.html',
        options: 'options/index.html',
        authoring: 'authoring/index.html',
        'ai-bridge': 'src/content/ai-bridge.ts',
      },
      output: {
        entryFileNames: (chunkInfo) => {
          // Use predictable name for AI bridge
          if (chunkInfo.name === 'ai-bridge') {
            return 'assets/ai-bridge.js'
          }
          return 'assets/[name]-[hash].js'
        },
      },
    },
  },
  server: {
    port: 8888,
    strictPort: true,
    hmr: {
      port: 8889,
      overlay: true,
    },
  },
  optimizeDeps: {
    include: ['vue', 'monaco-editor'],
    exclude: ['vue-demi'],
  },
})
