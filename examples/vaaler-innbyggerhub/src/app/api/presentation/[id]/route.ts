// Polles av klienten. Når sesjonen er avgjort hentes resultatet én gang og bevisene legges i
// hubbens økt, så /tjenester kan regne på dem.

import { NextResponse } from "next/server";
import { gateway, TERMINAL_PHASES } from "@/lib/platform";
import { ensureSession, mergeCredentials } from "@/lib/session";
import { platformFailure } from "@/lib/platform/http";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }): Promise<NextResponse> {
  const { id } = await context.params;
  const session = await ensureSession();
  if (session.sharingSessionId !== id) return NextResponse.json({ error: "Sesjonen tilhører ikke denne økten" }, { status: 403 });

  try {
    const platform = gateway();
    const phase = await platform.phase(id);
    if (!TERMINAL_PHASES.has(phase)) return NextResponse.json({ phase });

    const result = await platform.result(id);
    if (result.status === "VERIFIED") {
      mergeCredentials(session, result.credentials);
      if (result.unknownQueryIds.length > 0) console.warn("[platform] Ukjente query-id-er i svaret:", result.unknownQueryIds);
      return NextResponse.json({ phase, status: "VERIFIED", shared: result.credentials.map((c) => c.queryId) });
    }
    if (result.status === "REJECTED") return NextResponse.json({ phase, status: "REJECTED", failures: result.failures });
    return NextResponse.json({ phase, status: "EXPIRED" });
  } catch (error) {
    return platformFailure(error);
  }
}
