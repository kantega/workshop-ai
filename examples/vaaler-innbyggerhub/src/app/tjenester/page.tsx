import Link from "next/link";
import { redirect } from "next/navigation";
import { CREDENTIAL_BY_ID, type PresentedCredential } from "@/lib/catalog/credentials";
import { assessServices, sortForDisplay, type ServiceAssessment } from "@/lib/catalog/eligibility";
import { CATEGORY_LABELS } from "@/lib/catalog/services";
import { currentPerson, currentSession } from "@/lib/session";
import { forgetCredentials } from "@/lib/session/actions";

export default async function Services() {
  const person = await currentPerson();
  if (!person) redirect("/logg-inn");
  const session = await currentSession();
  const credentials = session?.credentials ?? [];
  if (credentials.length === 0) redirect("/del-bevis");

  const assessments = sortForDisplay(assessServices(credentials));
  const ready = assessments.filter((a) => a.outcome === "ready");
  const missing = assessments.filter((a) => a.outcome === "missing");
  const ineligible = assessments.filter((a) => a.outcome === "ineligible");

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Tjenester for deg, {person.name.split(" ")[0]}</h1>
          <p className="text-muted">Basert på {credentials.length} bevis du delte.</p>
        </div>
        <div className="flex gap-2">
          <Link href="/del-bevis" className="btn-secondary">
            Del flere bevis
          </Link>
          <form action={forgetCredentials}>
            <button type="submit" className="btn-secondary">
              Glem delte bevis
            </button>
          </form>
        </div>
      </div>

      <section className="card">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted">Det du delte</h2>
        <ul className="grid gap-3 sm:grid-cols-2">
          {credentials.map((credential) => (
            <SharedCredential key={credential.queryId} credential={credential} />
          ))}
        </ul>
      </section>

      <Group title="Du kan søke nå" count={ready.length} tone="ok" empty="Ingen tjenester er klare med det du har delt ennå.">
        {ready.map((assessment) => (
          <ServiceCard key={assessment.service.id} assessment={assessment} />
        ))}
      </Group>

      <Group title="Nesten i mål, del litt til" count={missing.length} tone="warn" empty="">
        {missing.map((assessment) => (
          <ServiceCard key={assessment.service.id} assessment={assessment} />
        ))}
      </Group>

      <Group title="Ikke aktuelt for deg" count={ineligible.length} tone="off" empty="">
        {ineligible.map((assessment) => (
          <ServiceCard key={assessment.service.id} assessment={assessment} />
        ))}
      </Group>
    </div>
  );
}

function SharedCredential({ credential }: { credential: PresentedCredential }) {
  const definition = CREDENTIAL_BY_ID[credential.queryId];
  return (
    <li className="rounded-md border border-line bg-bg p-3">
      <div className="font-medium">{definition.label}</div>
      <dl className="mt-1 grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-xs text-muted">
        {definition.requestedClaims.map((name) => (
          <ClaimRow key={name} name={name} value={credential.claims[name]} />
        ))}
      </dl>
    </li>
  );
}

function ClaimRow({ name, value }: { name: string; value: PresentedCredential["claims"][string] | undefined }) {
  const shown = value === undefined || value === null ? "–" : value === true ? "ja" : value === false ? "nei" : String(value);
  return (
    <>
      <dt className="font-mono">{name}</dt>
      <dd>{shown}</dd>
    </>
  );
}

function Group({
  title,
  count,
  tone,
  empty,
  children,
}: {
  title: string;
  count: number;
  tone: "ok" | "warn" | "off";
  empty: string;
  children: React.ReactNode;
}) {
  if (count === 0 && !empty) return null;
  const badge = tone === "ok" ? "bg-ok-soft text-ok" : tone === "warn" ? "bg-warn-soft text-warn" : "bg-off-soft text-off";
  return (
    <section className="space-y-3">
      <h2 className="flex items-center gap-2 text-lg font-semibold">
        {title}
        <span className={`rounded-full px-2 py-0.5 text-xs ${badge}`}>{count}</span>
      </h2>
      {count === 0 ? <p className="text-sm text-muted">{empty}</p> : <div className="grid gap-3 sm:grid-cols-2">{children}</div>}
    </section>
  );
}

function ServiceCard({ assessment }: { assessment: ServiceAssessment }) {
  const { service, outcome } = assessment;
  const failed = assessment.requirements.filter((r) => r.state === "failed");
  return (
    <article className={`card flex flex-col gap-2 ${outcome === "ineligible" ? "opacity-70" : ""}`}>
      <div className="text-xs uppercase tracking-wide text-muted">{CATEGORY_LABELS[service.category]}</div>
      <h3 className="font-semibold">{service.name}</h3>
      <p className="text-sm text-muted">{service.summary}</p>
      <div className="mt-auto pt-2 text-sm">
        {outcome === "ready" ? (
          <a href={service.applyUrl} target="_blank" rel="noreferrer" className="btn-primary">
            Søk nå
          </a>
        ) : outcome === "missing" ? (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-warn">Mangler: {assessment.missingLabels.join(", ")}</span>
            <Link href="/del-bevis" className="text-brand underline">
              Del bevis
            </Link>
          </div>
        ) : (
          <ul className="text-off">
            {failed.map((requirement) => (
              <li key={requirement.credential}>{requirement.state === "failed" ? requirement.reason : null}</li>
            ))}
          </ul>
        )}
      </div>
    </article>
  );
}
