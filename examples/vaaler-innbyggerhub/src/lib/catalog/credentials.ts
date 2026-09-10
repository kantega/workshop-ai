// Bevistypene hubben kjenner til. Hver av dem blir én DCQL credential query, og hver query
// ligger i sitt eget valgfrie credential_set (required: false). Innbyggeren deler det hun har;
// hubben leser hvilke query-id-er som faktisk kom tilbake.
//
// `queryId` er nøkkelen gjennom hele appen: DCQL-query, verifierens `presentations[].queryId`,
// og tjenestenes krav peker alle på den.

export type ClaimValue = string | number | boolean | null;
export type Claims = Record<string, ClaimValue>;

export type CredentialQueryId =
  | "pid"
  | "inntekt"
  | "legeerklaering"
  | "foererkort"
  | "elevbevis";

export type CredentialDefinition = {
  queryId: CredentialQueryId;
  /** Navnet bevistypen har i Bevis Studio. Brukes til å finne/rigge typen og slå opp `vct`. */
  studioName: string;
  label: string;
  description: string;
  /** Claimene fremvisningen ber om. Be bare om det tjenestereglene faktisk trenger. */
  requestedClaims: string[];
  /** Kun for mock-gateway og lokal rigging: claimene bevistypen har, med datatype. */
  schema: { name: string; dataType: "STRING" | "NUMBER" | "BOOLEAN" | "DATE"; mandatory: boolean }[];
};

export const CREDENTIALS: readonly CredentialDefinition[] = [
  {
    queryId: "pid",
    studioName: "Personidentifikasjon",
    label: "Personbevis (PID)",
    description: "Navn, fødselsdato og bostedskommune.",
    requestedClaims: ["given_name", "family_name", "birthdate", "resident_municipality"],
    schema: [
      { name: "given_name", dataType: "STRING", mandatory: true },
      { name: "family_name", dataType: "STRING", mandatory: true },
      { name: "birthdate", dataType: "DATE", mandatory: true },
      { name: "resident_municipality", dataType: "STRING", mandatory: true },
    ],
  },
  {
    queryId: "inntekt",
    studioName: "Inntektsbekreftelse",
    label: "Inntektsbekreftelse",
    description: "Bekrefter om husstanden kvalifiserer til en inntektsavhengig ordning, uten å vise beløpet.",
    requestedClaims: ["navn", "ordning", "inntektsaar", "kvalifisert"],
    schema: [
      { name: "navn", dataType: "STRING", mandatory: true },
      { name: "ordning", dataType: "STRING", mandatory: true },
      { name: "inntektsaar", dataType: "NUMBER", mandatory: true },
      { name: "kvalifisert", dataType: "BOOLEAN", mandatory: true },
      { name: "beregningsbeloep", dataType: "NUMBER", mandatory: false },
    ],
  },
  {
    queryId: "legeerklaering",
    studioName: "Legeerklæring funksjonsnedsettelse",
    label: "Legeerklæring",
    description: "Bekrefter varig funksjonsnedsettelse, uten diagnose.",
    requestedClaims: ["varig_funksjonsnedsettelse", "nedsatt_gangfunksjon", "gyldig_til"],
    schema: [
      { name: "varig_funksjonsnedsettelse", dataType: "BOOLEAN", mandatory: true },
      { name: "nedsatt_gangfunksjon", dataType: "BOOLEAN", mandatory: true },
      { name: "gyldig_til", dataType: "DATE", mandatory: true },
      { name: "diagnose", dataType: "STRING", mandatory: false },
    ],
  },
  {
    queryId: "foererkort",
    studioName: "Førerkort",
    label: "Førerkort",
    description: "Førerkortklasser.",
    requestedClaims: ["klasser"],
    schema: [
      { name: "klasser", dataType: "STRING", mandatory: true },
      { name: "gyldig_til", dataType: "DATE", mandatory: true },
    ],
  },
  {
    queryId: "elevbevis",
    studioName: "Elevbevis",
    label: "Elevbevis",
    description: "Skole og trinn.",
    requestedClaims: ["skole", "trinn"],
    schema: [
      { name: "skole", dataType: "STRING", mandatory: true },
      { name: "trinn", dataType: "NUMBER", mandatory: true },
    ],
  },
];

export const CREDENTIAL_BY_ID: Readonly<Record<CredentialQueryId, CredentialDefinition>> = Object.fromEntries(
  CREDENTIALS.map((credential) => [credential.queryId, credential]),
) as Record<CredentialQueryId, CredentialDefinition>;

export function isCredentialQueryId(value: string): value is CredentialQueryId {
  return value in CREDENTIAL_BY_ID;
}

/** Et bevis slik det ser ut etter at verifieren har godkjent det. */
export type PresentedCredential = {
  queryId: CredentialQueryId;
  issuer: string | null;
  claims: Claims;
};
