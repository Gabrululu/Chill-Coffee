/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  // A production verification must not overwrite a running dev server's cache.
  distDir: process.env.NODE_ENV === 'production' ? '.next' : '.next-dev',
};
export default nextConfig;
