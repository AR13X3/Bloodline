import { resolve } from "node:path";
import { defineConfig } from "vite";

export default defineConfig({
  // "/" for Cloudflare Pages or a custom domain; the GitHub Pages workflow sets
  // BASE_PATH to "/<repo>/" because project sites live under that subpath.
  base: process.env.BASE_PATH || "/",
  server: { port: 5180 },
  preview: { port: 5180 },
  build: {
    target: "es2020",
    assetsInlineLimit: 0,
    rollupOptions: {
      // Two pages: the site, and /connect (Cloudflare Pages serves connect.html at /connect).
      input: {
        main: resolve(import.meta.dirname, "index.html"),
        connect: resolve(import.meta.dirname, "connect.html"),
      },
    },
  },
});
