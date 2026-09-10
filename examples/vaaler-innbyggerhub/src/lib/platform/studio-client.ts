// Kundeveien inn til plattformen: token fra Bevis Studios /oauth/token (client_credentials med
// client_secret), ett token per tjeneste (`resource`, RFC 8707), cachet til det utløper.
// Uten klient-id går kallene uten legitimasjon, som mot en lokal rigg i dev-unauthenticated.
//
// Dokumentert i monorepoets docs/integrasjon/kom-i-gang-med-api-et.md.

import type { PlatformConfig } from "./config";
import { PlatformError } from "./types";

export const RESOURCES = {
  studio: "api://bevisstudio",
  verifier: "api://kantega-verifier-service",
} as const;
export type Resource = keyof typeof RESOURCES;

type CachedToken = { accessToken: string; expiresAt: number };

declare global {
  var __vaalerTokenCache: Map<string, CachedToken> | undefined;
}
const tokenCache: Map<string, CachedToken> = (globalThis.__vaalerTokenCache ??= new Map());

const SCOPES: Record<Resource, string> = {
  studio:
    "issuers:read verifiers:read credential-types:read credential-types:write issuance-rules:read issuance-rules:write verification-rules:read verification-rules:write issuance:write",
  verifier: "verification:write verification:read presentations:read",
};

export class PlatformClient {
  constructor(private readonly config: PlatformConfig) {}

  studio<T>(path: string, init?: RequestInit): Promise<T> {
    return this.call("studio", `${this.config.studioUrl}${path}`, init);
  }

  verifier<T>(path: string, init?: RequestInit): Promise<T> {
    return this.call("verifier", `${this.config.verifierUrl}${path}`, init);
  }

  private async call<T>(resource: Resource, url: string, init?: RequestInit): Promise<T> {
    const headers = new Headers(init?.headers);
    if (init?.body) headers.set("Content-Type", "application/json");
    const token = await this.token(resource);
    if (token) headers.set("Authorization", `Bearer ${token}`);

    const response = await fetch(url, { ...init, headers, cache: "no-store" });
    const text = await response.text();
    if (!response.ok) {
      throw new PlatformError(response.status, text, `${init?.method ?? "GET"} ${url} → ${response.status}: ${text}`);
    }
    return (text ? JSON.parse(text) : {}) as T;
  }

  /** Null når hubben kjører uten legitimasjon. */
  private async token(resource: Resource): Promise<string | null> {
    const { clientId, clientSecret, studioUrl } = this.config;
    if (!clientId || !clientSecret) return null;

    const cached = tokenCache.get(resource);
    if (cached && cached.expiresAt > Date.now()) return cached.accessToken;

    const endpoint = await this.tokenEndpoint();
    const body = new URLSearchParams({
      grant_type: "client_credentials",
      scope: SCOPES[resource],
      resource: RESOURCES[resource],
    });
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`${encodeURIComponent(clientId)}:${encodeURIComponent(clientSecret)}`).toString("base64")}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body,
      cache: "no-store",
    });
    const text = await response.text();
    if (!response.ok) throw new PlatformError(response.status, text, `Token for ${resource} (${studioUrl}) → ${response.status}: ${text}`);
    const token = JSON.parse(text) as { access_token: string; expires_in: number; scope?: string };
    // 30 s slingringsmonn så vi ikke sender et token som utløper på veien.
    tokenCache.set(resource, { accessToken: token.access_token, expiresAt: Date.now() + (token.expires_in - 30) * 1000 });
    if (token.scope && token.scope.split(" ").length < SCOPES[resource].split(" ").length) {
      console.warn(`[platform] Fikk færre skoper enn bedt om for ${resource}: «${token.scope}». Sjekk registreringen i Bevis Studio.`);
    }
    return token.access_token;
  }

  private async tokenEndpoint(): Promise<string> {
    const response = await fetch(`${this.config.studioUrl}/.well-known/oauth-authorization-server`, { cache: "no-store" });
    if (!response.ok) return `${this.config.studioUrl}/oauth/token`;
    const metadata = (await response.json()) as { token_endpoint?: string };
    return metadata.token_endpoint ?? `${this.config.studioUrl}/oauth/token`;
  }
}
