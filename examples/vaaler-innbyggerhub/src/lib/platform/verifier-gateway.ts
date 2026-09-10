// Ekte gateway: Bevis Studio for oppsett av fremvisningsregelen, verifieren for selve
// fremvisningen. Bare API-er en integrasjonspartner også har.
//
// Regelen rigges idempotent første gang den trengs: bevistypene slås opp (eller opprettes) i
// studio, `vct` hentes fra utstedelsesregelens deployment, og DCQL-en bygges fra katalogen.
// Sett VERIFICATION_RULE_ID for å hoppe over alt dette og bruke en regel laget i studio.

import { CREDENTIALS, isCredentialQueryId, type Claims, type PresentedCredential } from "@/lib/catalog/credentials";
import type { PlatformConfig } from "./config";
import { buildDcql, sameQuery, type DcqlQuery } from "./dcql";
import { PlatformClient } from "./studio-client";
import {
  type PresentationGateway,
  type SharingPhase,
  type SharingResult,
  type StartOptions,
  type StartedSharing,
  type VctByQueryId,
} from "./types";

type Row = { id: string; name?: string; [key: string]: unknown };

type VerifierResult = {
  sessionId: string;
  status: "VERIFIED" | "REJECTED" | "EXPIRED";
  presentations?:
    | { queryId: string | null; format: string; credentialType: string | null; issuer: string | null; claims: Record<string, unknown> }[]
    | null;
  failures?: { queryId: string | null; check: string | null; detail: string | null }[];
};

declare global {
  var __vaalerRuleId: string | undefined;
  var __vaalerIssuanceRules: Map<string, string> | undefined;
}

export class VerifierGateway implements PresentationGateway {
  readonly mode = "verifier" as const;
  private readonly client: PlatformClient;

  constructor(private readonly config: PlatformConfig) {
    this.client = new PlatformClient(config);
  }

  async start(options: StartOptions = {}): Promise<StartedSharing> {
    const ruleId = await this.ensureRule();
    const started = await this.client.verifier<{ id: string; clientId: string; requestUri: string; expiresAt: string }>(
      "/v1/presentation-sessions",
      {
        method: "POST",
        body: JSON.stringify(options.continuationUri ? { ruleId, continuationUri: options.continuationUri } : { ruleId }),
      },
    );
    return {
      sessionId: started.id,
      walletUri:
        `openid4vp://?client_id=${encodeURIComponent(started.clientId)}` +
        `&request_uri=${encodeURIComponent(started.requestUri)}`,
      expiresAt: started.expiresAt,
    };
  }

  async phase(sessionId: string): Promise<SharingPhase> {
    const session = await this.client.verifier<{ phase: SharingPhase }>(`/v1/presentation-sessions/${sessionId}`);
    return session.phase;
  }

  async result(sessionId: string, responseCode?: string): Promise<SharingResult> {
    const query = responseCode ? `?response_code=${encodeURIComponent(responseCode)}` : "";
    const result = await this.client.verifier<VerifierResult>(`/v1/presentation-sessions/${sessionId}/result${query}`);
    return toSharingResult(result);
  }

  /**
   * Demo-hjelper: utsteder et testbevis av en katalogtype til en lommebok, forhåndsautorisert.
   * Returnerer tilbudslenken (QR). Krever at bevistypen er rigget (skjer i ensureRule).
   */
  async issueTestCredential(queryId: string, claims: Claims): Promise<{ offerUri: string }> {
    await this.ensureRule();
    const issuanceRuleId = globalThis.__vaalerIssuanceRules?.get(queryId);
    if (!issuanceRuleId) throw new Error(`Ingen utstedelsesregel for «${queryId}». Er bevistypen rigget?`);
    return this.client.studio(`/v1/issuance-rules/${issuanceRuleId}/test-issuances`, {
      method: "POST",
      body: JSON.stringify({ format: "dc+sd-jwt", claims: stringifyClaims(claims) }),
    });
  }

  private async ensureRule(): Promise<string> {
    if (this.config.verificationRuleId) return this.config.verificationRuleId;
    if (globalThis.__vaalerRuleId) return globalThis.__vaalerRuleId;

    const vctByQueryId = await this.ensureCredentialTypes();
    const { query, omitted } = buildDcql(vctByQueryId);
    if (omitted.length > 0) console.warn(`[platform] Bevis uten vct, utelatt fra regelen: ${omitted.join(", ")}`);
    if (query.credentials.length === 0) throw new Error("Ingen bevistyper har vct. Kan ikke lage fremvisningsregel.");

    const verifiers = await this.client.studio<Row[]>("/v1/verifiers");
    const verifier = verifiers[0];
    if (!verifier) throw new Error("Organisasjonen har ingen verifier i Bevis Studio.");

    const certificates = await this.client.studio<Row[]>("/v1/access-certificates");
    if (!certificates.some((c) => c.verifierId === verifier.id && c.status === "ACTIVE")) {
      await this.client.studio(`/v1/verifiers/${verifier.id}/access-certificates/platform-default`, { method: "POST" });
    }

    const rules = await this.client.studio<(Row & { query?: DcqlQuery })[]>("/v1/verification-rules");
    const existing = rules.find((rule) => rule.name === this.config.verificationRuleName);
    let ruleId: string;
    if (existing) {
      ruleId = existing.id;
      if (!existing.query || !sameQuery(existing.query, query)) {
        await this.client.studio(`/v1/verification-rules/${ruleId}`, { method: "PATCH", body: JSON.stringify({ query }) });
        console.info(`[platform] Oppdaterte fremvisningsregelen «${this.config.verificationRuleName}»`);
      }
    } else {
      const created = await this.client.studio<Row>("/v1/verification-rules", {
        method: "POST",
        body: JSON.stringify({ verifierId: verifier.id, name: this.config.verificationRuleName, query }),
      });
      ruleId = created.id;
      console.info(`[platform] Opprettet fremvisningsregelen «${this.config.verificationRuleName}» (${ruleId})`);
    }
    globalThis.__vaalerRuleId = ruleId;
    return ruleId;
  }

  /** Finner eller oppretter bevistypene, og henter vct fra deployment. Idempotent. */
  private async ensureCredentialTypes(): Promise<VctByQueryId> {
    const issuers = await this.client.studio<Row[]>("/v1/issuers");
    const issuer = issuers[0];
    if (!issuer) throw new Error("Organisasjonen har ingen utsteder i Bevis Studio.");

    const types = await this.client.studio<Row[]>("/v1/credential-types");
    const issuanceRules = await this.client.studio<Row[]>("/v1/issuance-rules");
    const issuanceRuleByQuery = (globalThis.__vaalerIssuanceRules ??= new Map());
    const vctByQueryId: VctByQueryId = {};

    for (const credential of CREDENTIALS) {
      const typeId =
        types.find((type) => type.name === credential.studioName)?.id ??
        (
          await this.client.studio<Row>("/v1/credential-types", {
            method: "POST",
            body: JSON.stringify({ name: credential.studioName, claims: credential.schema }),
          })
        ).id;

      const issuanceRuleId =
        issuanceRules.find((rule) => rule.credentialTypeId === typeId)?.id ??
        (
          await this.client.studio<Row>("/v1/issuance-rules", {
            method: "POST",
            body: JSON.stringify({
              issuerId: issuer.id,
              credentialTypeId: typeId,
              name: `${credential.studioName}, forhåndsautorisert`,
              method: "PRE_AUTHORIZED_CODE",
            }),
          })
        ).id;
      issuanceRuleByQuery.set(credential.queryId, issuanceRuleId);

      const deployment = await this.client.studio<{ deployed: { vct: string } }>(
        `/v1/issuance-rules/${issuanceRuleId}/deployment`,
        { method: "PUT" },
      );
      vctByQueryId[credential.queryId] = deployment.deployed.vct;
    }
    return vctByQueryId;
  }
}

export function toSharingResult(result: VerifierResult): SharingResult {
  switch (result.status) {
    case "VERIFIED": {
      const credentials: PresentedCredential[] = [];
      const unknownQueryIds: string[] = [];
      for (const presentation of result.presentations ?? []) {
        if (presentation.queryId && isCredentialQueryId(presentation.queryId)) {
          credentials.push({ queryId: presentation.queryId, issuer: presentation.issuer, claims: normalizeClaims(presentation.claims) });
        } else {
          unknownQueryIds.push(presentation.queryId ?? "(uten id)");
        }
      }
      return { status: "VERIFIED", credentials, unknownQueryIds };
    }
    case "REJECTED":
      return { status: "REJECTED", failures: result.failures ?? [] };
    case "EXPIRED":
      return { status: "EXPIRED" };
  }
}

/** Verifieren gir JSON-verdier; katalogen jobber med primitiver. Booleans kan komme som tekst. */
export function normalizeClaims(raw: Record<string, unknown>): Claims {
  const claims: Claims = {};
  for (const [name, value] of Object.entries(raw)) {
    if (value === null || typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
      claims[name] = value === "true" ? true : value === "false" ? false : value;
    } else {
      claims[name] = JSON.stringify(value);
    }
  }
  return claims;
}

const stringifyClaims = (claims: Claims): Record<string, string> =>
  Object.fromEntries(Object.entries(claims).map(([name, value]) => [name, value === null ? "" : String(value)]));
