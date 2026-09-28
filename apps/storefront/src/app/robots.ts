import type { MetadataRoute } from "next"
import { getBaseURL } from "@lib/util/env"

// Clarification: staging is public but must not be indexed by search engines.
export default function robots(): MetadataRoute.Robots {
  const allowIndexing = process.env.ALLOW_INDEXING === "true"

  return {
    rules: {
      userAgent: "*",
      allow: allowIndexing ? "/" : undefined,
      disallow: allowIndexing ? undefined : "/",
    },
    sitemap: allowIndexing ? `${getBaseURL()}/sitemap.xml` : undefined,
  }
}
