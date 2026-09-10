// Tjenestene i Våler kommune hubben kan foreslå, og hva som må til for hver av dem.
//
// Et krav peker på ett bevis (queryId) og kan i tillegg stille en betingelse på claimene.
// Kvalifiseringsmotoren i eligibility.ts avgjør per tjeneste: klar, mangler bevis, eller
// ikke aktuelt. Betingelsene får `today` inn, så alder kan testes deterministisk.

import type { Claims, CredentialQueryId } from "./credentials";

export type Condition = {
  /** Kort tekst innbyggeren ser når betingelsen ikke er oppfylt, f.eks. «Gjelder 6 til 18 år». */
  label: string;
  test: (claims: Claims, context: { today: Date }) => boolean;
};

export type Requirement = {
  credential: CredentialQueryId;
  condition?: Condition;
};

export type ServiceCategory = "familie" | "helse" | "transport" | "kultur" | "bolig";

export type Service = {
  id: string;
  name: string;
  category: ServiceCategory;
  summary: string;
  /** Hvor søknaden går videre. Dummy-lenke inntil kommunen har en ekte. */
  applyUrl: string;
  requirements: Requirement[];
};

export function ageOn(birthdate: Claims[string] | undefined, today: Date): number | null {
  if (typeof birthdate !== "string") return null;
  const parsed = new Date(birthdate);
  if (Number.isNaN(parsed.getTime())) return null;
  let age = today.getFullYear() - parsed.getFullYear();
  const hadBirthday =
    today.getMonth() > parsed.getMonth() ||
    (today.getMonth() === parsed.getMonth() && today.getDate() >= parsed.getDate());
  if (!hadBirthday) age -= 1;
  return age;
}

const ageBetween = (min: number, max: number): Condition => ({
  label: `Gjelder ${min} til ${max} år`,
  test: (claims, { today }) => {
    const age = ageOn(claims.birthdate, today);
    return age !== null && age >= min && age <= max;
  },
});

const ageAtLeast = (min: number): Condition => ({
  label: `Gjelder fra ${min} år`,
  test: (claims, { today }) => {
    const age = ageOn(claims.birthdate, today);
    return age !== null && age >= min;
  },
});

const residentIn = (municipality: string): Condition => ({
  label: `Krever bosted i ${municipality}`,
  test: (claims) => claims.resident_municipality === municipality,
});

const claimTrue = (name: string, label: string): Condition => ({
  label,
  test: (claims) => claims[name] === true,
});

const notExpired = (name: string): Condition => ({
  label: "Erklæringen må være gyldig",
  test: (claims, { today }) => {
    const value = claims[name];
    if (typeof value !== "string") return false;
    const until = new Date(value);
    return !Number.isNaN(until.getTime()) && until >= today;
  },
});

export const MUNICIPALITY = "Våler";

export const SERVICES: readonly Service[] = [
  {
    id: "redusert-foreldrebetaling",
    name: "Redusert foreldrebetaling i barnehage og SFO",
    category: "familie",
    summary: "Lavere pris når husstandens inntekt er under grensen. Kommunen trenger bare å vite at du kvalifiserer, ikke hva du tjener.",
    applyUrl: "https://www.vaaler.kommune.no/",
    requirements: [
      { credential: "pid", condition: residentIn(MUNICIPALITY) },
      { credential: "inntekt", condition: claimTrue("kvalifisert", "Inntektsbekreftelsen må si at husstanden kvalifiserer") },
    ],
  },
  {
    id: "parkeringstillatelse",
    name: "Parkeringstillatelse for forflytningshemmede",
    category: "transport",
    summary: "Parkeringskort for deg som har nedsatt gangfunksjon og kjører selv.",
    applyUrl: "https://www.vaaler.kommune.no/",
    requirements: [
      { credential: "pid", condition: residentIn(MUNICIPALITY) },
      { credential: "legeerklaering", condition: claimTrue("nedsatt_gangfunksjon", "Legeerklæringen må bekrefte nedsatt gangfunksjon") },
      { credential: "foererkort" },
    ],
  },
  {
    id: "ledsagerbevis",
    name: "Ledsagerbevis",
    category: "helse",
    summary: "Gratis inngang for den som følger deg på kultur- og fritidsarrangementer.",
    applyUrl: "https://www.vaaler.kommune.no/",
    requirements: [
      { credential: "pid", condition: residentIn(MUNICIPALITY) },
      { credential: "legeerklaering", condition: claimTrue("varig_funksjonsnedsettelse", "Legeerklæringen må bekrefte varig funksjonsnedsettelse") },
    ],
  },
  {
    id: "tt-kort",
    name: "TT-kort (tilrettelagt transport)",
    category: "transport",
    summary: "Drosjereiser til redusert pris for deg som ikke kan bruke vanlig kollektivtransport.",
    applyUrl: "https://www.vaaler.kommune.no/",
    requirements: [
      { credential: "pid", condition: residentIn(MUNICIPALITY) },
      { credential: "legeerklaering", condition: notExpired("gyldig_til") },
    ],
  },
  {
    id: "fritidskortet",
    name: "Fritidskortet for barn og unge",
    category: "kultur",
    summary: "Støtte til én fast fritidsaktivitet for barn og unge mellom 6 og 18 år.",
    applyUrl: "https://www.vaaler.kommune.no/",
    requirements: [
      { credential: "pid", condition: ageBetween(6, 18) },
    ],
  },
  {
    id: "skoleskyss",
    name: "Skoleskyss",
    category: "transport",
    summary: "Gratis skyss til og fra skolen for elever med lang eller farlig skolevei.",
    applyUrl: "https://www.vaaler.kommune.no/",
    requirements: [
      { credential: "pid", condition: residentIn(MUNICIPALITY) },
      { credential: "elevbevis" },
    ],
  },
  {
    id: "seniorkort",
    name: "Seniorkortet",
    category: "kultur",
    summary: "Rabatt på svømmehall, kino og kulturhus for deg over 67.",
    applyUrl: "https://www.vaaler.kommune.no/",
    requirements: [
      { credential: "pid", condition: ageAtLeast(67) },
    ],
  },
  {
    id: "laanekort",
    name: "Lånekort på Våler bibliotek",
    category: "kultur",
    summary: "Nasjonalt lånekort med henting på Våler bibliotek.",
    applyUrl: "https://www.vaaler.kommune.no/",
    requirements: [{ credential: "pid" }],
  },
];

export const CATEGORY_LABELS: Record<ServiceCategory, string> = {
  familie: "Familie og barn",
  helse: "Helse og omsorg",
  transport: "Transport",
  kultur: "Kultur og fritid",
  bolig: "Bolig",
};
