import Link from "next/link";
import { CREDENTIALS } from "@/lib/catalog/credentials";
import { SERVICES } from "@/lib/catalog/services";
import { currentPerson, currentSession } from "@/lib/session";

export default async function Home() {
  const person = await currentPerson();
  const session = await currentSession();
  const shared = session?.credentials.length ?? 0;

  return (
    <div className="space-y-10">
      <section className="space-y-4">
        <h1 className="text-3xl font-semibold tracking-tight">Finn ut hva du har rett på, uten å fylle ut skjemaer</h1>
        <p className="max-w-2xl text-lg text-muted">
          Del bevisene du allerede har i den digitale lommeboka di. Hubben viser hvilke av kommunens
          tjenester du kan søke på med det samme, og hva som eventuelt mangler.
        </p>
        <div className="flex flex-wrap gap-3 pt-2">
          {person ? (
            <>
              <Link href={shared > 0 ? "/tjenester" : "/del-bevis"} className="btn-primary">
                {shared > 0 ? "Se tjenestene dine" : "Del bevis fra lommeboka"}
              </Link>
              {shared > 0 ? (
                <Link href="/del-bevis" className="btn-secondary">
                  Del flere bevis
                </Link>
              ) : null}
            </>
          ) : (
            <Link href="/logg-inn" className="btn-primary">
              Logg inn
            </Link>
          )}
        </div>
      </section>

      <section className="grid gap-6 md:grid-cols-3">
        <Step n={1} title="Logg inn" text="Med ID-porten. Her: velg en testperson." />
        <Step n={2} title="Del bevis" text="Skann QR-koden med lommeboka og velg hva du vil dele. Kommunen får bare det du godkjenner." />
        <Step n={3} title="Se tjenestene" text={`${SERVICES.length} tjenester sortert etter hva du kan søke på nå.`} />
      </section>

      <section className="card space-y-3">
        <h2 className="font-semibold">Bevis hubben kan bruke</h2>
        <ul className="grid gap-2 sm:grid-cols-2">
          {CREDENTIALS.map((credential) => (
            <li key={credential.queryId} className="text-sm">
              <span className="font-medium">{credential.label}</span>
              <span className="text-muted"> · {credential.description}</span>
            </li>
          ))}
        </ul>
        <p className="text-sm text-muted">
          Alle er valgfrie. Du velger selv i lommeboka hvilke du deler, og hubben regner på det som kom.
        </p>
      </section>
    </div>
  );
}

function Step({ n, title, text }: { n: number; title: string; text: string }) {
  return (
    <div className="card">
      <div className="mb-2 grid size-8 place-items-center rounded-full bg-brand-soft text-sm font-semibold text-brand">{n}</div>
      <h3 className="font-semibold">{title}</h3>
      <p className="text-sm text-muted">{text}</p>
    </div>
  );
}
