import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Dev-only: allow the LAN IP used for tablet/iPad testing to load Next dev
  // resources (HMR etc.). Ignored in production builds.
  allowedDevOrigins: ["192.168.0.229"],
  experimental: {
    // proxy.ts buffers the request body; the default 10MB cap truncated large
    // PDF uploads (/api/books/pdf), breaking FormData parsing. Match the
    // route's 50MB limit.
    //
    // NOTE: this only covers routes that go THROUGH proxy. Blob uploads use
    // /api/files, which is excluded from the matcher precisely so the body
    // streams to disk without being buffered or silently truncated at all.
    proxyClientMaxBodySize: "50mb",
  },
};

export default nextConfig;
