import type { NextConfig } from "next";

// Upload folder on the host: "" for the domain root, "/nieuw" for a subfolder.
// Build with e.g. `BASE_PATH=/nieuw npm run build`.
const basePath = process.env.BASE_PATH ?? "";

const nextConfig: NextConfig = {
  basePath,
  env: { NEXT_PUBLIC_BASE_PATH: basePath },
  // Static export: `npm run build` writes plain HTML/CSS/JS to `out/`, which
  // is what gets uploaded to shared hosting (one.com). No Node server needed.
  output: "export",
  // /work -> /work/index.html, so Apache serves every route without rewrites.
  trailingSlash: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  images: {
    // No image server on static hosting: the WebP files in /public are served as-is.
    unoptimized: true,
  },
};

export default nextConfig;
