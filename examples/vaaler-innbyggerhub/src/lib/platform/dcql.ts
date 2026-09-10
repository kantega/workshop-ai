// Bygger fremvisningsregelens DCQL-spørring fra bevis-katalogen.
//
// Hvert bevis er én credential query og ligger i sitt eget credential_set med required: false.
// Da kan innbyggeren dele akkurat det hun har, og verifieren godkjenner uansett hvor mange som
// kom. Hubben leser `presentations[].queryId` etterpå.

import { CREDENTIALS, type CredentialDefinition } from "@/lib/catalog/credentials";
import type { VctByQueryId } from "./types";

export type DcqlQuery = {
  credentials: {
    id: string;
    format: "dc+sd-jwt";
    meta: { vct_values: string[] };
    claims: { path: string[] }[];
  }[];
  credential_sets: { options: string[][]; required: boolean }[];
};

/**
 * Bevis uten kjent `vct` utelates: en query uten vct_values ville matchet alt, og en med feil
 * vct matcher ingenting. Returnerer også hvilke som ble utelatt, så det kan logges.
 */
export function buildDcql(
  vctByQueryId: VctByQueryId,
  catalog: readonly CredentialDefinition[] = CREDENTIALS,
): { query: DcqlQuery; omitted: string[] } {
  const included = catalog.filter((credential) => vctByQueryId[credential.queryId]);
  const omitted = catalog.filter((credential) => !vctByQueryId[credential.queryId]).map((c) => c.queryId);
  return {
    query: {
      credentials: included.map((credential) => ({
        id: credential.queryId,
        format: "dc+sd-jwt",
        meta: { vct_values: [vctByQueryId[credential.queryId]!] },
        claims: credential.requestedClaims.map((claim) => ({ path: [claim] })),
      })),
      credential_sets: included.map((credential) => ({ options: [[credential.queryId]], required: false })),
    },
    omitted,
  };
}

/** Sammenligner en lagret regel med det katalogen ville bygget, så vi vet om regelen må oppdateres. */
export function sameQuery(a: DcqlQuery, b: DcqlQuery): boolean {
  return JSON.stringify(normalize(a)) === JSON.stringify(normalize(b));
}

function normalize(query: DcqlQuery) {
  return {
    credentials: [...query.credentials]
      .sort((x, y) => x.id.localeCompare(y.id))
      .map((c) => ({ id: c.id, vct: [...c.meta.vct_values].sort(), claims: c.claims.map((x) => x.path.join(".")).sort() })),
    sets: [...query.credential_sets].map((s) => ({ options: s.options.map((o) => [...o].sort()), required: s.required })),
  };
}
