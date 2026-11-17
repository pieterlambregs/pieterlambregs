import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
