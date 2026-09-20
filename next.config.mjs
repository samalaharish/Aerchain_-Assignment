/** @type {import('next').NextConfig} */
const vendorResponseFixtures = ["./fixtures/vendor-responses/**/*"];
const pdfJsServerRuntimeAssets = ["./runtime/pdfjs/pdf.worker.mjs"];
const procurementWorkflowAssets = [...vendorResponseFixtures, ...pdfJsServerRuntimeAssets];

const nextConfig = {
  reactStrictMode: true,
  experimental: {
    serverComponentsExternalPackages: ["pdfjs-dist"],
    outputFileTracingIncludes: {
      "/dashboard": procurementWorkflowAssets,
      "/responses": procurementWorkflowAssets,
      "/responses/[documentId]": procurementWorkflowAssets,
      "/api/extractions/[documentId]/run": procurementWorkflowAssets,
      "/comparison": procurementWorkflowAssets,
      "/exceptions": procurementWorkflowAssets,
      "/analyst": procurementWorkflowAssets,
      "/scenarios": procurementWorkflowAssets,
      "/approval": procurementWorkflowAssets
    }
  }
};

export default nextConfig;
