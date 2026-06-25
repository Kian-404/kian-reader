/// <reference types="vitest" />

import legacy from '@vitejs/plugin-legacy'
import vue from '@vitejs/plugin-vue'
import path from 'path'
import { defineConfig } from 'vite'
import AutoImport from 'unplugin-auto-import/vite'
import Components from 'unplugin-vue-components/vite'
import { ElementPlusResolver } from 'unplugin-vue-components/resolvers'
import ElementPlus from 'unplugin-element-plus/vite'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    vue(),
    legacy(),
    AutoImport({
      resolvers: [ElementPlusResolver({ importStyle: !process.env.VITEST })],
    }),
    Components({
      resolvers: [ElementPlusResolver({ importStyle: !process.env.VITEST })],
    }),
    // Skip element-plus CSS injection during test (Node.js can't load .css)
    ...(process.env.VITEST ? [] : [ElementPlus({})]),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts'],
    deps: {
      inline: ['epubjs', 'pdfjs-dist'],
    },
  }
})
