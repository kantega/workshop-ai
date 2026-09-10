// Demo-lommeboka: testpersoner med bevisene de ville hatt, til å «dele» uten plattform og
// telefon. Samme claims som eksemplene i katalogen, så det som vises stemmer med det en ekte
// utstedelse fra verktøypanelet ville gitt.

import { CREDENTIAL_BY_ID, type PresentedCredential, type QueryId } from "../catalog";

export interface DemoPersona {
  id: string;
  name: string;
  tagline: string;
  wallet: { queryId: QueryId; claims: Record<string, string> }[];
}

export const DEMO_PERSONAS: readonly DemoPersona[] = [
  {
    id: "kari",
    name: "Kari Nordmann",
    tagline: "41 år, to barn, bor i Våler",
    wallet: [
      { queryId: "pid", claims: { given_name: "Kari", family_name: "Nordmann", birthdate: "1985-04-12", resident_municipality: "Våler" } },
      { queryId: "barn", claims: { antall_barn: "2", yngste_foedselsdato: "2022-09-03", eldste_foedselsdato: "2016-02-17" } },
      { queryId: "inntektsbekreftelse", claims: { navn: "Kari Nordmann", ordning: "redusert-foreldrebetaling-barnehage", inntektsaar: "2025", kvalifisert: "ja", beregningsbeloep: "385000" } },
      { queryId: "leiekontrakt", claims: { adresse: "Vålgutua 12, 2436 Våler i Solør", maanedlig_husleie: "9500", fra_dato: "2025-08-01" } },
    ],
  },
  {
    id: "ola",
    name: "Ola Hansen",
    tagline: "74 år, nedsatt gangfunksjon, eier enebolig",
    wallet: [
      { queryId: "pid", claims: { given_name: "Ola", family_name: "Hansen", birthdate: "1952-01-30", resident_municipality: "Våler" } },
      { queryId: "legeerklaering", claims: { varig_funksjonsnedsettelse: "ja", nedsatt_gangfunksjon: "ja", gyldig_til: "2028-06-30" } },
      { queryId: "foererkort", claims: { klasser: "B", gyldig_til: "2029-01-30" } },
      { queryId: "eiendomsskatt", claims: { adresse: "Skogvegen 18, 2436 Våler i Solør", aarlig_eiendomsskatt: "6400", aarlig_festeavgift: "0" } },
      { queryId: "inntektsbekreftelse", claims: { navn: "Ola Hansen", ordning: "minstepensjon", inntektsaar: "2025", kvalifisert: "ja", beregningsbeloep: "268000" } },
    ],
  },
  {
    id: "emma",
    name: "Emma Berg",
    tagline: "21 år, student, leier hybel",
    wallet: [
      { queryId: "pid", claims: { given_name: "Emma", family_name: "Berg", birthdate: "2005-03-08", resident_municipality: "Våler" } },
      { queryId: "studentbevis", claims: { laerested: "Høgskolen i Innlandet", gyldig_til: "2027-06-30", arbeidsrettet_tiltak: "nei" } },
      { queryId: "leiekontrakt", claims: { adresse: "Storgata 3, 2436 Våler i Solør", maanedlig_husleie: "6000", fra_dato: "2025-08-15" } },
    ],
  },
  {
    id: "per",
    name: "Per Olsen",
    tagline: "38 år, to barn, inntekt over grensen",
    wallet: [
      { queryId: "pid", claims: { given_name: "Per", family_name: "Olsen", birthdate: "1988-11-02", resident_municipality: "Våler" } },
      { queryId: "barn", claims: { antall_barn: "2", yngste_foedselsdato: "2021-05-20", eldste_foedselsdato: "2018-08-09" } },
      { queryId: "inntektsbekreftelse", claims: { navn: "Per Olsen", ordning: "redusert-foreldrebetaling-barnehage", inntektsaar: "2025", kvalifisert: "nei", beregningsbeloep: "720000" } },
      { queryId: "boliglaan", claims: { adresse: "Furuvegen 7, 2436 Våler i Solør", maanedlig_terminbeloep: "14200" } },
    ],
  },
  {
    id: "jonas",
    name: "Jonas Lie",
    tagline: "35 år, bor i Elverum, jobber i Våler",
    wallet: [{ queryId: "pid", claims: { given_name: "Jonas", family_name: "Lie", birthdate: "1991-07-19", resident_municipality: "Elverum" } }],
  },
];

/**
 * Demo-lommeboka later som den er verifieren, og da må den svare som verifieren: bare de claimene
 * fremvisningsregelen faktisk ber om. Uten filteret lekker `beregningsbeloep` inn i vurderingen,
 * og demoen viser åtte inntektstjenester som klare der en ekte skanning gir én. En demo som er
 * blidere enn virkeligheten er verre enn ingen demo.
 */
export function demoCredentials(persona: DemoPersona, chosen: ReadonlySet<QueryId>): PresentedCredential[] {
  return persona.wallet
    .filter((entry) => chosen.has(entry.queryId))
    .map((entry) => {
      const requested = new Set(CREDENTIAL_BY_ID[entry.queryId].requestedClaims);
      const claims = Object.fromEntries(Object.entries(entry.claims).filter(([name]) => requested.has(name)));
      return { queryId: entry.queryId, issuer: "demo://lommebok", claims };
    });
}
