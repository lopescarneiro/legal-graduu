import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Design system da suíte consumido como fonte (.tsx) — o app o transpila.
  transpilePackages: ["@graduu/ui"],
  // Pacotes que rodam só no servidor e não devem ser empacotados pelo bundler.
  serverExternalPackages: ["@electric-sql/pglite"],
  experimental: {
    // Upload de documentos (Compliance) e PDFs de citação (intake) — server actions maiores.
    // O teto do framework fica ACIMA do MAX_BYTES das actions (15MB) com folga de multipart.
    serverActions: { bodySizeLimit: "20mb" },
    // Temos proxy (src/proxy.ts): ele bufferiza o corpo e, no default de 10MB, TRUNCA
    // uploads maiores EM SILÊNCIO (corrompe as features de upload). Elevar para 20MB.
    proxyClientMaxBodySize: "20mb",
  },
};

export default nextConfig;
