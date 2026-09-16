import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Design system da suíte consumido como fonte (.tsx) — o app o transpila.
  transpilePackages: ["@graduu/ui"],
  // Pacotes que rodam só no servidor e não devem ser empacotados pelo bundler.
  serverExternalPackages: ["@electric-sql/pglite"],
  experimental: {
    // Upload de documentos (Compliance) e PDFs de citação (intake) — server actions maiores.
    serverActions: { bodySizeLimit: "14mb" },
  },
};

export default nextConfig;
