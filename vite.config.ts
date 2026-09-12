import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig(({ command }) => ({
  plugins: [react()],
  // The extension host exposes React's production JSX runtime. Some authoring
  // environments keep NODE_ENV=development globally; without this override,
  // Vite emits jsxDEV even for `vite build`, which crashes inside Studio.
  esbuild: {
    jsxDev: command !== "build",
  },
  define: {
    "process.env.NODE_ENV": JSON.stringify(
      command === "build" ? "production" : "development",
    ),
  },
  build: {
    lib: {
      entry: path.resolve(__dirname, "src/index.tsx"),
      formats: ["es"],
      fileName: () => "index.mjs",
    },
    rollupOptions: {
      external: [
        "react",
        "react-dom",
        "react/jsx-runtime",
        "react/jsx-dev-runtime",
        "@avg-studio/sdk",
      ],
    },
    outDir: "dist",
    emptyOutDir: true,
    sourcemap: true,
    minify: false,
  },
}));
