// Bare i verifier-modus: legger et av testpersonens bevis i en ekte lommebok, som QR-tilbud.
// Demo-hjelper så reisen kan kjøres ende til ende uten at noen først må rigge utstedelse.

import { NextResponse } from "next/server";
import { isCredentialQueryId } from "@/lib/catalog/credentials";
import { gateway } from "@/lib/platform";
import { VerifierGateway } from "@/lib/platform/verifier-gateway";
import { ensureSession } from "@/lib/session";
import { findTestPerson } from "@/lib/session/test-persons";
import { platformFailure } from "@/lib/platform/http";

export async function POST(request: Request): Promise<NextResponse> {
  const platform = gateway();
  if (!(platform instanceof VerifierGateway)) return NextResponse.json({ error: "Utstedelse finnes bare i verifier-modus" }, { status: 404 });

  const session = await ensureSession();
  const person = findTestPerson(session.personId ?? undefined);
  if (!person) return NextResponse.json({ error: "Ikke logget inn" }, { status: 401 });

  const body = (await request.json()) as { queryId?: string };
  const queryId = body.queryId;
  if (!queryId || !isCredentialQueryId(queryId)) return NextResponse.json({ error: "Ukjent bevis" }, { status: 400 });
  const entry = person.wallet.find((e) => e.queryId === queryId);
  if (!entry) return NextResponse.json({ error: `${person.name} har ikke dette beviset` }, { status: 404 });

  try {
    const offer = await platform.issueTestCredential(queryId, entry.claims);
    return NextResponse.json(offer);
  } catch (error) {
    return platformFailure(error);
  }
}
