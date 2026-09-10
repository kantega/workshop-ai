// Testpersoner for innloggings-stubben. Hver har en «lommebok» med de bevisene hun ville hatt,
// brukt av mock-gatewayen (del med et klikk) og av demo-utstedelsen i verifier-modus (legg
// beviset i en ekte lommebok).

import type { Claims, CredentialQueryId } from "@/lib/catalog/credentials";

export type TestPerson = {
  id: string;
  name: string;
  tagline: string;
  wallet: { queryId: CredentialQueryId; claims: Claims }[];
};

export const TEST_PERSONS: readonly TestPerson[] = [
  {
    id: "kari",
    name: "Kari Nordmann",
    tagline: "41 år, to barn i barnehage, bor i Våler",
    wallet: [
      { queryId: "pid", claims: { given_name: "Kari", family_name: "Nordmann", birthdate: "1985-04-12", resident_municipality: "Våler" } },
      { queryId: "inntekt", claims: { navn: "Kari Nordmann", ordning: "redusert-foreldrebetaling-barnehage", inntektsaar: 2025, kvalifisert: true, beregningsbeloep: 512000 } },
    ],
  },
  {
    id: "ola",
    name: "Ola Hansen",
    tagline: "74 år, nedsatt gangfunksjon, kjører selv",
    wallet: [
      { queryId: "pid", claims: { given_name: "Ola", family_name: "Hansen", birthdate: "1952-01-30", resident_municipality: "Våler" } },
      { queryId: "legeerklaering", claims: { varig_funksjonsnedsettelse: true, nedsatt_gangfunksjon: true, gyldig_til: "2028-06-30", diagnose: "M17" } },
      { queryId: "foererkort", claims: { klasser: "B", gyldig_til: "2029-01-30" } },
    ],
  },
  {
    id: "emma",
    name: "Emma Berg",
    tagline: "15 år, elev ved Våler ungdomsskole",
    wallet: [
      { queryId: "pid", claims: { given_name: "Emma", family_name: "Berg", birthdate: "2011-03-08", resident_municipality: "Våler" } },
      { queryId: "elevbevis", claims: { skole: "Våler ungdomsskole", trinn: 10 } },
    ],
  },
  {
    id: "jonas",
    name: "Jonas Lie",
    tagline: "35 år, bor i Elverum, jobber i Våler",
    wallet: [
      { queryId: "pid", claims: { given_name: "Jonas", family_name: "Lie", birthdate: "1991-07-19", resident_municipality: "Elverum" } },
    ],
  },
];

export function findTestPerson(id: string | undefined): TestPerson | null {
  return TEST_PERSONS.find((person) => person.id === id) ?? null;
}
