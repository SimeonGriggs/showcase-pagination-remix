import { createClient } from "@sanity/client";

export const client = createClient({
  projectId: "v90vmunx",
  dataset: "production",
  apiVersion: "2023-10-01",
  useCdn: true,
  perspective: "published",
});
