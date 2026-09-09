// Tynt lag mot KS-sandkassen (github.com/ks-no/workshop-ai), via dev-proxyen i
// vite.config.ts.
//
// Alt gaar gjennom tools-api paa 8083, ikke sandbox-backend paa 8080. Grunnen staar i
// deres egen openapi/tools-api.yaml: tools-api krever ingen token og henter selv et
// Maskinporten-token naar den kaller bakover. Det gjoer at denne appen slipper
// token-dansen (`node scripts/token.ts --innbygger person-001`) for aa vise flyten.
// Skal du lese revisjonsloggen eller starte en prosessoekt, maa du derimot mot 8080 med
// token — se README.
//
// Formene under er lest ut av deres openapi/sandbox-backend.yaml og
// apps/tools-api/src/server.ts (main, 2026-09-03), ikke gjettet. De er likevel ikke
// kjoert mot en levende sandkasse herfra, saa feltene behandles som valgfrie.

const tools = (path: string) => `/api/ks-tools${path}`;
const sandbox = (path: string) => `/api/ks-sandbox${path}`;

/** Ordningen hackathonets flaggskip-case handler om. */
export const ORDNING = "redusert-foreldrebetaling-barnehage";

export interface KsPerson {
  personId: string;
  navn: string;
  kommune?: string;
}

export interface KsProsess {
  id: string;
  navn: string;
  beskrivelse?: string;
  antallSteg?: number;
}

/** Fiks' inntektsgrunnlag, beregningstype BARNEHAGE_SFO. */
export interface Inntektsgrunnlag {
  inntektsaar?: number;
  stadie?: "OPPGJOER" | "UTKAST" | "UKJENT";
  /** Grunnlaget etter fradrag — tallet regelsjekken maaler mot. */
  beregningsbeloep?: number;
}

/** Kontrakten et SJEKK-steg i sandkassen oppfyller. */
export interface SjekkResultat {
  godkjent: boolean;
  melding: string;
  grunnlag?: Record<string, unknown>;
}

async function invoke<T>(name: string, args: Record<string, unknown> = {}): Promise<T> {
  const response = await fetch(tools(`/verktoy/${name}/invoke`), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ arguments: args }),
  });
  const text = await response.text();
  if (!response.ok) {
    throw new Error(`POST /verktoy/${name}/invoke → ${response.status}: ${text}`);
  }
  const body = JSON.parse(text) as { ok: boolean; tool: string; result: T };
  return body.result;
}

export async function people(): Promise<KsPerson[]> {
  const result = await invoke<{ personer: KsPerson[] }>("list_people");
  return result.personer ?? [];
}

export async function householdIncome(personId: string): Promise<Inntektsgrunnlag> {
  return invoke<Inntektsgrunnlag>("get_household_income", { personId });
}

export async function eligibility(personId: string): Promise<SjekkResultat> {
  return invoke<SjekkResultat>("check_eligibility", { personId, ordning: ORDNING });
}

export async function processes(): Promise<KsProsess[]> {
  const result = await invoke<{ prosesser?: KsProsess[] } | KsProsess[]>("list_processes");
  return Array.isArray(result) ? result : (result.prosesser ?? []);
}

/**
 * Prosessen som hoerer til ordningen. Vi leter framfor aa hardkode en id: sandkassen lar
 * deltakerne redigere prosesskatalogen, saa id-en er ikke vaar aa anta.
 */
export function barnehageProcess(alle: KsProsess[]): KsProsess | null {
  const treff = (p: KsProsess) => `${p.id} ${p.navn}`.toLowerCase();
  return (
    alle.find((p) => treff(p).includes("foreldrebetaling")) ??
    alle.find((p) => treff(p).includes("barnehage")) ??
    null
  );
}

export interface KsOekt {
  oektsId: string;
  stegIndex: number;
  aktivtSteg?: { id: string; type: string } | null;
  totaltAntallSteg?: number;
}

/**
 * Oektsvaret kommer enten rakt eller pakket som `{oekt, resultat}` — sandkassen pakker det
 * bare naar steget ga et resultat. Vi pakker ut begge veier.
 */
function unwrap(svar: KsOekt | { oekt: KsOekt }): KsOekt {
  return "oekt" in svar ? svar.oekt : svar;
}

export async function startSession(personId: string, prosessId: string): Promise<KsOekt> {
  const oekt = unwrap(await invoke<KsOekt | { oekt: KsOekt }>("start_process_session", { personId, prosessId }));
  if (!oekt.oektsId) throw new Error("Sandkassen ga ingen oektsId tilbake fra start_process_session.");
  return oekt;
}

export async function nextStep(oektsId: string): Promise<KsOekt> {
  return unwrap(await invoke<KsOekt | { oekt: KsOekt }>("next_step", { oektsId }));
}

/**
 * Flytter oekten fram til samtykkesteget.
 *
 * Sandkassen velger handler ut fra hvilket steg oekten STAAR PAA — se stegHandlers i deres
 * prosess.ts. `opprett-samtykke` finnes bare i CONSENT_REQUEST-handleren, saa paa steg 0
 * (INFO) blir handlingen stille ignorert, oekten faar ingen aktivtSamtykkeId, og tools-api
 * svarer 500 «Kunne ikke opprette aktivt samtykke». For foreldrebetaling ligger
 * samtykkesteget paa indeks 2, etter intro og hent-husstand.
 *
 * Vi spoler fram framfor aa kjoere stegene: `next_step` oeker bare stegIndex og validerer
 * ingenting, og appen trenger bare samtykket. En app som skal drive hele saksflyten boer
 * i stedet kjoere hvert steg med `run_current_action`.
 */
export async function advanceToConsent(start: KsOekt, onStep: (step: string) => void): Promise<KsOekt> {
  let oekt = start;
  const maks = oekt.totaltAntallSteg ?? 12;
  for (let flyttet = 0; flyttet <= maks; flyttet++) {
    if (oekt.aktivtSteg?.type === "CONSENT_REQUEST") return oekt;
    onStep(`Spoler fram til samtykkesteget (staar paa «${oekt.aktivtSteg?.id ?? oekt.stegIndex}») …`);
    oekt = await nextStep(oekt.oektsId);
  }
  throw new Error("Fant ingen CONSENT_REQUEST-steg i prosessen — sjekk prosessdefinisjonen.");
}

/**
 * Registrerer samtykket inntektsoppslaget krever. Krever at oekten staar paa samtykkesteget;
 * `consent_response` oppretter samtykket hvis oekten ikke har et aktivt fra foer, og svarer
 * SAMTYKKET paa det. Uten dette svarer baade get_household_income og check_eligibility 403
 * «Inntektsdata krever registrert samtykke» — og det er riktig oppfoersel, ikke en feil.
 */
export async function giveConsent(oektsId: string): Promise<void> {
  await invoke("consent_response", { oektsId, approved: true });
}

/** Sant hvis tjenesten svarer paa /helse. Brukt av statuspanelet, saa den kaster aldri. */
export async function alive(service: "tools" | "sandbox"): Promise<boolean> {
  try {
    const url = service === "tools" ? tools("/helse") : sandbox("/helse");
    return (await fetch(url)).ok;
  } catch {
    return false;
  }
}
