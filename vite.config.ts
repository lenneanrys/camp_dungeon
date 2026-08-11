import { defineConfig } from 'vitest/config'

export default defineConfig({
  // host: true exposes the dev server on the LAN so a phone can reach it.
  server: { host: true, port: 5173 },
  test: { globals: true, environment: 'node' },
})
