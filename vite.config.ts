import { defineConfig } from "vite";

export default defineConfig({
  base: "/illumination-webgpu/",
  build: {
    rollupOptions: {
      input: {
        main: "index.html",
      },
    },
  },
});
