import { SITE } from "../lib/site";

// Only public, indexable pages. Account, booking and dashboard pages are noindex.
export default function sitemap() {
  const now = new Date();
  return [
    { url: `${SITE.url}/`, lastModified: now, changeFrequency: "weekly", priority: 1 },
    { url: `${SITE.url}/partner/signup`, lastModified: now, changeFrequency: "monthly", priority: 0.6 },
  ];
}
