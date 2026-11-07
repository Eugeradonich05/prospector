import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  // «Importar planilla» manda la tabla entera (hasta 3000 filas) en una Server Action; el límite por defecto es 1 MB.
  experimental: { serverActions: { bodySizeLimit: "6mb" } },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "DENY" },
        ],
      },
    ];
  },
};

export default nextConfig;
