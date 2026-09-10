import { describe, expect, it } from "vitest";
import { assessServices } from "./eligibility";
import type { PresentedCredential } from "./credentials";

const today = new Date("2026-09-10");

const pid = (overrides: Partial<Record<string, string>> = {}): PresentedCredential => ({
  queryId: "pid",
  issuer: "test",
  claims: {
    given_name: "Kari",
    family_name: "Nordmann",
    birthdate: "1985-04-12",
    resident_municipality: "Våler",
    ...overrides,
  },
});

const outcomeOf = (assessments: ReturnType<typeof assessServices>, id: string) =>
  assessments.find((a) => a.service.id === id)!;

describe("assessServices", () => {
  it("uten bevis mangler alt", () => {
    const result = assessServices([], today);
    expect(result.every((a) => a.outcome === "missing")).toBe(true);
  });

  it("PID alene gir lånekort, men fritidskortet og seniorkortet er ikke aktuelle for en voksen", () => {
    const result = assessServices([pid()], today);
    expect(outcomeOf(result, "laanekort").outcome).toBe("ready");
    expect(outcomeOf(result, "fritidskortet").outcome).toBe("ineligible");
    expect(outcomeOf(result, "seniorkort").outcome).toBe("ineligible");
  });

  it("alder regnes fra fødselsdato på dagen", () => {
    const result = assessServices([pid({ birthdate: "2008-09-11" })], today); // fyller 18 i morgen
    expect(outcomeOf(result, "fritidskortet").outcome).toBe("ready");
    const dayAfter = assessServices([pid({ birthdate: "2008-09-11" })], new Date("2027-09-11"));
    expect(outcomeOf(dayAfter, "fritidskortet").outcome).toBe("ineligible");
  });

  it("inntektsbekreftelse med kvalifisert=true gir redusert foreldrebetaling", () => {
    const inntekt: PresentedCredential = {
      queryId: "inntekt",
      issuer: "test",
      claims: { navn: "Kari Nordmann", ordning: "redusert-foreldrebetaling-barnehage", inntektsaar: 2025, kvalifisert: true },
    };
    const result = assessServices([pid(), inntekt], today);
    expect(outcomeOf(result, "redusert-foreldrebetaling").outcome).toBe("ready");
  });

  it("kvalifisert=false slår ut som ikke aktuelt, ikke som manglende bevis", () => {
    const inntekt: PresentedCredential = {
      queryId: "inntekt",
      issuer: "test",
      claims: { navn: "Kari Nordmann", ordning: "x", inntektsaar: 2025, kvalifisert: false },
    };
    const result = assessServices([pid(), inntekt], today);
    const assessment = outcomeOf(result, "redusert-foreldrebetaling");
    expect(assessment.outcome).toBe("ineligible");
    expect(assessment.missingLabels).toEqual([]);
  });

  it("bosted utenfor Våler stopper kommunale tjenester", () => {
    const result = assessServices([pid({ resident_municipality: "Elverum" })], today);
    expect(outcomeOf(result, "redusert-foreldrebetaling").outcome).toBe("ineligible");
    expect(outcomeOf(result, "laanekort").outcome).toBe("ready");
  });

  it("manglende bevis listes med navn", () => {
    const result = assessServices([pid()], today);
    expect(outcomeOf(result, "parkeringstillatelse").missingLabels).toEqual(["Legeerklæring", "Førerkort"]);
  });
});
