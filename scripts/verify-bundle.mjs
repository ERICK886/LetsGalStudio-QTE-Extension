import { readFile } from "node:fs/promises";

const bundleUrl = new URL("../dist/index.mjs", import.meta.url);
const bundle = await readFile(bundleUrl, "utf8");

if (/\bjsxDEV\b|react\/jsx-dev-runtime/.test(bundle)) {
  throw new Error(
    "dist/index.mjs contains React's development JSX runtime. " +
      "LetsGal Studio only exposes react/jsx-runtime.",
  );
}

if (!/from\s+["']react\/jsx-runtime["']/.test(bundle)) {
  throw new Error("dist/index.mjs does not import the expected production JSX runtime.");
}

console.log("Bundle verification passed: production JSX runtime only.");
