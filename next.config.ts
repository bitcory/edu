import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // proxy.ts (clerkMiddleware) buffers the request body; the default 10MB cap
    // truncated large PDF uploads (/api/books/pdf), breaking FormData parsing.
    // Match the route's 50MB limit.
    proxyClientMaxBodySize: "50mb",
  },
};

export default nextConfig;
