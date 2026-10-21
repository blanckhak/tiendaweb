import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  // Fotos de productos de hasta 4 MB desde el panel (por defecto el límite es 1 MB).
  experimental: { serverActions: { bodySizeLimit: "5mb" } },
  // En desarrollo Next imprime los argumentos de cada acción: contraseñas, teléfonos y direcciones
  // de clientes terminarían en la consola. Se desactiva.
  logging: { serverFunctions: false },
  // PGlite carga archivos .wasm y datos propios: no se empaqueta.
  serverExternalPackages: ["@electric-sql/pglite"],
  // El esquema se lee en tiempo de ejecución para crear las tablas.
  outputFileTracingIncludes: { "/**": ["./db/schema.sql"] },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
