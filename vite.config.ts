import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import tailwindcss from "@tailwindcss/vite";

// GitHub Pages project site: https://bitsnaps.github.io/smartphone_pricing/
// If you deploy under a different path (custom domain / user site), change `base`.
export default defineConfig({
  base: "/smartphone_pricing/",
  plugins: [tailwindcss(), vue()],
  build: {
    // the lazy-loaded model chunk bundles ~3.3 MB of tree JSON (~600 KB gzipped)
    chunkSizeWarningLimit: 4096,
  },
});
