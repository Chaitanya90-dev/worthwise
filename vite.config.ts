import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [tailwindcss(), react()],
  build: {
    chunkSizeWarningLimit: 750,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules")) {
            return;
          }

          if (id.includes("@mantine/") || id.includes("@emotion/")) {
            return "mantine";
          }

          if (id.includes("recharts")) {
            return "charts";
          }

          if (id.includes("@supabase/")) {
            return "supabase";
          }

          if (id.includes("react-router")) {
            return "router";
          }
        },
      },
    },
  },
})
