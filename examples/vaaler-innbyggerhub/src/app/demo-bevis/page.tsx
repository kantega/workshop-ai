import { redirect } from "next/navigation";
import { CREDENTIAL_BY_ID } from "@/lib/catalog/credentials";
import { readConfig } from "@/lib/platform";
import { currentPerson } from "@/lib/session";
import { IssueDemoCredential } from "@/components/IssueDemoCredential";

/** Bare i verifier-modus: legg testpersonens bevis i en ekte lommebok, som QR-tilbud. */
export default async function DemoCredentials() {
  if (readConfig().mode !== "verifier") redirect("/del-bevis");
  const person = await currentPerson();
  if (!person) redirect("/logg-inn");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Testbevis til lommeboka</h1>
        <p className="text-muted">
          Utstedes fra riggens utsteder, forhåndsautorisert. Skann med lommeboka, så ligger beviset der og kan deles
          på neste side.
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        {person.wallet.map((entry) => (
          <IssueDemoCredential key={entry.queryId} queryId={entry.queryId} label={CREDENTIAL_BY_ID[entry.queryId].label} claims={entry.claims} />
        ))}
      </div>
    </div>
  );
}
