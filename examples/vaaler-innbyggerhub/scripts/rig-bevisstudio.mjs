// Rigger de tre tingene hubben trenger i Bevis Studio, idempotent, uten å starte hubben:
//   1. bevistypene i src/lib/catalog/credentials.ts
//   2. én forhåndsautorisert utstedelsesregel per bevistype (deployet, så vct finnes)
//   3. fremvisningsregelen «Våler innbyggerhub» med alle bevis som valgfrie credential_sets
//
// Samme kall som verifier-gateway.ts gjør ved første bruk. Kjør mot en lokal rigg i
// dev-unauthenticated (ingen token), eller sett EIDAS_CLIENT_ID/EIDAS_CLIENT_SECRET for testmiljøet.
//
//   STUDIO_URL=http://localhost:8060 node scripts/rig-bevisstudio.mjs
//
// Skriver ut utstedelsesregel-id-ene, så du kan lage tilbud (QR) til lommeboka med
//   POST /v1/issuance-rules/<id>/test-issuances

import { CREDENTIALS } from "../src/lib/catalog/credentials.ts";

const STUDIO = (process.env.STUDIO_URL ?? "http://localhost:8060").replace(/\/+$/, "");
const RULE_NAME = process.env.VERIFICATION_RULE_NAME ?? "Våler innbyggerhub";
const CLIENT_ID = process.env.EIDAS_CLIENT_ID;
const CLIENT_SECRET = process.env.EIDAS_CLIENT_SECRET;

let token = null;
if (CLIENT_ID && CLIENT_SECRET) {
  const meta = await fetch(`${STUDIO}/.well-known/oauth-authorization-server`).then((r) => r.json());
  const res = await fetch(meta.token_endpoint, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${encodeURIComponent(CLIENT_ID)}:${encodeURIComponent(CLIENT_SECRET)}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "client_credentials",
      resource: "api://bevisstudio",
      scope: "issuers:read verifiers:read credential-types:read credential-types:write issuance-rules:read issuance-rules:write verification-rules:read verification-rules:write access-certificates:read access-certificates:write deploy:read deploy:write issuance:write",
    }),
  });
  if (!res.ok) throw new Error(`Token: ${res.status} ${await res.text()}`);
  token = (await res.json()).access_token;
}

async function api(path, init = {}) {
  const headers = { ...(init.body ? { "Content-Type": "application/json" } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}) };
  const res = await fetch(`${STUDIO}${path}`, { ...init, headers });
  const text = await res.text();
  if (!res.ok) throw new Error(`${init.method ?? "GET"} ${path} → ${res.status}: ${text}`);
  return text ? JSON.parse(text) : {};
}

const [issuer] = await api("/v1/issuers");
const [verifier] = await api("/v1/verifiers");
if (!issuer || !verifier) throw new Error("Organisasjonen mangler utsteder eller verifier i Bevis Studio.");

const types = await api("/v1/credential-types");
const issuanceRules = await api("/v1/issuance-rules");
const summary = [];
const vctByQueryId = {};

for (const c of CREDENTIALS) {
  const typeId =
    types.find((t) => t.name === c.studioName)?.id ??
    (await api("/v1/credential-types", { method: "POST", body: JSON.stringify({ name: c.studioName, claims: c.schema }) })).id;
  const ruleId =
    issuanceRules.find((r) => r.credentialTypeId === typeId)?.id ??
    (
      await api("/v1/issuance-rules", {
        method: "POST",
        body: JSON.stringify({ issuerId: issuer.id, credentialTypeId: typeId, name: `${c.studioName}, forhåndsautorisert`, method: "PRE_AUTHORIZED_CODE" }),
      })
    ).id;
  const deployment = await api(`/v1/issuance-rules/${ruleId}/deployment`, { method: "PUT" });
  vctByQueryId[c.queryId] = deployment.deployed.vct;
  summary.push({ queryId: c.queryId, bevistype: c.studioName, typeId, issuanceRuleId: ruleId, vct: deployment.deployed.vct });
}

const certificates = await api("/v1/access-certificates");
if (!certificates.some((x) => x.verifierId === verifier.id && x.status === "ACTIVE")) {
  await api(`/v1/verifiers/${verifier.id}/access-certificates/platform-default`, { method: "POST" });
}

const query = {
  credentials: CREDENTIALS.map((c) => ({
    id: c.queryId,
    format: "dc+sd-jwt",
    meta: { vct_values: [vctByQueryId[c.queryId]] },
    claims: c.requestedClaims.map((claim) => ({ path: [claim] })),
  })),
  credential_sets: CREDENTIALS.map((c) => ({ options: [[c.queryId]], required: false })),
};
const rules = await api("/v1/verification-rules");
const existing = rules.find((r) => r.name === RULE_NAME);
const verificationRuleId = existing
  ? (await api(`/v1/verification-rules/${existing.id}`, { method: "PATCH", body: JSON.stringify({ query }) }), existing.id)
  : (await api("/v1/verification-rules", { method: "POST", body: JSON.stringify({ verifierId: verifier.id, name: RULE_NAME, query }) })).id;

console.table(summary);
console.log(`Fremvisningsregel «${RULE_NAME}»: ${verificationRuleId}`);
console.log(`\nSett i .env.local:\n  VERIFICATION_RULE_ID=${verificationRuleId}`);
