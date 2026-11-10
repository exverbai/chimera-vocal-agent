import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";

const chimera = fileURLToPath(new URL("../../vendor/chimera", import.meta.url));

// The stage imports the engine and the views straight from the upstream checkout
// (vendor/chimera, a git submodule). Its packages resolve to this package's copies.
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { "@chimera": `${chimera}/src` },
    dedupe: ["react", "react-dom", "three", "zustand"],
  },
  // fonts and the pronouncing dictionary (/data/cmudict.txt.gz)
  publicDir: `${chimera}/public`,
  worker: { format: "es" },
  build: { target: "es2022", outDir: "dist", emptyOutDir: true },
  server: { host: "127.0.0.1", port: 5319, strictPort: true, fs: { allow: ["../.."] } },
});
