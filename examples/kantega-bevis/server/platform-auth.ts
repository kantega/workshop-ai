import type { Connect, Plugin } from "vite";

/**
 * Kundeveien inn i testmiljøet, den korte varianten fra Kantegas API-guide («Kom i gang med API-et»,
 * del 1): `client_credentials` med `client_secret_basic`, ett Bearer-token per tjeneste (RFC 8707
 * `resource`), cachet til det utløper.
 *
 * Laget bor i dev-serveren og ikke i nettleseren med vilje: hemmeligheten er nok til å opptre som
 * organisasjonen din, og en SPA kan ikke holde den forsvarlig. Nettleseren snakker bare med
 * /api/studio og /api/verifier — det er denne middlewaren som legger på legitimasjonen og sender
 * kallet videre ut av maskinen.
 *
 * Hvorfor ikke `private_key_jwt` + DPoP (guidens del 2): den veien krever
 * at bevisstudio kan hente appens JWKS over offentlig https, altså en tunnel per deltaker. På en
 * workshop er det den ene tingen som stjeler formiddagen. Hemmelighet + Bearer krever ingenting
 * utenfor denne mappa. Prisen står i guiden: et lekket token kan brukes til det utløper.
 *
 * Konfigurasjon (fra .env.local via vite.config.ts):
 *   EIDAS_CLIENT_ID / EIDAS_CLIENT_SECRET   registreringen i kontrollflata
 *   EIDAS_STUDIO_URL / EIDAS_VERIFIER_URL   tjenestene i testmiljøet
 *
 * Uten klient-id og hemmelighet svarer /api/studio og /api/verifier 502 med en melding som sier
 * hva som mangler — ikke en stille 401 fra plattformen som ser ut som en feil i appen.
 */

export interface PlatformAuthOptions {
  studioUrl: string;
  verifierUrl: string;
  clientId?: string;
  clientSecret?: string;
}

interface Metadata {
  issuer: string;
  token_endpoint: string;
  resources_supported?: string[];
}

interface TokenState {
  accessToken: string;
  expiresAt: number;
  scope: string;
}

type Service = "studio" | "verifier";

const now = () => Math.floor(Date.now() / 1000);

/** Stier som skal gå gjennom UTEN token — helsesjekken er åpen, og skal lyse også når legitimasjonen er feil. */
const OPEN_PATHS = ["/actuator/health"];

export function platformAuth(options: PlatformAuthOptions): Plugin {
  const { studioUrl, verifierUrl, clientId, clientSecret } = options;
  const configured = Boolean(clientId && clientSecret);
  const bases: Record<Service, string> = { studio: studioUrl, verifier: verifierUrl };

  let metadata: Metadata | null = null;
  const tokens: Partial<Record<Service, TokenState>> = {};

  async function loadMetadata(): Promise<Metadata> {
    if (metadata) return metadata;
    const response = await fetch(`${studioUrl}/.well-known/oauth-authorization-server`);
    if (!response.ok) throw new Error(`metadata-dokumentet hos bevisstudio svarte ${response.status}`);
    metadata = (await response.json()) as Metadata;
    return metadata;
  }

  /**
   * `resource`-verdien for tjenesten. Guiden sier: les den fra `resources_supported`, ikke fra
   * hukommelsen. Vi matcher på vertsnavn, så en trailing slash eller et avvik i skjema ikke gir
   * `invalid_target`.
   */
  async function resourceFor(service: Service): Promise<string> {
    const meta = await loadMetadata();
    if (service === "studio") return meta.issuer;
    const host = new URL(bases[service]).host;
    const match = meta.resources_supported?.find((candidate) => {
      try {
        return new URL(candidate).host === host;
      } catch {
        return false;
      }
    });
    if (!match) {
      throw new Error(
        `${bases[service]} står ikke i resources_supported hos bevisstudio ` +
          `(${JSON.stringify(meta.resources_supported ?? [])}) — sjekk EIDAS_VERIFIER_URL`,
      );
    }
    return match;
  }

  async function freshToken(service: Service): Promise<TokenState> {
    const cached = tokens[service];
    if (cached && cached.expiresAt > now() + 30) return cached;
    if (!clientId || !clientSecret) throw new Error("EIDAS_CLIENT_ID og EIDAS_CLIENT_SECRET mangler — se .env.example");

    const meta = await loadMetadata();
    const resource = await resourceFor(service);
    // RFC 6749 §2.3.1: begge halvdelene form-urlencodes FØR base64. Verdiene våre endres ikke av
    // det, men et bibliotek som følger spesifikasjonen gjør det, og da skal vi gjøre det samme.
    const basic = Buffer.from(`${encodeURIComponent(clientId)}:${encodeURIComponent(clientSecret)}`).toString("base64");
    const response = await fetch(meta.token_endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: `Basic ${basic}`,
      },
      // Uten `scope` får vi alt klienten er registrert med — det er riktig her: README sier hvilke
      // scopes registreringen skal ha, og statuspanelet viser hva tokenet faktisk fikk.
      body: new URLSearchParams({ grant_type: "client_credentials", resource }),
    });
    const text = await response.text();
    if (!response.ok) throw new Error(`token-endepunktet svarte ${response.status} for ${service}: ${text}`);
    const minted = JSON.parse(text) as { access_token: string; expires_in: number; scope?: string };
    const state: TokenState = {
      accessToken: minted.access_token,
      expiresAt: now() + minted.expires_in,
      scope: minted.scope ?? "",
    };
    tokens[service] = state;
    console.log(`[platform-auth] nytt token for ${service} (${minted.expires_in} s), scope: ${state.scope || "(tomt)"}`);
    return state;
  }

  function forwarder(service: Service): Connect.NextHandleFunction {
    return (request, response) => {
      void (async () => {
        const path = request.url ?? "";
        const target = `${bases[service]}${path}`;
        const chunks: Buffer[] = [];
        for await (const chunk of request) chunks.push(chunk as Buffer);
        const body = Buffer.concat(chunks);
        const open = OPEN_PATHS.some((candidate) => path.split("?")[0] === candidate);

        const call = async (): Promise<Response> => {
          const headers: Record<string, string> = { Accept: request.headers.accept ?? "application/json" };
          if (request.headers["content-type"]) headers["Content-Type"] = request.headers["content-type"];
          if (!open) headers.Authorization = `Bearer ${(await freshToken(service)).accessToken}`;
          return fetch(target, { method: request.method, headers, body: body.length > 0 ? body : undefined });
        };

        let upstream = await call();
        if (upstream.status === 401 && !open) {
          // Tokenet kan ha blitt ugyldig før sin tid (rotert hemmelighet, tilbakekalt klient) — én
          // fersk runde, så gir vi opp og lar 401-en nå appen.
          delete tokens[service];
          upstream = await call();
        }
        response.statusCode = upstream.status;
        const contentType = upstream.headers.get("Content-Type");
        if (contentType) response.setHeader("Content-Type", contentType);
        response.end(Buffer.from(await upstream.arrayBuffer()));
      })().catch((failure: Error) => {
        response.statusCode = 502;
        response.setHeader("Content-Type", "application/json");
        response.end(JSON.stringify({ error: `platform-auth (${service}): ${failure.message}` }));
      });
    };
  }

  /** Statusbildet appen lyser på: er tjenesten oppe, og bærer legitimasjonen? Kaster aldri. */
  async function status(service: Service) {
    const url = bases[service];
    let reachable = false;
    try {
      reachable = (await fetch(`${url}/actuator/health`)).ok;
    } catch {
      reachable = false;
    }
    if (!configured) return { url, reachable, token: "unconfigured" as const };
    try {
      const token = await freshToken(service);
      return { url, reachable, token: "ok" as const, scope: token.scope, expiresIn: token.expiresAt - now() };
    } catch (failure) {
      return { url, reachable, token: "failed" as const, error: (failure as Error).message };
    }
  }

  return {
    name: "platform-auth",
    configureServer(server) {
      server.middlewares.use("/app-api/status", (_request, response) => {
        void Promise.all([status("studio"), status("verifier")]).then(([studio, verifier]) => {
          response.setHeader("Content-Type", "application/json");
          response.end(JSON.stringify({ configured, clientId: clientId ?? null, studio, verifier }));
        });
      });
      server.middlewares.use("/api/studio", forwarder("studio"));
      server.middlewares.use("/api/verifier", forwarder("verifier"));
      console.log(
        configured
          ? `[platform-auth] PÅ: kaller testmiljøet som integrasjonsklienten ${clientId}`
          : "[platform-auth] AV: EIDAS_CLIENT_ID/EIDAS_CLIENT_SECRET mangler — /api/studio og /api/verifier svarer 502 til de er satt",
      );
      console.log(`[platform-auth] bevisstudio ${studioUrl}\n[platform-auth] verifier    ${verifierUrl}`);
    },
  };
}
