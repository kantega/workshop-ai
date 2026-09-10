// All konfigurasjon leses her og bare her. Se .env.example.

import type { PlatformMode } from "./types";

export type PlatformConfig = {
  mode: PlatformMode;
  studioUrl: string;
  verifierUrl: string;
  /** Uten klient-id og hemmelighet sendes ingen legitimasjon (riggen i `dev-unauthenticated`). */
  clientId: string | null;
  clientSecret: string | null;
  /** Sett denne for å hoppe over rigging av regelen i Bevis Studio. */
  verificationRuleId: string | null;
  verificationRuleName: string;
  /** Hubbens egen adresse, brukt til same-device-fortsettelse. */
  publicBaseUrl: string;
};

export function readConfig(env: NodeJS.ProcessEnv = process.env): PlatformConfig {
  const mode = env.PLATFORM_MODE === "verifier" ? "verifier" : "mock";
  return {
    mode,
    studioUrl: trimSlash(env.BEVISSTUDIO_URL ?? "http://localhost:8080"),
    verifierUrl: trimSlash(env.VERIFIER_URL ?? "http://localhost:8095"),
    clientId: env.EIDAS_CLIENT_ID?.trim() || null,
    clientSecret: env.EIDAS_CLIENT_SECRET?.trim() || null,
    verificationRuleId: env.VERIFICATION_RULE_ID?.trim() || null,
    verificationRuleName: env.VERIFICATION_RULE_NAME?.trim() || "Våler innbyggerhub",
    publicBaseUrl: trimSlash(env.PUBLIC_BASE_URL ?? "http://localhost:3000"),
  };
}

const trimSlash = (url: string) => url.replace(/\/+$/, "");
