import { defineCloudflareConfig } from "@opennextjs/cloudflare";

// Next.js ISR/data cache is not used by this app (we cache in our own KV layer),
// so no incremental cache binding is configured here.
export default defineCloudflareConfig({});
