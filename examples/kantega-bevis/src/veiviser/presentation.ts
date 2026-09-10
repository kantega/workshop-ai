// Fra verifierens resultat til bevisene appen regner på. Verifieren sier hvilken DCQL-query
// hvert bevis svarte på (`queryId`); mangler den, kjenner vi beviset igjen på `vct`.

import { PROTOCOL_CLAIMS, type PresentationResult, type VeiviserSetup } from "../api";
import { claimText, isQueryId, type PresentedCredential } from "../catalog";

export function toCredentials(result: PresentationResult, setup: VeiviserSetup): { credentials: PresentedCredential[]; unknown: string[] } {
  const credentials: PresentedCredential[] = [];
  const unknown: string[] = [];
  const queryByVct = new Map(Object.entries(setup.vctByQueryId).map(([queryId, vct]) => [vct, queryId]));

  for (const outcome of result.presentations ?? []) {
    const queryId = outcome.queryId ?? queryByVct.get(claimText(outcome.claims.vct)) ?? null;
    if (!isQueryId(queryId)) {
      unknown.push(queryId ?? claimText(outcome.claims.vct) ?? "(ukjent)");
      continue;
    }
    const claims = Object.fromEntries(Object.entries(outcome.claims).filter(([key]) => !PROTOCOL_CLAIMS.includes(key)));
    credentials.push({ queryId, issuer: outcome.issuer ?? claimText(outcome.claims.iss) ?? null, claims });
  }
  return { credentials, unknown };
}

/** Fornavnet til hilsenen, fra det beviset som har et navn. */
export function firstName(credentials: readonly PresentedCredential[]): string | null {
  for (const credential of credentials) {
    const given = claimText(credential.claims.given_name);
    if (given) return given;
    const full = claimText(credential.claims.navn);
    if (full) return full.split(" ")[0];
  }
  return null;
}

export function fullName(credentials: readonly PresentedCredential[]): string | null {
  for (const credential of credentials) {
    const given = claimText(credential.claims.given_name);
    const family = claimText(credential.claims.family_name);
    if (given) return [given, family].filter(Boolean).join(" ");
    const full = claimText(credential.claims.navn);
    if (full) return full;
  }
  return null;
}
