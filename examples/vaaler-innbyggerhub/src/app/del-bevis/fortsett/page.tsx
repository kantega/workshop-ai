// Same-device-flyt: lommeboka sender nettleseren hit med en engangs `response_code`
// (OID4VP §8.2). Første resultatoppslag må bevise koden. Deretter er økten som en vanlig deling.

import Link from "next/link";
import { redirect } from "next/navigation";
import { gateway, type SharingResult } from "@/lib/platform";
import { currentSession, mergeCredentials } from "@/lib/session";

type Outcome = { kind: "result"; result: SharingResult } | { kind: "error"; message: string };

export default async function Continue({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const responseCode = typeof params.response_code === "string" ? params.response_code : undefined;
  const session = await currentSession();
  if (!session?.sharingSessionId) redirect("/del-bevis");

  const outcome = await fetchOutcome(session.sharingSessionId, responseCode);
  if (outcome.kind === "result" && outcome.result.status === "VERIFIED") {
    mergeCredentials(session, outcome.result.credentials);
    redirect("/tjenester");
  }

  return (
    <div className="card">
      <p className="font-medium">
        {outcome.kind === "error" ? "Klarte ikke å hente resultatet." : `Delingen ble ikke godkjent (${outcome.result.status}).`}
      </p>
      {outcome.kind === "error" ? <p className="text-sm text-muted">{outcome.message}</p> : null}
      <Link href="/del-bevis" className="btn-secondary mt-3">
        Prøv igjen
      </Link>
    </div>
  );
}

async function fetchOutcome(sessionId: string, responseCode: string | undefined): Promise<Outcome> {
  try {
    return { kind: "result", result: await gateway().result(sessionId, responseCode) };
  } catch (error) {
    return { kind: "error", message: error instanceof Error ? error.message : String(error) };
  }
}
