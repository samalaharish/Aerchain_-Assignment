/** @type {import('next').NextConfig} */
const vendorResponseFixtures = ["./fixtures/vendor-responses/**/*"];

const nextConfig = {
  reactStrictMode: true,
  experimental: {
    serverComponentsExternalPackages: ["pdfjs-dist"],
    outputFileTracingIncludes: {
      "/responses": vendorResponseFixtures,
      "/responses/[documentId]": vendorResponseFixtures,
      "/api/extractions/[documentId]/run": vendorResponseFixtures,
      "/comparison": vendorResponseFixtures,
      "/exceptions": vendorResponseFixtures,
      "/analyst": vendorResponseFixtures,
      "/scenarios": vendorResponseFixtures,
      "/approval": vendorResponseFixtures
    }
  }
};

export default nextConfig;
