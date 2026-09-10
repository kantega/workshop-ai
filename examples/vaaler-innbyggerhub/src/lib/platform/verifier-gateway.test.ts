import { describe, expect, it } from "vitest";
import { normalizeClaims, toSharingResult } from "./verifier-gateway";

describe("toSharingResult", () => {
  it("mapper presentasjoner per queryId og skiller ut ukjente", () => {
    const result = toSharingResult({
      sessionId: "s",
      status: "VERIFIED",
      presentations: [
        { queryId: "pid", format: "dc+sd-jwt", credentialType: "PID", issuer: "https://issuer", claims: { given_name: "Kari", birthdate: "1985-04-12" } },
        { queryId: "inntekt", format: "dc+sd-jwt", credentialType: "Inntekt", issuer: null, claims: { kvalifisert: "true" } },
        { queryId: "noe-annet", format: "dc+sd-jwt", credentialType: null, issuer: null, claims: {} },
      ],
    });
    expect(result.status).toBe("VERIFIED");
    if (result.status !== "VERIFIED") return;
    expect(result.credentials.map((c) => c.queryId)).toEqual(["pid", "inntekt"]);
    expect(result.credentials[1]!.claims.kvalifisert).toBe(true);
    expect(result.unknownQueryIds).toEqual(["noe-annet"]);
  });

  it("null presentations (OUTCOME_ONLY) gir tom liste, ikke krasj", () => {
    const result = toSharingResult({ sessionId: "s", status: "VERIFIED", presentations: null });
    expect(result).toEqual({ status: "VERIFIED", credentials: [], unknownQueryIds: [] });
  });

  it("REJECTED bærer failures", () => {
    const result = toSharingResult({ sessionId: "s", status: "REJECTED", failures: [{ queryId: "pid", check: "SIGNATURE", detail: null }] });
    expect(result).toEqual({ status: "REJECTED", failures: [{ queryId: "pid", check: "SIGNATURE", detail: null }] });
  });
});

describe("normalizeClaims", () => {
  it("beholder primitiver og serialiserer objekter", () => {
    expect(normalizeClaims({ a: 1, b: "x", c: false, d: null, e: { nested: true } })).toEqual({
      a: 1, b: "x", c: false, d: null, e: '{"nested":true}',
    });
  });
});
