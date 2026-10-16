import { defineCloudflareConfig } from "@opennextjs/cloudflare";

const config = defineCloudflareConfig();
config.buildCommand = "NODE_ENV=production pnpm build";
export default config;
