import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: "50mb",
    },
    proxyClientMaxBodySize: "50mb",
  },
  // @napi-rs/canvas carrega um binário nativo (.node) por plataforma — ao
  // contrário do sharp (que o Next já trata como externo por padrão), esse
  // pacote precisa ser listado explicitamente ou o bundler (Turbopack)
  // tenta empacotar o binário e quebra em runtime com "could not resolve
  // @napi-rs/canvas-darwin-arm64" (achado verificado nesta sessão).
  serverExternalPackages: ["@napi-rs/canvas"],
  httpAgentOptions: {
    keepAlive: true,
  },
};

export default nextConfig;
