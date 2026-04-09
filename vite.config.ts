import { defineConfig } from "vite";

export default defineConfig({
  base: "/illumination_students/",
  build: {
    rollupOptions: {
      input: {
        main: "index.html",
      },
    },
  },
});
