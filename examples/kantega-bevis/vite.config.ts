import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv } from "vite";
import { platformAuth } from "./server/platform-auth";

/**
 * To halvdeler, to steder:
 *
 *  - KS-sandkassen (github.com/ks-no/workshop-ai) kjører LOKALT, startet med `./start.sh --mock`.
 *    Den går gjennom Vites vanlige proxy under, på portene deres.
 *  - Plattformen vår kjører i TESTMILJØET. Den går gjennom `platformAuth`, som legger på et
 *    OAuth-token per tjeneste før kallet forlater maskinen. Klient-id og hemmelighet leses fra
 *    .env.local og bor i dev-serveren, aldri i nettleseren.
 *
 * Plattformen kjører ikke lokalt, så KS får ha hele blokka 8080–8087 pluss 3000/3001 i fred.
 */
export default defineConfig(({ mode }) => {
  // Tomt prefiks: vi vil ha EIDAS_* og KS_* fra .env.local, ikke bare VITE_*. Ingen av dem
  // eksponeres til klienten uansett — Vite slipper bare VITE_* gjennom til import.meta.env.
  const env = { ...loadEnv(mode, process.cwd(), ""), ...process.env } as Record<string, string | undefined>;

  const studioUrl =
    env.EIDAS_STUDIO_URL ?? "https://bevisstudio.agreeabledune-b07a297d.norwayeast.azurecontainerapps.io";
  const verifierUrl =
    env.EIDAS_VERIFIER_URL ?? "https://verifier.agreeabledune-b07a297d.norwayeast.azurecontainerapps.io";
  const ksSandboxPort = env.KS_PORT_SANDBOX ?? "8080";
  const ksToolsPort = env.KS_PORT_TOOLS ?? "8083";

  return {
    plugins: [
      react(),
      platformAuth({
        studioUrl,
        verifierUrl,
        clientId: env.EIDAS_CLIENT_ID,
        clientSecret: env.EIDAS_CLIENT_SECRET,
      }),
    ],
    server: {
      proxy: {
        "/api/ks-sandbox": {
          target: `http://localhost:${ksSandboxPort}`,
          rewrite: (path) => path.replace(/^\/api\/ks-sandbox/, ""),
        },
        "/api/ks-tools": {
          target: `http://localhost:${ksToolsPort}`,
          rewrite: (path) => path.replace(/^\/api\/ks-tools/, ""),
        },
      },
    },
  };
});
