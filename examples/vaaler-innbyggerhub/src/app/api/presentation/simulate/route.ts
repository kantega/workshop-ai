// Bare i mock-modus: «lommeboka» svarer med utvalgte bevis fra testpersonens lommebok.

import { NextResponse } from "next/server";
import { isCredentialQueryId, type PresentedCredential } from "@/lib/catalog/credentials";
import { gateway, isSimulatable } from "@/lib/platform";
import { ensureSession } from "@/lib/session";
import { findTestPerson } from "@/lib/session/test-persons";

export async function POST(request: Request): Promise<NextResponse> {
  const platform = gateway();
  if (!isSimulatable(platform)) return NextResponse.json({ error: "Simulering finnes bare i mock-modus" }, { status: 404 });

  const session = await ensureSession();
  const person = findTestPerson(session.personId ?? undefined);
  if (!person) return NextResponse.json({ error: "Ikke logget inn" }, { status: 401 });

  const body = (await request.json()) as { sessionId?: string; queryIds?: string[] };
  if (body.sessionId !== session.sharingSessionId) return NextResponse.json({ error: "Feil sesjon" }, { status: 403 });

  const chosen = new Set((body.queryIds ?? []).filter(isCredentialQueryId));
  const credentials: PresentedCredential[] = person.wallet
    .filter((entry) => chosen.has(entry.queryId))
    .map((entry) => ({ queryId: entry.queryId, issuer: "mock://vaaler-demo", claims: entry.claims }));

  await platform.simulate(session.sharingSessionId, credentials);
  return NextResponse.json({ ok: true, shared: credentials.map((c) => c.queryId) });
}
