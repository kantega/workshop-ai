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

/** Spørringen fremvisningsregelen bærer. DCQL (OID4VP 1.0) — bare den biten appen faktisk setter. */
interface DcqlQuery {
  credentials: {
    id: string;
    format: string;
    meta: { vct_values: string[] };
    claims: { path: string[] }[];
  }[];
}

/** Hva appen ber om NÅ: bevistypen slik den er publisert, og claimene spec-en lister. */
function presentationQuery(spec: AppSpec, vct: string): DcqlQuery {
  return {
    credentials: [
      {
        id: spec.rule.queryId,
        format: "dc+sd-jwt",
        meta: { vct_values: [vct] },
        claims: spec.rule.requestedClaims.map((claim) => ({ path: [claim] })),
      },
    ],
  };
}

/**
 * Sammenligner bare det appen selv setter: format, hvilke vct-er som godtas, og claim-stiene.
 * Plattformen kan normalisere og fylle på med felt vi aldri sendte, og en rå JSON-sammenligning
 * ville da meldt avvik på hver eneste last og skrevet regelen på nytt uten grunn.
 */
function sameQuery(current: DcqlQuery, want: DcqlQuery): boolean {
  const mine = current.credentials?.[0];
  const theirs = want.credentials[0];
  if (!mine) return false;
  const paths = (credential: DcqlQuery["credentials"][number]) =>
    (credential.claims ?? [])
      .map((claim) => claim.path.join("."))
      .sort()
      .join(",");
  const vcts = (credential: DcqlQuery["credentials"][number]) => [...(credential.meta?.vct_values ?? [])].sort().join(",");
  return mine.format === theirs.format && vcts(mine) === vcts(theirs) && paths(mine) === paths(theirs);
}

/**
 * En regel som finnes fra før gjenbrukes på NAVN, og det er riktig helt til noe under navnet har
 * flyttet på seg. Bytter du bevistype, utsteder eller claim-liste, peker den gamle regelen fortsatt
 * på den GAMLE vct-en. Alt ser da friskt ut — oppsettet går grønt, QR-en tegnes — helt til
 * lommeboka, som ikke eier noe som matcher og svarer «request_data_no_document». Derfor leser vi
 * hva regelen faktisk spør om, og retter avviket framfor å gjenbruke den blindt.
 */
async function reconcileRule(
  existing: Row,
  verifierId: string,
  name: string,
  want: DcqlQuery,
  onStep: (step: string) => void,
): Promise<string> {
  let current = existing.query as DcqlQuery | undefined;
  if (!current) {
    try {
      current = (await call<{ query?: DcqlQuery }>(studio(`/v1/verification-rules/${existing.id}`))).query;
    } catch {
      current = undefined;
    }
  }

  // Får vi ikke lest spørringen, vet vi ingenting — og en regel vi ikke kan bedømme er ingen grunn
  // til å stoppe et oppsett som kanskje er helt i orden. Vi gjenbruker den, men sier fra i konsollen.
  if (!current) {
    console.warn(
      `[oppsett] Kunne ikke lese spørringen til fremvisningsregelen «${name}» (${existing.id}) — ` +
        "gjenbruker den uten å sjekke at den peker på riktig bevis.",
    );
    return existing.id;
  }

  if (sameQuery(current, want)) return existing.id;

  onStep(`Fremvisningsregelen «${name}» peker på feil bevis — oppdaterer …`);
  try {
    await call(studio(`/v1/verification-rules/${existing.id}`), {
      method: "PUT",
      body: JSON.stringify({ verifierId, name, query: want }),
    });
  } catch (failure) {
    const had = current.credentials?.[0]?.meta?.vct_values?.join(", ") ?? "(ukjent)";
    throw new Error(
      `Fremvisningsregelen «${name}» finnes fra før, men spør etter et annet bevis enn det appen nå ` +
        `utsteder (regelen: ${had} — appen: ${want.credentials[0].meta.vct_values.join(", ")}). Lommeboka ` +
        "finner da ingenting å vise fram og svarer «request_data_no_document». Regelen kunne ikke " +
        `oppdateres automatisk (${(failure as Error).message}) — slett den under Verifiere → ` +
        "Fremvisningsregler i kontrollflata, eller gi den et nytt navn i src/spec.ts, og last siden på nytt.",
    );
  }
  return existing.id;
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

  onStep("Sjekker utstederens sertifikat …");
  // Uten et aktivt sertifikat ser alt riktig ut helt til lommeboka: utstederen svarer da
  // «unsupported_credential_type: Utstederen har ikke et aktivt sertifikat» når beviset skal signeres.
  const issuerCertificates = await call<Row[]>(studio(`/v1/issuers/${issuer.id}/certificates`));
  if (!issuerCertificates.some((certificate) => certificate.status === "ACTIVE")) {
    try {
      await call(studio(`/v1/issuers/${issuer.id}/certificates/platform-default`), { method: "POST" });
    } catch (failure) {
      throw new Error(
        "Utstederen mangler et aktivt sertifikat, og Kantega-sertifikatet kunne ikke adopteres " +
          `(${(failure as Error).message}). Prøv knappen «Bruk Kantega-sertifikatet» under Utstedere → ` +
          "Sertifikater i kontrollflata, og last siden på nytt.",
      );
    }
  }

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
  const query = presentationQuery(spec, vct);
  const rules = await call<Row[]>(studio("/v1/verification-rules"));
  const existing = rules.find((rule) => rule.name === spec.rule.name);
  const ruleId = existing
    ? await reconcileRule(existing, verifierRow.id, spec.rule.name, query, onStep)
    : (
        await call<Row>(studio("/v1/verification-rules"), {
          method: "POST",
          body: JSON.stringify({ verifierId: verifierRow.id, name: spec.rule.name, query }),
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

/**
 * Claimene verifieren fikk. `unknown` og ikke `string` med vilje: et SD-JWT VC bærer alltid
 * protokoll-claimene ved siden av bevisets egne, og `status` er et NØSTET OBJEKT
 * (`{ status_list: { uri, idx } }`). Typer du dette som `Record<string, string>`, lyver typen —
 * og React kaster «Objects are not valid as a React child» første gang noen viser verdien rått.
 */
export type PresentedClaims = Record<string, unknown>;

/** Claimene ETHVERT SD-JWT VC bærer, uansett bevistype. Ikke det beviset handler om. */
export const PROTOCOL_CLAIMS = ["iss", "vct", "iat", "exp", "nbf", "status", "cnf"];

export interface PresentationResult {
  status: "VERIFIED" | "REJECTED" | "EXPIRED";
  presentations?: { claims: PresentedClaims }[] | null;
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
