// Katalogen innbyggerhubben regner på: bevistypene den kan be om, tjenestene i Våler kommune,
// og kvalifiseringsmotoren som sorterer tjenestene ut fra hva innbyggeren faktisk delte.
//
// `queryId` er nøkkelen gjennom hele appen: DCQL-query i fremvisningsregelen, verifierens
// `presentations[].queryId`, og tjenestenes krav peker alle på den. Alle claims er STRING, som
// resten av appen (plattformens test-utstedelse tar strenger; «ja»/«nei» for booleans).

import type { ClaimSpec, PresentedClaims } from "./api";

/**
 * Fremvisningsregelen innbyggerflata bruker: alle katalogbevisene som valgfrie credential_sets.
 * Rigges idempotent i organisasjonen tokenet tilhører, første gang siden lastes.
 *
 * NAVNET ER EN NØKKEL. Regler slås opp på navn, og en organisasjon kan ha en regel fra før som
 * bærer dette navnet og spør etter noe annet. Appen oppdager det og prøver å rette det (se
 * `reconcileRule` i `api.ts`), men et abonnement som bare tillater å OPPRETTE regler svarer 403
 * på oppdateringen, og da er den gamle regelen i veien til noen sletter den.
 *
 * «2026» står her fordi det skjedde: den forrige regelen ba førerkortet om `klasser` alene, mens
 * katalogen trenger `gyldig_til` også for å se om kortet er gyldig. Trenger du å bryte deg løs på
 * samme måte, bump navnet igjen - det er billigere enn å vente på tilgang til kontrollflata.
 */
export const VEIVISER_RULE = "Personlig veiviser 2026";

export type QueryId =
  | "pid"
  | "barn"
  | "inntektsbekreftelse"
  | "studentbevis"
  | "legeerklaering"
  | "foererkort"
  | "elevbevis"
  | "leiekontrakt"
  | "felleskostnader"
  | "boliglaan"
  | "eiendomsskatt"
  | "tilpasset_bolig";

export type CredentialGroup = "identitet" | "inntekt" | "helse" | "bolig";

export const CREDENTIAL_GROUP_LABELS: Record<CredentialGroup, string> = {
  identitet: "Hvem du er",
  inntekt: "Inntekt og utdanning",
  helse: "Helse og transport",
  bolig: "Bolig",
};

export interface CredentialDefinition {
  queryId: QueryId;
  group: CredentialGroup;
  /** Navnet bevistypen har i Bevis Studio. Finnes eller opprettes idempotent. */
  studioName: string;
  label: string;
  description: string;
  issuedBy: string;
  /** Claimene fremvisningen ber om. Be bare om det tjenestereglene faktisk trenger. */
  requestedClaims: string[];
  claims: ClaimSpec[];
  /** Eksempelverdier til test-utstedelse. */
  example: Record<string, string>;
}

const s = (name: string, mandatory = true): ClaimSpec => ({ name, dataType: "STRING", mandatory });

export const CREDENTIALS: readonly CredentialDefinition[] = [
  {
    queryId: "pid",
    group: "identitet",
    studioName: "eID",
    label: "eID",
    description: "Navn, fødselsdato og bostedskommune.",
    issuedBy: "Folkeregisteret",
    requestedClaims: ["given_name", "family_name", "birthdate", "resident_municipality"],
    claims: [s("given_name"), s("family_name"), s("birthdate"), s("resident_municipality")],
    example: { given_name: "Maja", family_name: "Solberg", birthdate: "1988-05-14", resident_municipality: "Våler" },
  },
  {
    queryId: "barn",
    group: "identitet",
    studioName: "Barn i husstanden",
    label: "Barn i husstanden",
    description: "Hvor mange barn du har foreldreansvar for, og alderen på yngste og eldste.",
    issuedBy: "Folkeregisteret",
    requestedClaims: ["antall_barn", "yngste_foedselsdato", "eldste_foedselsdato"],
    claims: [s("antall_barn"), s("yngste_foedselsdato"), s("eldste_foedselsdato")],
    example: { antall_barn: "2", yngste_foedselsdato: "2022-09-03", eldste_foedselsdato: "2016-02-17" },
  },
  {
    queryId: "inntektsbekreftelse",
    group: "inntekt",
    studioName: "Inntektsbekreftelse",
    label: "Inntektsbekreftelse",
    description: "Husstandens inntektsgrunnlag, og om du kvalifiserer til ordningen beviset ble laget for.",
    issuedBy: "Skatteetaten via KS-sandkassen",
    // `beregningsbeloep` står MED VILJE ikke her. Beløpet ligger i beviset, men fremvisningen ber
    // ikke om det: kommunen får «kvalifisert: ja» for en ordning, ikke inntekten din. Det er hele
    // forskjellen på at kommunen slår deg opp og at du viser fram at du kvalifiserer, og den er det
    // denne demoen finnes for. Prisen står i `incomeBelow`: en inntektsbekreftelse åpner bare den
    // ordningen den ble laget for. Legger du den tilbake i lista, gjør du påstanden i README usann.
    requestedClaims: ["navn", "ordning", "inntektsaar", "kvalifisert"],
    claims: [s("navn"), s("ordning"), s("inntektsaar"), s("kvalifisert"), s("beregningsbeloep", false)],
    example: { navn: "Maja Solberg", ordning: "redusert-foreldrebetaling-barnehage", inntektsaar: "2025", kvalifisert: "ja", beregningsbeloep: "485000" },
  },
  {
    queryId: "studentbevis",
    group: "inntekt",
    studioName: "Studentbevis",
    label: "Studentbevis",
    description: "At du er student eller elev, og om du er i arbeidsrettet tiltak.",
    issuedBy: "Lærestedet",
    requestedClaims: ["laerested", "gyldig_til", "arbeidsrettet_tiltak"],
    claims: [s("laerested"), s("gyldig_til"), s("arbeidsrettet_tiltak"), s("studentnummer", false)],
    example: { laerested: "Høgskolen i Innlandet", gyldig_til: "2027-06-30", arbeidsrettet_tiltak: "nei", studentnummer: "123456" },
  },
  {
    queryId: "legeerklaering",
    group: "helse",
    studioName: "Legeerklæring funksjonsnedsettelse",
    label: "Legeerklæring",
    description: "Varig funksjonsnedsettelse eller nedsatt gangfunksjon. Ikke diagnosen.",
    issuedBy: "Fastlegen",
    requestedClaims: ["varig_funksjonsnedsettelse", "nedsatt_gangfunksjon", "gyldig_til"],
    claims: [s("varig_funksjonsnedsettelse"), s("nedsatt_gangfunksjon"), s("gyldig_til"), s("diagnose", false)],
    example: { varig_funksjonsnedsettelse: "ja", nedsatt_gangfunksjon: "ja", gyldig_til: "2028-06-30", diagnose: "M17" },
  },
  {
    queryId: "foererkort",
    group: "helse",
    studioName: "Førerkort",
    label: "Førerkort",
    description: "Førerkortklasser og gyldighet.",
    issuedBy: "Statens vegvesen",
    requestedClaims: ["klasser", "gyldig_til"],
    claims: [s("klasser"), s("gyldig_til")],
    example: { klasser: "B", gyldig_til: "2031-05-14" },
  },
  {
    queryId: "elevbevis",
    group: "inntekt",
    studioName: "Elevbevis",
    label: "Elevbevis",
    description: "Skole og trinn.",
    issuedBy: "Skolen",
    requestedClaims: ["skole", "trinn"],
    claims: [s("skole"), s("trinn")],
    example: { skole: "Våler ungdomsskole", trinn: "10" },
  },
  // ---- boforhold, til bostøtte. Husbanken krever dokumentasjon på boutgiftene; ett av disse holder. ----
  {
    queryId: "leiekontrakt",
    group: "bolig",
    studioName: "Leiekontrakt",
    label: "Leiekontrakt",
    description: "At du leier bolig, og hva du betaler i husleie.",
    issuedBy: "Utleier",
    requestedClaims: ["adresse", "maanedlig_husleie", "fra_dato"],
    claims: [s("adresse"), s("maanedlig_husleie"), s("fra_dato"), s("utleier", false)],
    example: { adresse: "Vålgutua 12, 2436 Våler i Solør", maanedlig_husleie: "9500", fra_dato: "2025-08-01", utleier: "Solør Boligutleie AS" },
  },
  {
    queryId: "felleskostnader",
    group: "bolig",
    studioName: "Felleskostnader",
    label: "Felleskostnader",
    description: "Månedlige fellesutgifter i borettslag eller sameie.",
    issuedBy: "Borettslaget eller sameiet",
    requestedClaims: ["adresse", "maanedlig_beloep"],
    claims: [s("adresse"), s("maanedlig_beloep"), s("borettslag", false)],
    example: { adresse: "Kirkevegen 4, 2436 Våler i Solør", maanedlig_beloep: "4200", borettslag: "Våler Borettslag" },
  },
  {
    queryId: "boliglaan",
    group: "bolig",
    studioName: "Boliglån",
    label: "Boliglån",
    description: "Terminbeløp på boliglånet, fra nedbetalingsplanen.",
    issuedBy: "Banken",
    requestedClaims: ["adresse", "maanedlig_terminbeloep"],
    claims: [s("adresse"), s("maanedlig_terminbeloep"), s("restgjeld", false)],
    example: { adresse: "Skogvegen 18, 2436 Våler i Solør", maanedlig_terminbeloep: "11800", restgjeld: "2450000" },
  },
  {
    queryId: "eiendomsskatt",
    group: "bolig",
    studioName: "Eiendomsskatt og festeavgift",
    label: "Eiendomsskatt",
    description: "Årlig eiendomsskatt og eventuell festeavgift for enebolig.",
    issuedBy: "Våler kommune",
    requestedClaims: ["adresse", "aarlig_eiendomsskatt", "aarlig_festeavgift"],
    claims: [s("adresse"), s("aarlig_eiendomsskatt"), s("aarlig_festeavgift", false)],
    example: { adresse: "Skogvegen 18, 2436 Våler i Solør", aarlig_eiendomsskatt: "6400", aarlig_festeavgift: "0" },
  },
  {
    queryId: "tilpasset_bolig",
    group: "bolig",
    studioName: "Spesialtilpasset bolig",
    label: "Tilpasset bolig",
    description: "At boligen er spesialtilpasset på grunn av funksjonsnedsettelse. Gir høyere boutgiftstak.",
    issuedBy: "Kommunen",
    requestedClaims: ["adresse", "bekreftet"],
    claims: [s("adresse"), s("bekreftet"), s("dato", false)],
    example: { adresse: "Vålgutua 12, 2436 Våler i Solør", bekreftet: "ja", dato: "2024-03-01" },
  },
];

export const CREDENTIAL_BY_ID = Object.fromEntries(CREDENTIALS.map((c) => [c.queryId, c])) as Record<QueryId, CredentialDefinition>;

export function isQueryId(value: unknown): value is QueryId {
  return typeof value === "string" && value in CREDENTIAL_BY_ID;
}

/** Et bevis slik det ser ut etter at verifieren har godkjent det, uten protokoll-claimene. */
export interface PresentedCredential {
  queryId: QueryId;
  issuer: string | null;
  claims: PresentedClaims;
}

// ---------- tjenester ----------

export interface Condition {
  /** Regelen, slik innbyggeren ser den: «Gjelder 6 til 18 år», «Krever bosted i Våler kommune». */
  label: string;
  /**
   * Tre svar, ikke to. `"ukjent"` betyr at beviset er delt, men ikke svarer på DETTE spørsmålet -
   * typisk fordi fremvisningen med vilje ikke ba om claimen (se `incomeBelow`). Da er tjenesten
   * «nesten i mål», ikke «har du ikke rett på»: å si nei til noen fordi vi lot være å spørre er
   * et avslag vi ikke har dekning for, og det er den verste feilen denne portalen kan gjøre.
   */
  test: (claims: PresentedClaims, context: { today: Date }) => boolean | "ukjent";
  /** Det beviset faktisk sier, som vurderingen bygger på: «Født 1985-04-12, 41 år». */
  evidence: (claims: PresentedClaims, context: { today: Date }) => string;
  /** Hva innbyggeren mangler når svaret er «ukjent». Uten den brukes bevisets eget navn. */
  missingLabel?: string;
}

/**
 * Tre slags krav:
 *  - required: beviset må være delt, og betingelsen må holde.
 *  - optional: brukes hvis det er delt (vises som «dekket av»); mangler det, er alt fint. Holder
 *    ikke betingelsen, er tjenesten likevel ikke aktuell (f.eks. student som ikke er i tiltak).
 *  - anyOf: ett av bevisene holder. Bostøtte: ett bevis på boutgiftene.
 */
export interface Option {
  credential: QueryId;
  condition?: Condition;
}

export type Requirement =
  | { kind: "required"; credential: QueryId; condition?: Condition }
  | { kind: "optional"; credential: QueryId; condition?: Condition }
  | { kind: "anyOf"; options: Option[]; label: string };

const req = (credential: QueryId, condition?: Condition): Requirement => ({ kind: "required", credential, condition });
const opt = (credential: QueryId, condition?: Condition): Requirement => ({ kind: "optional", credential, condition });
const anyOf = (options: (QueryId | Option)[], label: string): Requirement => ({
  kind: "anyOf",
  options: options.map((option) => (typeof option === "string" ? { credential: option } : option)),
  label,
});

export type Category = "familie" | "helse" | "transport" | "kultur" | "bolig" | "utdanning";

/**
 * Tjenester som deler bevis og bør søkes samlet. Når to eller flere klare tjenester har samme
 * pakke, viser portalen dem i én ramme, forhåndsavkrysset.
 */
export type Package = "barnefamilie" | "bolig" | "tilrettelegging";

export const PACKAGE_LABELS: Record<Package, { name: string; why: string }> = {
  barnefamilie: { name: "Barnefamilie-pakken", why: "Samme inntektsbekreftelse, én søknad." },
  bolig: { name: "Bolig-pakken", why: "Boutgiftene og inntekten dokumenteres én gang." },
  tilrettelegging: { name: "Tilrettelegging-pakken", why: "Alt henger på den samme legeerklæringen." },
};

export interface Service {
  id: string;
  name: string;
  category: Category;
  package?: Package;
  /** Hvem som behandler: kommunen selv, eller en annen offentlig aktør portalen sender videre til. */
  handledBy?: string;
  summary: string;
  /** Forventet svartid, vist på kortet og i kvitteringen. */
  responseTime: string;
  requirements: Requirement[];
}

export const CATEGORY_LABELS: Record<Category, string> = {
  familie: "Familie og barn",
  helse: "Helse og omsorg",
  transport: "Transport",
  kultur: "Kultur og fritid",
  bolig: "Bolig",
  utdanning: "Utdanning og arbeid",
};

export const MUNICIPALITY = "Våler";

export function claimText(value: unknown): string {
  if (typeof value === "string") return value;
  if (value === null || value === undefined) return "";
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return JSON.stringify(value);
}

const YES = new Set(["ja", "true", "yes", "1"]);

export function ageOn(birthdate: unknown, today: Date): number | null {
  const text = claimText(birthdate);
  const parsed = new Date(text);
  if (!text || Number.isNaN(parsed.getTime())) return null;
  let age = today.getFullYear() - parsed.getFullYear();
  const hadBirthday =
    today.getMonth() > parsed.getMonth() || (today.getMonth() === parsed.getMonth() && today.getDate() >= parsed.getDate());
  if (!hadBirthday) age -= 1;
  return age;
}

/**
 * Inntektsgrenser, kroner per år, husstandens beregningsgrunnlag. Satsene er 2025-nivå slik vi
 * husker dem og MÅ verifiseres mot regjeringen.no / Husbanken / kommunens gebyrregulativ før noen
 * stoler på dem. Kommunale grenser (kulturskole, eiendomsskatt, gebyrer, bolig) er Vålers å sette.
 */
export const INNTEKTSGRENSER = {
  /** 6 %-regelen: ingen betaler mer enn 6 % av inntekten. Med makspris 2 000 kr/mnd gir det 400 000. */
  foreldrebetaling: 400_000,
  /** Gratis kjernetid for 2–5-åringer, fra 1.8.2025. */
  gratisKjernetid: 692_400,
  kulturskole: 400_000,
  /** Husbanken: avhenger av husstand og kommunegruppe; én person i Våler ligger rundt dette. */
  bostotte: 300_000,
  startlaan: 600_000,
  eiendomsskattFritak: 350_000,
  kommunaleGebyrer: 300_000,
  kommunalBolig: 400_000,
} as const;

const kr = (value: number) => `${value.toLocaleString("no-NO")} kr`;

const parseAmount = (value: unknown): number | null => {
  const digits = claimText(value).replace(/[^\d]/g, "");
  return digits ? Number(digits) : null;
};

/**
 * Inntektskrav. Veien til ja er at beviset ble laget for akkurat denne ordningen og sier
 * «kvalifisert: ja» - KS-sandkassens vurdering, gjort der inntekten hører hjemme.
 *
 * Beløpet er den andre veien, og den er stengt med vilje: fremvisningen ber ikke om
 * `beregningsbeloep` (se `requestedClaims` på inntektsbekreftelsen), så `claims.beregningsbeloep`
 * er normalt tom. Koden leser den likevel, for da måler den det den faktisk fikk framfor å anta -
 * deler en lommebok beløpet frivillig, brukes det.
 *
 * Prisen er reell og skal være synlig: én inntektsbekreftelse åpner bare den ordningen den ble
 * laget for. De andre havner i «nesten i mål» med beskjed om hvilket bevis som mangler, og det er
 * riktig svar - ikke en feil å reparere ved å be om beløpet igjen.
 */
const incomeBelow = (limit: number, what: string, ordning?: string): Condition => ({
  label: `${what}: husstandsinntekt under ${kr(limit)}`,
  missingLabel: "Inntektsbekreftelse for denne ordningen",
  test: (claims) => {
    const forDenne = ordning !== undefined && claimText(claims.ordning) === ordning;
    if (forDenne && YES.has(claimText(claims.kvalifisert).trim().toLowerCase())) return true;
    const amount = parseAmount(claims.beregningsbeloep);
    if (amount !== null) return amount < limit;
    // Vurdert for akkurat denne ordningen og svaret var nei: et ekte avslag, og det skal stå.
    if (forDenne) return false;
    // Hverken en vurdering for denne ordningen eller et beløp. Da vet vi ikke, og sier det.
    return "ukjent";
  },
  evidence: (claims) => {
    const amount = parseAmount(claims.beregningsbeloep);
    if (ordning && claimText(claims.ordning) === ordning) {
      return `Vurdert for ${ordning}: kvalifisert = ${claimText(claims.kvalifisert) || "(mangler)"}`;
    }
    if (amount !== null) return `Husstandsinntekt ${kr(amount)} (${claimText(claims.inntektsaar) || "år ukjent"}), grensen er ${kr(limit)}`;
    const laget = claimText(claims.ordning);
    return (
      `Beviset er vurdert for ${laget ? `«${laget}»` : "en annen ordning"}, ikke for denne. Kommunen ber ` +
      "aldri om selve beløpet, så det kan ikke måles mot grensen - du trenger en inntektsbekreftelse " +
      "for denne ordningen."
    );
  },
});

/** Et bevis som utelukker: er det delt, er tjenesten ikke aktuell. Brukes med `opt`. */
const excludes = (label: string, describe: (claims: PresentedClaims) => string): Condition => ({
  label,
  test: () => false,
  evidence: (claims) => describe(claims),
});

const ownsHome = excludes("Gjelder ikke deg som eier boligen du bor i", (claims) => `Eier bolig: ${claimText(claims.adresse) || "(adresse mangler)"}`);

/**
 * Claimen finnes ikke i det som ble delt. Det er ikke et nei: den kan mangle fordi
 * fremvisningsregelen ikke ba om den, eller fordi lommeboka holdt den tilbake. Da vet vi ingenting,
 * og en portal som avslår på ingenting er verre enn en som sier «del ett bevis til». Er claimen
 * der og holder ikke målet, er svaret et ekte nei - det er forskjellen disse vaktene bevarer.
 */
const absent = (claims: PresentedClaims, name: string) => claimText(claims[name]) === "";

/**
 * Alle betingelsene må holde. Forklaringen viser hver av dem.
 *
 * Rekkefølgen på utfallene er poenget: ett ekte nei slår alt, ellers arver vi «ukjent» fra den
 * som ikke visste. Uten den ville `every` lest «ukjent» som sant, siden strengen er truthy - og
 * da hadde et bevis vi ikke fikk se sluppet innbyggeren gjennom.
 */
const both = (...conditions: Condition[]): Condition => ({
  label: conditions.map((c, i) => (i === 0 ? c.label : c.label.charAt(0).toLowerCase() + c.label.slice(1))).join(", og "),
  test: (claims, context) => {
    const verdicts = conditions.map((c) => c.test(claims, context));
    if (verdicts.includes(false)) return false;
    if (verdicts.includes("ukjent")) return "ukjent";
    return true;
  },
  evidence: (claims, context) => conditions.map((c) => c.evidence(claims, context)).join("; "),
});

const hasClass = (klasse: string): Condition => ({
  label: `Førerkort klasse ${klasse}`,
  test: (claims) =>
    absent(claims, "klasser") ? "ukjent" : claimText(claims.klasser).toUpperCase().split(/[^A-Z0-9]+/).includes(klasse),
  evidence: (claims) => `Klasser: ${claimText(claims.klasser) || "(mangler)"}`,
});

const startedBy = (name: string, label: string): Condition => ({
  label,
  test: (claims, { today }) => {
    if (absent(claims, name)) return "ukjent";
    const from = new Date(claimText(claims[name]));
    return !Number.isNaN(from.getTime()) && from <= today;
  },
  evidence: (claims) => `Fra ${claimText(claims[name]) || "(mangler)"}`,
});

const bornEvidence = (claims: PresentedClaims, today: Date) => {
  const age = ageOn(claims.birthdate, today);
  return age === null ? "Fødselsdato mangler i beviset" : `Født ${claimText(claims.birthdate)}, ${age} år`;
};

const ageBetween = (min: number, max: number): Condition => ({
  label: `Gjelder ${min} til ${max} år`,
  test: (claims, { today }) => {
    const age = ageOn(claims.birthdate, today);
    return age === null ? "ukjent" : age >= min && age <= max;
  },
  evidence: (claims, { today }) => bornEvidence(claims, today),
});

const ageAtLeast = (min: number): Condition => ({
  label: `Gjelder fra ${min} år`,
  test: (claims, { today }) => {
    const age = ageOn(claims.birthdate, today);
    return age === null ? "ukjent" : age >= min;
  },
  evidence: (claims, { today }) => bornEvidence(claims, today),
});

/**
 * Har husstanden et barn i aldersspennet? Beviset bærer bare yngste og eldste, så vi sjekker om
 * [eldste, yngste] overlapper [min, max]. Godt nok for en veiviser; vedtaket sjekker eksakt.
 */
const childBetween = (min: number, max: number, label: string): Condition => ({
  label,
  test: (claims, { today }) => {
    const youngest = ageOn(claims.yngste_foedselsdato, today);
    const oldest = ageOn(claims.eldste_foedselsdato, today) ?? youngest;
    if (youngest === null || oldest === null) return "ukjent";
    return youngest <= max && oldest >= min;
  },
  evidence: (claims, { today }) => {
    const youngest = ageOn(claims.yngste_foedselsdato, today);
    const oldest = ageOn(claims.eldste_foedselsdato, today) ?? youngest;
    if (youngest === null || oldest === null) return "Fødselsdatoer mangler i beviset";
    const count = claimText(claims.antall_barn);
    return youngest === oldest ? `${count || "1"} barn, ${youngest} år` : `${count || "Flere"} barn, ${youngest} til ${oldest} år`;
  },
});

const residentIn = (municipality: string): Condition => ({
  label: `Krever bosted i ${municipality} kommune`,
  test: (claims) =>
    absent(claims, "resident_municipality")
      ? "ukjent"
      : claimText(claims.resident_municipality).trim().toLowerCase() === municipality.toLowerCase(),
  evidence: (claims) => `Bosted: ${claimText(claims.resident_municipality) || "(mangler)"}`,
});

const claimYes = (name: string, label: string): Condition => ({
  label,
  test: (claims) => (absent(claims, name) ? "ukjent" : YES.has(claimText(claims[name]).trim().toLowerCase())),
  evidence: (claims) => `${name} = ${claimText(claims[name]) || "(mangler)"}`,
});

const notExpired = (name: string, label = "Må være gyldig"): Condition => ({
  label,
  test: (claims, { today }) => {
    if (absent(claims, name)) return "ukjent";
    const until = new Date(claimText(claims[name]));
    return !Number.isNaN(until.getTime()) && until >= today;
  },
  evidence: (claims) => `Gyldig til ${claimText(claims[name]) || "(mangler)"}`,
});

export const SERVICES: readonly Service[] = [
  // ---------- familie og barn ----------
  {
    id: "redusert-foreldrebetaling",
    name: "Redusert foreldrebetaling i barnehage og SFO",
    category: "familie",
    package: "barnefamilie",
    summary: "Lavere pris når husstandens inntekt er under grensen. Kommunen trenger bare å vite at du kvalifiserer, ikke hva du tjener.",
    responseTime: "2 uker",
    requirements: [
      req("barn", childBetween(1, 12, "Krever barn i barnehage- eller SFO-alder")),
      req("inntektsbekreftelse", incomeBelow(INNTEKTSGRENSER.foreldrebetaling, "6 %-regelen", "redusert-foreldrebetaling-barnehage")),
      // Skattemelding, lønnsslipper og NAV-vedtak er KILDENE bak inntektsbekreftelsen, ikke egne bevis:
      // sandkassen har lest dem og svart «kvalifisert». Studentbevis legges ved hvis søkeren er student.
      opt("studentbevis", notExpired("gyldig_til", "Studentbeviset må være gyldig")),
    ],
  },
  {
    id: "gratis-kjernetid",
    name: "Gratis kjernetid i barnehage",
    category: "familie",
    package: "barnefamilie",
    summary: "20 timer gratis barnehage i uka for barn mellom 2 og 5 år når husstandens inntekt er under grensen.",
    responseTime: "2 uker",
    requirements: [
      req("barn", childBetween(2, 5, "Krever barn mellom 2 og 5 år")),
      req("inntektsbekreftelse", incomeBelow(INNTEKTSGRENSER.gratisKjernetid, "Gratis kjernetid")),
    ],
  },
  {
    id: "kulturskole-friplass",
    name: "Friplass i kulturskolen",
    category: "familie",
    package: "barnefamilie",
    summary: "Redusert eller ingen kontingent i Våler kulturskole for barn i skolealder når husstanden har lav inntekt.",
    responseTime: "3 uker",
    requirements: [
      anyOf([{ credential: "barn", condition: childBetween(6, 18, "Krever barn i skolealder") }, "elevbevis"], "Barn i husstanden eller Elevbevis"),
      req("inntektsbekreftelse", incomeBelow(INNTEKTSGRENSER.kulturskole, "Friplass")),
    ],
  },
  {
    id: "borteboerstipend",
    name: "Borteboerstipend",
    category: "utdanning",
    handledBy: "Lånekassen",
    summary: "Stipend for elever og studenter som må bo borte fra foreldrene for å gå på skole.",
    responseTime: "4 uker",
    requirements: [
      anyOf(["elevbevis", { credential: "studentbevis", condition: notExpired("gyldig_til", "Studentbeviset må være gyldig") }], "Elevbevis eller Studentbevis"),
      req("leiekontrakt", startedBy("fra_dato", "Leieforholdet må ha startet")),
    ],
  },

  // ---------- bolig ----------
  {
    id: "bostotte",
    name: "Bostøtte",
    category: "bolig",
    package: "bolig",
    handledBy: "Husbanken",
    summary: "Støtte til boutgifter for husstander med lav inntekt. Husbanken trenger ett bevis på boutgiftene dine; inntekten henter de selv.",
    responseTime: "4 uker (vedtak rundt den 20. i måneden etter)",
    requirements: [
      req("pid", residentIn(MUNICIPALITY)),
      anyOf(["leiekontrakt", "felleskostnader", "boliglaan", "eiendomsskatt"], "bevis på boutgiftene (leiekontrakt, felleskostnader, boliglån eller eiendomsskatt)"),
      opt("inntektsbekreftelse", incomeBelow(INNTEKTSGRENSER.bostotte, "Bostøtte")),
      opt("studentbevis", claimYes("arbeidsrettet_tiltak", "Studenter og elever får bostøtte bare i arbeidsrettet tiltak")),
      opt("tilpasset_bolig", claimYes("bekreftet", "Kommunen må ha bekreftet tilpasningen")),
    ],
  },
  {
    id: "eiendomsskatt-fritak",
    name: "Fritak for eiendomsskatt ved lav inntekt",
    category: "bolig",
    package: "bolig",
    summary: "Helt eller delvis fritak for eiendomsskatt for husstander med lav inntekt.",
    responseTime: "6 uker",
    requirements: [
      req("eiendomsskatt"),
      req("inntektsbekreftelse", incomeBelow(INNTEKTSGRENSER.eiendomsskattFritak, "Fritak")),
    ],
  },
  {
    id: "kommunale-gebyrer",
    name: "Reduserte kommunale gebyrer",
    category: "bolig",
    package: "bolig",
    summary: "Lavere gebyrer for vann, avløp og renovasjon for minstepensjonister som eier egen bolig.",
    responseTime: "6 uker",
    requirements: [
      req("pid", both(ageAtLeast(67), residentIn(MUNICIPALITY))),
      req("eiendomsskatt"),
      req("inntektsbekreftelse", incomeBelow(INNTEKTSGRENSER.kommunaleGebyrer, "Minstepensjonist")),
    ],
  },
  {
    id: "startlaan",
    name: "Startlån til første bolig",
    category: "bolig",
    summary: "Lån fra kommunen til deg som leier i dag og ikke får lån i vanlig bank. Kommunen ser at du leier og at inntekten er innenfor.",
    responseTime: "8 uker",
    requirements: [
      req("pid", residentIn(MUNICIPALITY)),
      req("inntektsbekreftelse", incomeBelow(INNTEKTSGRENSER.startlaan, "Startlån")),
      req("leiekontrakt", startedBy("fra_dato", "Leieforholdet må ha startet")),
      opt("boliglaan", ownsHome),
      opt("eiendomsskatt", ownsHome),
    ],
  },
  {
    id: "tilpasning-bolig",
    name: "Tilskudd til tilpasning av bolig",
    category: "bolig",
    package: "tilrettelegging",
    handledBy: "Husbanken via kommunen",
    summary: "Tilskudd til å bygge om boligen du eier når funksjonsnedsettelsen krever det.",
    responseTime: "8 uker",
    requirements: [
      req("legeerklaering", both(claimYes("varig_funksjonsnedsettelse", "Legeerklæringen må bekrefte varig funksjonsnedsettelse"), notExpired("gyldig_til", "Erklæringen må være gyldig"))),
      anyOf(["boliglaan", "eiendomsskatt"], "bevis på at du eier boligen (boliglån eller eiendomsskatt)"),
    ],
  },
  {
    id: "kommunal-bolig",
    name: "Kommunal utleiebolig",
    category: "bolig",
    summary: "Leie av kommunal bolig for deg som har lav inntekt og helse- eller boligutfordringer.",
    responseTime: "8 uker",
    requirements: [
      req("pid", residentIn(MUNICIPALITY)),
      req("inntektsbekreftelse", incomeBelow(INNTEKTSGRENSER.kommunalBolig, "Kommunal bolig")),
      anyOf([{ credential: "legeerklaering", condition: notExpired("gyldig_til", "Erklæringen må være gyldig") }, "leiekontrakt"], "Legeerklæring eller Leiekontrakt"),
      opt("boliglaan", ownsHome),
      opt("eiendomsskatt", ownsHome),
    ],
  },

  // ---------- helse og omsorg ----------
  {
    id: "ledsagerbevis",
    name: "Ledsagerbevis",
    category: "helse",
    package: "tilrettelegging",
    summary: "Gratis inngang for den som følger deg på kultur- og fritidsarrangementer.",
    responseTime: "3 uker",
    requirements: [
      req("pid", residentIn(MUNICIPALITY)),
      req("legeerklaering", both(claimYes("varig_funksjonsnedsettelse", "Legeerklæringen må bekrefte varig funksjonsnedsettelse"), notExpired("gyldig_til", "Erklæringen må være gyldig"))),
    ],
  },
  {
    id: "trygghetsalarm",
    name: "Trygghetsalarm",
    category: "helse",
    package: "tilrettelegging",
    summary: "Alarm hjemme med direkte kontakt til hjemmetjenesten, for eldre og for deg med funksjonsnedsettelse.",
    responseTime: "2 uker",
    requirements: [
      req("pid", residentIn(MUNICIPALITY)),
      anyOf([{ credential: "pid", condition: ageAtLeast(67) }, { credential: "legeerklaering", condition: both(claimYes("varig_funksjonsnedsettelse", "Legeerklæringen må bekrefte varig funksjonsnedsettelse"), notExpired("gyldig_til", "Erklæringen må være gyldig")) }], "eID (67+) eller Legeerklæring"),
    ],
  },
  {
    id: "bpa",
    name: "Brukerstyrt personlig assistanse (BPA)",
    category: "helse",
    package: "tilrettelegging",
    summary: "Du styrer selv hvem som hjelper deg og når, ved varig og omfattende behov for bistand.",
    responseTime: "8 uker",
    requirements: [
      req("pid", residentIn(MUNICIPALITY)),
      req("legeerklaering", both(claimYes("varig_funksjonsnedsettelse", "Legeerklæringen må bekrefte varig funksjonsnedsettelse"), notExpired("gyldig_til", "Erklæringen må være gyldig"))),
    ],
  },
  {
    id: "stottekontakt",
    name: "Støttekontakt eller avlastning",
    category: "helse",
    package: "tilrettelegging",
    summary: "En fast person til fritidsaktiviteter, eller avlastning for familier med tyngende omsorgsoppgaver.",
    responseTime: "4 uker",
    requirements: [req("pid", residentIn(MUNICIPALITY)), req("legeerklaering", notExpired("gyldig_til", "Erklæringen må være gyldig"))],
  },
  {
    id: "tannhelse-ung",
    name: "Redusert pris hos den offentlige tannhelsetjenesten",
    category: "helse",
    handledBy: "Innlandet fylkeskommune",
    summary: "75 % rabatt på tannbehandling det året du fyller 19 til og med året du fyller 24.",
    responseTime: "1 dag",
    requirements: [req("pid", ageBetween(19, 24))],
  },

  // ---------- transport ----------
  {
    id: "tt-kort",
    name: "TT-kort (tilrettelagt transport)",
    category: "transport",
    package: "tilrettelegging",
    summary: "Drosjereiser til redusert pris for deg som ikke kan bruke vanlig kollektivtransport.",
    responseTime: "4 uker",
    requirements: [req("pid", residentIn(MUNICIPALITY)), req("legeerklaering", notExpired("gyldig_til", "Erklæringen må være gyldig"))],
  },
  {
    id: "parkeringstillatelse",
    name: "Parkeringstillatelse for forflytningshemmede",
    category: "transport",
    package: "tilrettelegging",
    summary: "Parkeringskort for deg som har nedsatt gangfunksjon og kjører selv.",
    responseTime: "3 uker",
    requirements: [
      req("pid", residentIn(MUNICIPALITY)),
      req("legeerklaering", both(claimYes("nedsatt_gangfunksjon", "Legeerklæringen må bekrefte nedsatt gangfunksjon"), notExpired("gyldig_til", "Erklæringen må være gyldig"))),
      req("foererkort", both(hasClass("B"), notExpired("gyldig_til", "Førerkortet må være gyldig"))),
    ],
  },
  {
    id: "bilstonad",
    name: "Stønad til bil eller tilpasning av bil",
    category: "transport",
    package: "tilrettelegging",
    handledBy: "NAV",
    summary: "Støtte til kjøp eller ombygging av bil når nedsatt gangfunksjon gjør kollektivtransport uaktuelt.",
    responseTime: "12 uker",
    requirements: [
      req("foererkort", both(hasClass("B"), notExpired("gyldig_til", "Førerkortet må være gyldig"))),
      req("legeerklaering", both(claimYes("nedsatt_gangfunksjon", "Legeerklæringen må bekrefte nedsatt gangfunksjon"), notExpired("gyldig_til", "Erklæringen må være gyldig"))),
    ],
  },
  {
    id: "skoleskyss",
    name: "Skoleskyss",
    category: "transport",
    summary: "Gratis skyss til og fra skolen ved lang eller farlig skolevei, eller uansett avstand ved funksjonsnedsettelse.",
    responseTime: "2 uker",
    requirements: [
      req("pid", residentIn(MUNICIPALITY)),
      anyOf(["elevbevis", { credential: "barn", condition: childBetween(6, 18, "Krever barn i skolealder") }], "Elevbevis eller Barn i husstanden"),
      opt("legeerklaering", notExpired("gyldig_til", "Erklæringen må være gyldig")),
    ],
  },
  {
    id: "ungdomsbillett",
    name: "Ungdoms- og studentbillett",
    category: "transport",
    handledBy: "Innlandstrafikk",
    summary: "Rabattert månedsbillett på buss og tog i Innlandet for deg under 20, eller elev og student.",
    responseTime: "1 dag",
    requirements: [
      anyOf(
        [{ credential: "pid", condition: ageBetween(0, 19) }, "elevbevis", { credential: "studentbevis", condition: notExpired("gyldig_til", "Studentbeviset må være gyldig") }],
        "eID (under 20), Elevbevis eller Studentbevis",
      ),
    ],
  },

  // ---------- kultur og fritid ----------
  {
    id: "laanekort",
    name: "Lånekort på Våler bibliotek",
    category: "kultur",
    summary: "Nasjonalt lånekort med henting på Våler bibliotek. Klart samme dag.",
    responseTime: "1 dag",
    requirements: [req("pid")],
  },
  {
    id: "bua",
    name: "Gratis lån av sports- og friluftsutstyr (BUA)",
    category: "kultur",
    summary: "Ski, sykler, telt og skøyter til låns for innbyggere i kommunen.",
    responseTime: "1 dag",
    requirements: [req("pid", residentIn(MUNICIPALITY))],
  },
  {
    id: "fritidskortet",
    name: "Fritidskortet for barn og unge",
    category: "kultur",
    summary: "Støtte til én fast fritidsaktivitet for barn og unge mellom 6 og 18 år.",
    responseTime: "1 uke",
    requirements: [
      anyOf([{ credential: "pid", condition: ageBetween(6, 18) }, { credential: "barn", condition: childBetween(6, 18, "Krever barn mellom 6 og 18 år") }], "eID (6 til 18 år) eller Barn i husstanden"),
    ],
  },
  {
    id: "seniorkort",
    name: "Seniorkortet",
    category: "kultur",
    summary: "Rabatt på svømmehall, kino og kulturhus for deg over 67.",
    responseTime: "1 uke",
    requirements: [req("pid", ageAtLeast(67))],
  },

  // ---------- utdanning og arbeid ----------
  {
    id: "voksenopplaering",
    name: "Voksenopplæring",
    category: "utdanning",
    summary: "Grunnskole og norskopplæring for voksne, gratis for innbyggere i kommunen.",
    responseTime: "3 uker",
    requirements: [req("pid", residentIn(MUNICIPALITY))],
  },
];

// ---------- kvalifisering ----------

/**
 * Én vurdering innbyggeren kan lese: hvilket bevis, hvilken regel, hva beviset faktisk sa, og
 * utfallet. Det er disse linjene som viser HVORFOR hun har rett, eller ikke har det.
 */
export interface Check {
  credential: QueryId | null;
  /** Bevisets navn, eller «ett av …»-teksten når ingen av alternativene er delt. */
  label: string;
  rule: string;
  /** Verdien fra beviset som vurderingen bygger på. Null når beviset ikke er delt. */
  evidence: string | null;
  result: "ok" | "failed" | "missing" | "skipped";
}

export type RequirementStatus =
  | { state: "ok"; credentials: QueryId[]; checks: Check[] }
  | { state: "missing"; label: string; checks: Check[] }
  | { state: "failed"; credential: QueryId; reason: string; checks: Check[] }
  /** Valgfritt bevis som ikke ble delt. Teller verken for eller mot. */
  | { state: "skipped"; credential: QueryId; checks: Check[] };

export interface Assessment {
  service: Service;
  /** ready: alt dekket · missing: bevis mangler · ineligible: et delt bevis sier nei (vinner over missing) */
  outcome: "ready" | "missing" | "ineligible";
  requirements: RequirementStatus[];
  /** Alle vurderingene, i rekkefølge, til «Slik vurderte vi»-lista. */
  checks: Check[];
  /** Bevisene som faktisk dekker kravene, i menneskelig form. */
  coveredLabels: string[];
  /** Det som mangler, i menneskelig form. Tom for ready og ineligible. */
  missingLabels: string[];
}

/** Uten egen betingelse holder det at beviset er delt; vi viser claimene regelen ba om. */
function summarize(credential: PresentedCredential): string {
  const definition = CREDENTIAL_BY_ID[credential.queryId];
  return definition.requestedClaims
    .map((name) => [name, claimText(credential.claims[name])] as const)
    .filter(([, value]) => value)
    .slice(0, 3)
    .map(([name, value]) => `${name}: ${value}`)
    .join(" · ");
}

function checkOption(credential: PresentedCredential, condition: Condition | undefined, today: Date): Check {
  const definition = CREDENTIAL_BY_ID[credential.queryId];
  if (!condition) return { credential: credential.queryId, label: definition.label, rule: "Beviset er delt", evidence: summarize(credential), result: "ok" };
  const context = { today };
  const verdict = condition.test(credential.claims, context);
  return {
    credential: credential.queryId,
    label: definition.label,
    rule: condition.label,
    evidence: condition.evidence(credential.claims, context),
    // «ukjent» er ikke et nei. Det er samme utfall som et bevis hun ikke har delt: noe mangler.
    result: verdict === true ? "ok" : verdict === "ukjent" ? "missing" : "failed",
  };
}

function assessRequirement(requirement: Requirement, byId: Map<QueryId, PresentedCredential>, today: Date): RequirementStatus {
  switch (requirement.kind) {
    case "required":
    case "optional": {
      const definition = CREDENTIAL_BY_ID[requirement.credential];
      const credential = byId.get(requirement.credential);
      if (!credential) {
        const missingCheck: Check = {
          credential: requirement.credential,
          label: definition.label,
          rule: requirement.condition?.label ?? (requirement.kind === "optional" ? "Valgfritt vedlegg" : "Beviset må deles"),
          evidence: null,
          result: requirement.kind === "optional" ? "skipped" : "missing",
        };
        return requirement.kind === "optional"
          ? { state: "skipped", credential: requirement.credential, checks: [missingCheck] }
          : { state: "missing", label: definition.label, checks: [missingCheck] };
      }
      const check = checkOption(credential, requirement.condition, today);
      if (check.result === "failed") return { state: "failed", credential: requirement.credential, reason: check.rule, checks: [check] };
      // Delt, men svarer ikke på spørsmålet. Et valgfritt bevis teller da hverken for eller mot,
      // som om det ikke var delt; et påkrevd blir «mangler», med beskjed om hva hun trenger.
      if (check.result === "missing") {
        return requirement.kind === "optional"
          ? { state: "skipped", credential: requirement.credential, checks: [{ ...check, result: "skipped" }] }
          : { state: "missing", label: requirement.condition?.missingLabel ?? definition.label, checks: [check] };
      }
      return { state: "ok", credentials: [requirement.credential], checks: [check] };
    }
    case "anyOf": {
      // Ett alternativ som holder er nok. Ingen holder: «mangler» så lenge det finnes et alternativ
      // innbyggeren ikke har delt ennå (hun kan fortsatt hente det), «ikke aktuelt» først når alle
      // alternativene er delt og alle sier nei.
      const checks: Check[] = [];
      const passing: QueryId[] = [];
      let firstFailure: Check | null = null;
      let anyUnshared = false;
      for (const option of requirement.options) {
        const credential = byId.get(option.credential);
        if (!credential) {
          anyUnshared = true;
          continue;
        }
        const check = checkOption(credential, option.condition, today);
        checks.push(check);
        if (check.result === "ok") passing.push(option.credential);
        // Delt, men uten svar på spørsmålet: like åpent som et alternativ hun ikke har delt.
        else if (check.result === "missing") anyUnshared = true;
        else firstFailure ??= check;
      }
      if (passing.length > 0) return { state: "ok", credentials: passing, checks };
      if (anyUnshared || !firstFailure) {
        checks.push({ credential: null, label: requirement.label, rule: "Ett av bevisene må deles", evidence: null, result: "missing" });
        return { state: "missing", label: requirement.label, checks };
      }
      return { state: "failed", credential: firstFailure.credential!, reason: firstFailure.rule, checks };
    }
  }
}

export function assess(presented: readonly PresentedCredential[], today: Date = new Date()): Assessment[] {
  const byId = new Map(presented.map((credential) => [credential.queryId, credential]));
  const rank = { ready: 0, missing: 1, ineligible: 2 } as const;

  return SERVICES.map((service): Assessment => {
    const requirements = service.requirements.map((requirement) => assessRequirement(requirement, byId, today));
    const outcome = requirements.some((r) => r.state === "failed")
      ? "ineligible"
      : requirements.some((r) => r.state === "missing")
        ? "missing"
        : "ready";
    const coveredLabels = [
      ...new Set(requirements.flatMap((r) => (r.state === "ok" ? r.credentials.map((id) => CREDENTIAL_BY_ID[id].label) : []))),
    ];
    return {
      service,
      outcome,
      requirements,
      checks: requirements.flatMap((r) => r.checks),
      coveredLabels,
      missingLabels: outcome === "missing" ? requirements.flatMap((r) => (r.state === "missing" ? [r.label] : [])) : [],
    };
  }).sort((a, b) => rank[a.outcome] - rank[b.outcome] || a.missingLabels.length - b.missingLabels.length);
}

/** Tjenestene et bevis er med på å åpne (som krav, valgfritt eller ett-av). */
export function servicesUsing(queryId: QueryId, services: readonly Service[] = SERVICES): Service[] {
  return services.filter((service) =>
    service.requirements.some((requirement) =>
      requirement.kind === "anyOf" ? requirement.options.some((option) => option.credential === queryId) : requirement.credential === queryId,
    ),
  );
}

/** Nyeste deling vinner per bevistype. */
export function mergeCredentials(existing: readonly PresentedCredential[], incoming: readonly PresentedCredential[]): PresentedCredential[] {
  const byId = new Map(existing.map((c) => [c.queryId, c]));
  for (const credential of incoming) byId.set(credential.queryId, credential);
  return [...byId.values()];
}
