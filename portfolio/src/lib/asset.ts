/**
 * The folder the site is served from: "" at the domain root, or e.g.
 * "/nieuw" when it is uploaded to a subfolder. Set at build time with
 * BASE_PATH (see next.config.ts).
 */
export const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

/** Prefix a file from /public with the base path. Next only does this for links. */
export const asset = (path: string) => `${basePath}${path}`;
