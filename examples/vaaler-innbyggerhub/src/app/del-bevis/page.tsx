import Link from "next/link";
import { redirect } from "next/navigation";
import { CREDENTIAL_BY_ID } from "@/lib/catalog/credentials";
import { readConfig } from "@/lib/platform";
import { currentPerson, currentSession } from "@/lib/session";
import { ShareCredentials } from "@/components/ShareCredentials";

export default async function ShareCredentialsPage() {
  const person = await currentPerson();
  if (!person) redirect("/logg-inn");
  const session = await currentSession();
  const already = session?.credentials ?? [];
  const mode = readConfig().mode;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Del bevis fra lommeboka</h1>
        <p className="text-muted">
          Skann koden med lommeboka di. Du får se hva kommunen spør om, og velger selv hva du deler.
          Alt er valgfritt.
        </p>
      </div>

      {already.length > 0 ? (
        <div className="rounded-md border border-line bg-brand-soft/60 px-4 py-3 text-sm">
          Du har allerede delt {already.map((c) => CREDENTIAL_BY_ID[c.queryId].label).join(", ")}.{" "}
          Nye bevis legges til.{" "}
          <Link href="/tjenester" className="font-medium text-brand underline">
            Gå til tjenestene
          </Link>
        </div>
      ) : null}

      <ShareCredentials />

      {mode === "verifier" ? (
        <p className="text-sm text-muted">
          Tom lommebok?{" "}
          <Link href="/demo-bevis" className="text-brand underline">
            Legg testbevisene til {person.name.split(" ")[0]} i lommeboka først.
          </Link>
        </p>
      ) : null}
    </div>
  );
}
