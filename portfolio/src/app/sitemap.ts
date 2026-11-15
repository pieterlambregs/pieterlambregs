import type { MetadataRoute } from "next";
import { projects } from "@/content/projects";
import { site } from "@/content/site";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: site.url, priority: 1 },
    { url: `${site.url}/work`, priority: 0.8 },
    ...projects.map((p) => ({ url: `${site.url}/work/${p.slug}`, priority: 0.7 })),
  ];
}
