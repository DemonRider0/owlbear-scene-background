import { defineConfig } from "vite";

export default defineConfig({
  base: "./",
  server: {
    cors: {
      origin: "https://www.owlbear.rodeo",
    },
  },
  optimizeDeps: {
    exclude: ["@owlbear-rodeo/sdk"],
  },
  build: {
    rollupOptions: {
      input: {
        action: "index.html",
        background: "background.html",
      },
    },
  },
});
