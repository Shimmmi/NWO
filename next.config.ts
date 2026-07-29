import type { NextConfig } from "next";

// connect-src без хоста: WebSocket теперь same-origin, а вшитый в билд домен
// рассинхронизировался бы с реальным при смене окружения.
const cspHeader = `
  default-src 'self';
  script-src 'self' 'unsafe-eval' 'unsafe-inline';
  style-src 'self' 'unsafe-inline';
  img-src 'self' data: blob:;
  font-src 'self' data:;
  worker-src 'self' blob:;
  connect-src 'self' ws: wss:;
`.replace(/\n/g, " ").trim();

const nextConfig: NextConfig = {
  basePath: "/nwo",
  assetPrefix: "/nwo",
  output: "standalone",
  transpilePackages: ["three", "@react-three/fiber", "@react-three/drei"],
  // env: { AUTH_SECRET } удалён намеренно: он вшивал секрет подписи сессий
  // в .next/standalone/server.js и перекрывал рантайм-значение из env_file.
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "Content-Security-Policy", value: cspHeader },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
        ],
      },
    ];
  },
};

export default nextConfig;
