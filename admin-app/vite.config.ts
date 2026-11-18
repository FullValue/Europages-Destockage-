import path from "node:path"
import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"

export default defineConfig({
  base: "/admin/",
  plugins: [react(), tailwindcss()],
  resolve: { alias: { "@": path.resolve(__dirname, "./src") } },
  build: { outDir: "../public/admin", emptyOutDir: true },
  server: { proxy: { "/api": "http://localhost:5173", "/assets": "http://localhost:5173" } },
})
