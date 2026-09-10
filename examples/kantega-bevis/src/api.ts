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

interface CertificateRow extends Row {
  status?: string;
  verifierId?: string;
}

/**
 * Spørringen fremvisningsregelen bærer. DCQL (OID4VP 1.0) — bare den biten appen faktisk setter.
 * `credential_sets` er hvordan veiviseren gjør hvert bevis valgfritt: ett sett per bevis, alle med
 * `required: false`, så verifieren godkjenner uansett hvor mange lommeboka faktisk delte.
 */
export interface DcqlQuery {
  credentials: {
    id: string;
    format: string;
    meta: { vct_values: string[] };
    claims: { path: string[] }[];
  }[];
  credential_sets?: { options: string[][]; required: boolean }[];
}

interface NormalisedQuery {
  credentials: { id: string; format: string; vcts: string[]; claims: string[] }[];
  sets: { options: string[][]; required: boolean }[];
}

/**
 * Kanonisk form av det appen selv setter: hvilke bevis regelen spør om, hvilke vct-er de godtar,
 * claim-stiene, og hvordan settene er merket valgfrie. Plattformen kan normalisere og fylle på med
 * felt vi aldri sendte, og en rå JSON-sammenligning ville da meldt avvik på hver eneste last og
 * skrevet regelen på nytt uten grunn.
 *
 * REKKEFØLGE BETYR INGENTING, hverken på bevisene eller på settene. En DCQL-spørring er mengder,
 * ikke lister: `credential_sets` sier hvilke kombinasjoner som holder, ikke i hvilken orden de
 * skal leses. Sorterte vi bare bevisene, ville en katalog som flyttet ett bevis oppover meldt
 * avvik på tolv identiske bevistyper - og appen ville skrevet regelen på nytt uten at noe hadde
 * endret seg. Derfor sorteres begge nivåene her.
 */
function normalise(query: DcqlQuery): NormalisedQuery {
  return {
    credentials: [...(query.credentials ?? [])]
      .sort((a, b) => a.id.localeCompare(b.id))
      .map((credential) => ({
        id: credential.id,
        format: credential.format,
        vcts: [...(credential.meta?.vct_values ?? [])].sort(),
        claims: (credential.claims ?? []).map((claim) => claim.path.join(".")).sort(),
      })),
    sets: (query.credential_sets ?? [])
      .map((set) => ({
        options: (set.options ?? []).map((option) => [...option].sort()).sort((a, b) => a.join().localeCompare(b.join())),
        required: set.required,
      }))
      .sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b))),
  };
}

function sameQuery(current: DcqlQuery, want: DcqlQuery): boolean {
  return JSON.stringify(normalise(current)) === JSON.stringify(normalise(want));
}

/**
 * Hva som faktisk skiller regelen fra det appen vil ha. To lister med tolv URL-er hver er ingen
 * feilmelding noen kan handle på - forskjellen er det, og den er som regel ett bevis eller én claim.
 */
function describeDifference(current: DcqlQuery, want: DcqlQuery): string {
  const stored = normalise(current);
  const wanted = normalise(want);
  const forskjeller: string[] = [];

  const storedIds = new Set(stored.credentials.map((credential) => credential.id));
  const wantedIds = new Set(wanted.credentials.map((credential) => credential.id));
  const bareIRegelen = [...storedIds].filter((id) => !wantedIds.has(id));
  const bareIAppen = [...wantedIds].filter((id) => !storedIds.has(id));
  if (bareIRegelen.length > 0) forskjeller.push(`regelen spør om bevis appen ikke har: ${bareIRegelen.join(", ")}`);
  if (bareIAppen.length > 0) forskjeller.push(`appen har bevis regelen ikke spør om: ${bareIAppen.join(", ")}`);

  for (const credential of wanted.credentials) {
    const motpart = stored.credentials.find((candidate) => candidate.id === credential.id);
    if (!motpart) continue;
    if (motpart.vcts.join() !== credential.vcts.join()) {
      forskjeller.push(`«${credential.id}» peker på ${motpart.vcts.join(", ") || "(ingenting)"}, appen på ${credential.vcts.join(", ")}`);
    } else if (motpart.claims.join() !== credential.claims.join()) {
      forskjeller.push(`«${credential.id}» ber om ${motpart.claims.join(", ") || "(ingen claims)"}, appen om ${credential.claims.join(", ")}`);
    }
  }

  if (JSON.stringify(stored.sets) !== JSON.stringify(wanted.sets)) {
    forskjeller.push(
      `settene er ulike (regelen har ${stored.sets.length}, appen ${wanted.sets.length}) - det er de som gjør hvert bevis valgfritt`,
    );
  }

  return forskjeller.length > 0 ? forskjeller.join("; ") : "spørringene ser like ut, så dette er trolig en feil i sammenligningen";
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
    // «not-in-access-plan» er ikke et manglende scope: abonnementet tillater ikke å ENDRE en regel
    // i det hele tatt. Da hjelper det ikke å prøve igjen, og råd om scopes sender folk feil vei.
    const utenforPlanen = failure instanceof PlatformError && failure.status === 403 && failure.body.includes("not-in-access-plan");
    throw new Error(
      `Fremvisningsregelen «${name}» finnes fra før, men spør etter noe annet enn appen: ` +
        `${describeDifference(current, want)}. Lommeboka finner da ingenting å vise fram og svarer ` +
        "«request_data_no_document». Regelen kunne ikke oppdateres automatisk " +
        `(${(failure as Error).message}). ` +
        (utenforPlanen
          ? "Abonnementet ditt tillater ikke å endre en fremvisningsregel, bare å opprette den, så " +
            "omskriving er ingen vei videre: "
          : "") +
        "Slett regelen under Verifiere → Fremvisningsregler i kontrollflata, eller gi den et nytt " +
        "navn (VEIVISER_RULE i src/catalog.ts for innbyggerflata, SPEC.rule.name i src/Verktoy.tsx " +
        "for verktøypanelet), og last siden på nytt.",
    );
  }
  return existing.id;
}

/** Finn regelen på navn, og opprett den hvis den mangler. Retter den opp hvis den har flyttet seg. */
async function ensureRule(
  verifierRow: Row,
  name: string,
  query: DcqlQuery,
  onStep: (step: string) => void,
): Promise<string> {
  onStep(`Fremvisningsregelen «${name}» …`);
  const rules = await call<Row[]>(studio("/v1/verification-rules"));
  const existing = rules.find((rule) => rule.name === name);
  if (existing) return reconcileRule(existing, verifierRow.id, name, query, onStep);
  const created = await call<Row>(studio("/v1/verification-rules"), {
    method: "POST",
    body: JSON.stringify({ verifierId: verifierRow.id, name, query }),
  });
  return created.id;
}

async function ensureIssuer(): Promise<Row> {
  const issuers = await call<Row[]>(studio("/v1/issuers"));
  if (issuers.length === 0) {
    throw new Error(
      "Organisasjonen har ingen utsteder i testmiljøet. Opprett en i kontrollflata (Utstedere), eller " +
        "sjekk at klienten er registrert i riktig organisasjon.",
    );
  }
  return issuers[0];
}

async function ensureIssuerCertificate(issuer: Row): Promise<void> {
  // Uten et aktivt sertifikat ser alt riktig ut helt til lommeboka: utstederen svarer da
  // «unsupported_credential_type: Utstederen har ikke et aktivt sertifikat» når beviset skal signeres.
  const certificates = await call<CertificateRow[]>(studio(`/v1/issuers/${issuer.id}/certificates`));
  if (certificates.some((certificate) => certificate.status === "ACTIVE")) return;
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

/** Finn eller opprett bevistype + forhåndsautorisert utstedelsesregel, og publiser. Idempotent. */
async function ensureCredentialType(
  issuer: Row,
  name: string,
  claims: ClaimSpec[],
  onStep: (step: string) => void,
): Promise<{ issuanceRuleId: string; vct: string }> {
  onStep(`Bevistypen «${name}» …`);
  const credentialTypes = await call<Row[]>(studio("/v1/credential-types"));
  const credentialTypeId =
    credentialTypes.find((type) => type.name === name)?.id ??
    (await call<Row>(studio("/v1/credential-types"), { method: "POST", body: JSON.stringify({ name, claims }) })).id;

  const issuanceRules = await call<Row[]>(studio("/v1/issuance-rules"));
  const issuanceRuleId =
    issuanceRules.find((rule) => rule.credentialTypeId === credentialTypeId)?.id ??
    (
      await call<Row>(studio("/v1/issuance-rules"), {
        method: "POST",
        body: JSON.stringify({
          issuerId: issuer.id,
          credentialTypeId,
          name: `${name}, forhåndsautorisert`,
          method: "PRE_AUTHORIZED_CODE",
        }),
      })
    ).id;

  const deployment = await call<{ deployed: { vct: string } }>(
    studio(`/v1/issuance-rules/${issuanceRuleId}/deployment`),
    { method: "PUT" },
  );
  return { issuanceRuleId, vct: deployment.deployed.vct };
}

async function ensureVerifier(onStep: (step: string) => void): Promise<Row> {
  onStep("Finner verifieren …");
  const verifiers = await call<Row[]>(studio("/v1/verifiers"));
  if (verifiers.length === 0) {
    throw new Error("Organisasjonen har ingen verifier i testmiljøet. Opprett en i kontrollflata (Verifiere).");
  }
  const verifierRow = verifiers[0];

  onStep("Sjekker tilgangssertifikatet …");
  const certificates = await call<CertificateRow[]>(studio("/v1/access-certificates"));
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
  return verifierRow;
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
  const issuer = await ensureIssuer();
  const { issuanceRuleId, vct } = await ensureCredentialType(issuer, spec.credentialTypeName, spec.claims, onStep);
  onStep("Sjekker utstederens sertifikat …");
  await ensureIssuerCertificate(issuer);
  const verifierRow = await ensureVerifier(onStep);
  const ruleId = await ensureRule(
    verifierRow,
    spec.rule.name,
    {
      credentials: [
        {
          id: spec.rule.queryId,
          format: "dc+sd-jwt",
          meta: { vct_values: [vct] },
          claims: spec.rule.requestedClaims.map((claim) => ({ path: [claim] })),
        },
      ],
    },
    onStep,
  );

  return {
    issuanceRuleId,
    ruleId,
    vct,
    issuerName: issuer.name ?? issuer.id,
    verifierName: verifierRow.name ?? verifierRow.id,
  };
}

/** Én bevistype i veiviserens katalog, slik plattformen trenger den. */
export interface CatalogEntry {
  queryId: string;
  studioName: string;
  claims: ClaimSpec[];
  requestedClaims: string[];
}

export interface VeiviserSetup {
  ruleId: string;
  /** vct per queryId — brukes til å kjenne igjen bevis i svaret når `queryId` mangler. */
  vctByQueryId: Record<string, string>;
  issuanceRuleByQueryId: Record<string, string>;
  issuerName: string;
  verifierName: string;
}

/**
 * Veiviserens rigg: alle katalogbevisene som bevistyper, og ÉN fremvisningsregel som ber om dem
 * som hvert sitt valgfrie `credential_set` (`required: false`). Innbyggeren deler det hun har;
 * verifieren godkjenner uansett hvor mange som kom; appen leser `presentations[].queryId`.
 */
export async function ensureVeiviser(
  catalog: readonly CatalogEntry[],
  ruleName: string,
  onStep: (step: string) => void,
): Promise<VeiviserSetup> {
  onStep("Finner utstederen …");
  const issuer = await ensureIssuer();
  const vctByQueryId: Record<string, string> = {};
  const issuanceRuleByQueryId: Record<string, string> = {};
  for (const entry of catalog) {
    const { issuanceRuleId, vct } = await ensureCredentialType(issuer, entry.studioName, entry.claims, onStep);
    vctByQueryId[entry.queryId] = vct;
    issuanceRuleByQueryId[entry.queryId] = issuanceRuleId;
  }
  onStep("Sjekker utstederens sertifikat …");
  await ensureIssuerCertificate(issuer);
  const verifierRow = await ensureVerifier(onStep);
  const query: DcqlQuery = {
    credentials: catalog.map((entry) => ({
      id: entry.queryId,
      format: "dc+sd-jwt",
      meta: { vct_values: [vctByQueryId[entry.queryId]] },
      claims: entry.requestedClaims.map((claim) => ({ path: [claim] })),
    })),
    credential_sets: catalog.map((entry) => ({ options: [[entry.queryId]], required: false })),
  };
  const ruleId = await ensureRule(verifierRow, ruleName, query, onStep);
  return {
    ruleId,
    vctByQueryId,
    issuanceRuleByQueryId,
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

/** Ett fremvist bevis. `queryId` peker på DCQL-queryen det svarte på. */
export interface PresentationOutcome {
  queryId?: string | null;
  format?: string;
  credentialType?: string | null;
  issuer?: string | null;
  claims: PresentedClaims;
}

export interface PresentationResult {
  status: "VERIFIED" | "REJECTED" | "EXPIRED";
  /** `null` (ikke tom) når verifieren ikke lagrer innhold (OUTCOME_ONLY). */
  presentations?: PresentationOutcome[] | null;
  failures?: { queryId?: string | null; check?: string | null; detail?: string | null }[];
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
