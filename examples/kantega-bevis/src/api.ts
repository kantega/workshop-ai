// Tynt lag mot plattformen i TESTMILJØET, via dev-serverens platform-auth (server/platform-auth.ts).
// Alt går kundeveien: bevisstudio for oppsett og utstedelse, verifieren for fremvisning — bare
// API-er en integrasjonspartner også har.

export class PlatformError extends Error {
  constructor(
    readonly status: number,
    readonly body: string,
    message: string,
  ) {
    super(message);
  }
}

async function call<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: init?.body ? { "Content-Type": "application/json", ...init?.headers } : init?.headers,
  });
  const text = await response.text();
  if (!response.ok) {
    throw new PlatformError(response.status, text, `${init?.method ?? "GET"} ${url} → ${response.status}: ${text}`);
  }
  return (text ? JSON.parse(text) : {}) as T;
}

const studio = (path: string) => `/api/studio${path}`;
const verifier = (path: string) => `/api/verifier${path}`;

export interface ClaimSpec {
  name: string;
  dataType: "STRING" | "NUMBER" | "BOOLEAN" | "DATE";
  mandatory: boolean;
}

/** Det appen trenger fra plattformen: en bevistype og en fremvisningsregel. */
export interface AppSpec {
  credentialTypeName: string;
  claims: ClaimSpec[];
  rule: {
    name: string;
    queryId: string;
    /** Claimene fremvisningen ber om — be bare om det flyten faktisk trenger. */
    requestedClaims: string[];
  };
}

export interface AppSetup {
  issuanceRuleId: string;
  ruleId: string;
  vct: string;
  issuerName: string;
  verifierName: string;
}

interface Row {
  id: string;
  name?: string;
  [key: string]: unknown;
}

/**
 * Rigger opp appens behov idempotent i organisasjonen tokenet tilhører: finn eller opprett
 * bevistypen, utstedelsesregelen og fremvisningsregelen, publiser bevistypen til utstederen, og
 * sørg for at verifieren har et aktivt tilgangssertifikat.
 *
 * Hvilken organisasjon er aldri en parameter — den utledes av klient-id-en. Får du 404 på noe du
 * er sikker på finnes, mangler klienten scopet: se `scope` i statuspanelet.
 */
export async function ensureSetup(spec: AppSpec, onStep: (step: string) => void): Promise<AppSetup> {
  onStep("Finner utstederen …");
  const issuers = await call<Row[]>(studio("/v1/issuers"));
  if (issuers.length === 0) {
    throw new Error(
      "Organisasjonen har ingen utsteder i testmiljøet. Opprett en i kontrollflata (Utstedere), eller " +
        "sjekk at klienten er registrert i riktig organisasjon.",
    );
  }
  const issuer = issuers[0];

  onStep(`Bevistypen «${spec.credentialTypeName}» …`);
  const credentialTypes = await call<Row[]>(studio("/v1/credential-types"));
  const credentialTypeId =
    credentialTypes.find((type) => type.name === spec.credentialTypeName)?.id ??
    (
      await call<Row>(studio("/v1/credential-types"), {
        method: "POST",
        body: JSON.stringify({ name: spec.credentialTypeName, claims: spec.claims }),
      })
    ).id;

  onStep("Utstedelsesregelen …");
  const issuanceRules = await call<Row[]>(studio("/v1/issuance-rules"));
  const issuanceRuleId =
    issuanceRules.find((rule) => rule.credentialTypeId === credentialTypeId)?.id ??
    (
      await call<Row>(studio("/v1/issuance-rules"), {
        method: "POST",
        body: JSON.stringify({
          issuerId: issuer.id,
          credentialTypeId,
          name: `${spec.credentialTypeName}, forhåndsautorisert`,
          method: "PRE_AUTHORIZED_CODE",
        }),
      })
    ).id;

  onStep("Publiserer bevistypen til utstederen …");
  const deployment = await call<{ deployed: { vct: string } }>(
    studio(`/v1/issuance-rules/${issuanceRuleId}/deployment`),
    { method: "PUT" },
  );
  const vct = deployment.deployed.vct;

  onStep("Finner verifieren …");
  const verifiers = await call<Row[]>(studio("/v1/verifiers"));
  if (verifiers.length === 0) {
    throw new Error("Organisasjonen har ingen verifier i testmiljøet. Opprett en i kontrollflata (Verifiere).");
  }
  const verifierRow = verifiers[0];

  onStep("Sjekker tilgangssertifikatet …");
  const certificates = await call<Row[]>(studio("/v1/access-certificates"));
  if (!certificates.some((certificate) => certificate.verifierId === verifierRow.id && certificate.status === "ACTIVE")) {
    try {
      await call(studio(`/v1/verifiers/${verifierRow.id}/access-certificates/platform-default`), { method: "POST" });
    } catch (failure) {
      throw new Error(
        "Verifieren mangler et aktivt tilgangssertifikat, og plattformens standardsertifikat kunne ikke " +
          `adopteres (${(failure as Error).message}). Legg inn et i kontrollflata under Verifiere → ` +
          "Tilgangssertifikater, og last siden på nytt.",
      );
    }
  }

  onStep(`Fremvisningsregelen «${spec.rule.name}» …`);
  const rules = await call<Row[]>(studio("/v1/verification-rules"));
  const ruleId =
    rules.find((rule) => rule.name === spec.rule.name)?.id ??
    (
      await call<Row>(studio("/v1/verification-rules"), {
        method: "POST",
        body: JSON.stringify({
          verifierId: verifierRow.id,
          name: spec.rule.name,
          query: {
            credentials: [
              {
                id: spec.rule.queryId,
                format: "dc+sd-jwt",
                meta: { vct_values: [vct] },
                claims: spec.rule.requestedClaims.map((claim) => ({ path: [claim] })),
              },
            ],
          },
        }),
      })
    ).id;

  return {
    issuanceRuleId,
    ruleId,
    vct,
    issuerName: issuer.name ?? issuer.id,
    verifierName: verifierRow.name ?? verifierRow.id,
  };
}

export async function orderCredential(
  issuanceRuleId: string,
  claims: Record<string, string>,
): Promise<{ offerUri: string }> {
  return call(studio(`/v1/issuance-rules/${issuanceRuleId}/test-issuances`), {
    method: "POST",
    body: JSON.stringify({ format: "dc+sd-jwt", claims }),
  });
}

export interface StartedPresentation {
  id: string;
  clientId: string;
  requestUri: string;
}

export async function startPresentation(ruleId: string): Promise<StartedPresentation> {
  return call(verifier("/v1/presentation-sessions"), {
    method: "POST",
    body: JSON.stringify({ ruleId }),
  });
}

export function walletUri(presentation: StartedPresentation): string {
  return (
    `openid4vp://?client_id=${encodeURIComponent(presentation.clientId)}` +
    `&request_uri=${encodeURIComponent(presentation.requestUri)}`
  );
}

export async function presentationPhase(sessionId: string): Promise<string> {
  const session = await call<{ phase: string }>(verifier(`/v1/presentation-sessions/${sessionId}`));
  return session.phase;
}

export interface PresentationResult {
  status: "VERIFIED" | "REJECTED" | "EXPIRED";
  presentations?: { claims: Record<string, string> }[] | null;
  failures?: { check?: string | null; detail?: string | null }[];
}

export async function presentationResult(sessionId: string): Promise<PresentationResult> {
  return call(verifier(`/v1/presentation-sessions/${sessionId}/result`));
}

/** Det dev-serveren vet om plattformen: er tjenesten oppe, og bærer legitimasjonen? */
export interface ServiceStatus {
  url: string;
  reachable: boolean;
  token: "ok" | "failed" | "unconfigured";
  scope?: string;
  expiresIn?: number;
  error?: string;
}

export interface PlatformStatus {
  configured: boolean;
  clientId: string | null;
  studio: ServiceStatus;
  verifier: ServiceStatus;
}

/** Kaster aldri: et statuspanel som selv feiler forteller ingenting. */
export async function platformStatus(): Promise<PlatformStatus | null> {
  try {
    const response = await fetch("/app-api/status");
    return response.ok ? ((await response.json()) as PlatformStatus) : null;
  } catch {
    return null;
  }
}
