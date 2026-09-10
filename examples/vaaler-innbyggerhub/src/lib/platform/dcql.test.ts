import { describe, expect, it } from "vitest";
import { buildDcql } from "./dcql";

describe("buildDcql", () => {
  it("ett valgfritt credential_set per kjent bevis, og bare de med vct", () => {
    const { query, omitted } = buildDcql({ pid: "https://issuer/vct/pid", inntekt: "https://issuer/vct/inntekt" });
    expect(query.credentials.map((c) => c.id)).toEqual(["pid", "inntekt"]);
    expect(query.credential_sets).toEqual([
      { options: [["pid"]], required: false },
      { options: [["inntekt"]], required: false },
    ]);
    expect(omitted).toEqual(["legeerklaering", "foererkort", "elevbevis"]);
  });

  it("ber bare om claimene katalogen lister, aldri beløp", () => {
    const { query } = buildDcql({ inntekt: "vct" });
    const paths = query.credentials[0]!.claims.map((c) => c.path[0]);
    expect(paths).toContain("kvalifisert");
    expect(paths).not.toContain("beregningsbeloep");
  });
});
