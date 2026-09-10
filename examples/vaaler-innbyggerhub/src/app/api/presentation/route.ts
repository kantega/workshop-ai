// Starter en deling: én verifier-sesjon med hubbens fremvisningsregel. Svaret er det klienten
// trenger for QR og polling, pluss (i mock-modus) hva testpersonens lommebok inneholder.

import { NextResponse } from "next/server";
import { CREDENTIAL_BY_ID } from "@/lib/catalog/credentials";
import { gateway, isSimulatable, readConfig } from "@/lib/platform";
import { platformFailure } from "@/lib/platform/http";
import { ensureSession } from "@/lib/session";
import { findTestPerson } from "@/lib/session/test-persons";

export async function POST(): Promise<NextResponse> {
  const session = await ensureSession();
  const person = findTestPerson(session.personId ?? undefined);
  if (!person) return NextResponse.json({ error: "Ikke logget inn" }, { status: 401 });

  const platform = gateway();
  try {
    const started = await platform.start({ continuationUri: `${readConfig().publicBaseUrl}/del-bevis/fortsett` });
    session.sharingSessionId = started.sessionId;
    return NextResponse.json({
      ...started,
      mode: platform.mode,
      demoWallet: isSimulatable(platform)
        ? person.wallet.map((entry) => ({ queryId: entry.queryId, label: CREDENTIAL_BY_ID[entry.queryId].label }))
        : null,
    });
  } catch (error) {
    return platformFailure(error);
  }
}

