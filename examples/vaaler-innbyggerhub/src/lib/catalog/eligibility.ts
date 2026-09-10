// Sorterer tjenestene ut fra hvilke bevis innbyggeren faktisk delte.
//
// Tre utfall per tjeneste:
//   ready      alle krav er dekket, og betingelsene holder
//   missing    ett eller flere bevis mangler (de som ER delt holder)
//   ineligible et delt bevis sier at innbyggeren ikke kvalifiserer
//
// «ineligible» vinner over «missing»: har vi først et bevis som sier nei, hjelper det ikke å
// hente de andre.

import { CREDENTIAL_BY_ID, type CredentialQueryId, type PresentedCredential } from "./credentials";
import { SERVICES, type Service } from "./services";

export type RequirementStatus =
  | { credential: CredentialQueryId; state: "ok" }
  | { credential: CredentialQueryId; state: "missing" }
  | { credential: CredentialQueryId; state: "failed"; reason: string };

export type ServiceAssessment = {
  service: Service;
  outcome: "ready" | "missing" | "ineligible";
  requirements: RequirementStatus[];
  /** Bevisene som mangler, i menneskelig form. Tom for ready og ineligible. */
  missingLabels: string[];
};

export function assessServices(
  presented: readonly PresentedCredential[],
  today: Date = new Date(),
  services: readonly Service[] = SERVICES,
): ServiceAssessment[] {
  const byId = new Map(presented.map((credential) => [credential.queryId, credential]));

  return services.map((service) => {
    const requirements: RequirementStatus[] = service.requirements.map((requirement) => {
      const credential = byId.get(requirement.credential);
      if (!credential) return { credential: requirement.credential, state: "missing" };
      if (requirement.condition && !requirement.condition.test(credential.claims, { today })) {
        return { credential: requirement.credential, state: "failed", reason: requirement.condition.label };
      }
      return { credential: requirement.credential, state: "ok" };
    });

    const outcome = requirements.some((status) => status.state === "failed")
      ? "ineligible"
      : requirements.some((status) => status.state === "missing")
        ? "missing"
        : "ready";

    const missingLabels =
      outcome === "missing"
        ? requirements
            .filter((status) => status.state === "missing")
            .map((status) => CREDENTIAL_BY_ID[status.credential].label)
        : [];

    return { service, outcome, requirements, missingLabels };
  });
}

/** Sortert for visning: klare først, så de som mangler lite, så ikke aktuelle. */
export function sortForDisplay(assessments: ServiceAssessment[]): ServiceAssessment[] {
  const rank = { ready: 0, missing: 1, ineligible: 2 } as const;
  return [...assessments].sort(
    (a, b) => rank[a.outcome] - rank[b.outcome] || a.missingLabels.length - b.missingLabels.length,
  );
}
