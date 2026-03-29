import { defineConfig } from "vite"
import { fileURLToPath } from "url"
import dts from "vite-plugin-dts"

const entry = fileURLToPath(new URL("./src/ghostmesh.ts", import.meta.url))

export default defineConfig({
  plugins: [
    dts({
      include: ["src/ghostmesh.ts", "src/shims.d.ts"],
      outDir: "dist"
    })
  ],
  build: {
    lib: {
      entry,
      name: 'GhostMesh',
      fileName: 'ghostmesh',
      formats: ['umd', 'cjs', 'es', 'iife']
    },
    rollupOptions: {
      // Externalize deps that shouldn't be bundled
      external: [],
      output: {
        exports: 'named'
      }
    }
  },
  server: {
    // Listen on all interfaces so the dev server is reachable outside localhost.
    host: '0.0.0.0',
    port: 6083
  }
})
