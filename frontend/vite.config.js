import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// The Node app keeps owning every JSON endpoint; Vite serves the rebuilt
// frontend on the single preview origin and proxies backend paths to it.
const apiTarget = process.env.API_PROXY_TARGET || 'http://api:3001'

const proxied = [
  '/api',
  '/assets',
  '/fonts',
  '/uploaded-fonts',
  '/help-media',
  '/appearance',
  '/interface-text',
  '/element-overrides',
  '/layouts',
  '/logo',
  '/sidebar-logo',
  '/favicon.png',
  '/apple-touch-icon.png',
]

const hosts = [
  process.env.BASE44_SANDBOX_HOST_DOMAIN && `.${process.env.BASE44_SANDBOX_HOST_DOMAIN}`,
  process.env.BASE44_PUBLIC_HOST_SUFFIX && `3000-${process.env.BASE44_PUBLIC_HOST_SUFFIX}`,
].filter(Boolean)

export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 3000,
    strictPort: true,
    allowedHosts: hosts.length ? hosts : undefined,
    // Bind mounts do not always emit inotify events inside containers.
    watch: { usePolling: true, interval: 300 },
    proxy: Object.fromEntries(
      proxied.map((path) => [path, { target: apiTarget, changeOrigin: false }]),
    ),
  },
})
