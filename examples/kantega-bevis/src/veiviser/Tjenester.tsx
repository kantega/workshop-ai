import { useMemo, useState } from "react";
import { assess, CATEGORY_LABELS, claimText, CREDENTIAL_BY_ID, PACKAGE_LABELS, type Assessment, type Check, type Package, type PresentedCredential } from "../catalog";
import { firstName } from "./presentation";

/**
 * Skjerm 2: forslagene. Tre grupper ut fra bevisene som kom: kan søke nå, mangler bevis, ikke
 * aktuelt. Innbyggeren huker av det hun vil søke på og sender samlet.
 */
export function Tjenester({
  credentials,
  onApply,
  onShareMore,
  onForget,
}: {
  credentials: readonly PresentedCredential[];
  onApply: (chosen: Assessment[]) => void;
  onShareMore: () => void;
  onForget: () => void;
}) {
  const assessments = useMemo(() => assess(credentials), [credentials]);
  const ready = assessments.filter((a) => a.outcome === "ready");
  const missing = assessments.filter((a) => a.outcome === "missing");
  const ineligible = assessments.filter((a) => a.outcome === "ineligible");
  // Pakker: klare tjenester som deler bevis, vist samlet og forhåndsavkrysset.
  const bundles = useMemo(() => {
    const byPackage = new Map<Package, Assessment[]>();
    for (const assessment of ready) {
      const pkg = assessment.service.package;
      if (pkg) byPackage.set(pkg, [...(byPackage.get(pkg) ?? []), assessment]);
    }
    return [...byPackage.entries()].filter(([, members]) => members.length >= 2);
  }, [ready]);
  const bundled = new Set(bundles.flatMap(([, members]) => members.map((a) => a.service.id)));
  const loose = ready.filter((a) => !bundled.has(a.service.id));
  const [chosen, setChosen] = useState<Set<string>>(
    () => new Set(bundled.size > 0 ? [...bundled] : ready.slice(0, 1).map((a) => a.service.id)),
  );
  const name = firstName(credentials);

  const toggle = (id: string) =>
    setChosen((previous) => {
      const next = new Set(previous);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const chosenAssessments = ready.filter((a) => chosen.has(a.service.id));

  return (
    <main>
      <section className="vk-band">
        <div className="wrap">
          <span className="pill pill-ok">✓ Bevisene er verifisert</span>
          <h1>{name ? `Hei ${name}, dette kan du søke på` : "Dette kan du søke på"}</h1>
          <p className="lead">
            Forslagene er regnet ut fra bevisene du delte. Ingenting er sendt til kommunen ennå. Velg tjenestene du vil søke
            på, så sender vi søknadene samlet.
          </p>
          <ul className="vk-summary" aria-label="Oppsummering">
            <li className="ok">
              <a href="#klar">
                <strong>{ready.length}</strong> kan du søke på nå
              </a>
            </li>
            <li className="warn">
              <a href="#mangler">
                <strong>{missing.length}</strong> mangler et bevis
              </a>
            </li>
            <li className="off">
              <a href="#ikke-rett">
                <strong>{ineligible.length}</strong> har du ikke rett på
              </a>
            </li>
          </ul>
          <div className="vk-shared">
            <span className="muted">Du delte:</span>
            {credentials.map((credential) => (
              <span key={credential.queryId} className="vk-chip">
                <span className="check">✓</span> {chipText(credential)}
              </span>
            ))}
            <button className="btn-link" onClick={onShareMore}>
              Del flere bevis
            </button>
            <span className="muted">·</span>
            <button className="btn-link" onClick={onForget}>
              Glem det jeg delte
            </button>
          </div>
        </div>
      </section>

      <section className="wrap vk-groups">
        <section className="vk-group" id="klar">
          <div className="vk-group-title">
            <h2>Du kan søke på disse nå</h2>
            <span className="pill pill-ok">{ready.length}</span>
          </div>
          {ready.length === 0 && <p className="muted">Ingen tjenester er klare med det du har delt ennå. Del ett bevis til, så finner vi noe.</p>}
          {bundles.map(([pkg, members]) => (
            <div key={pkg} className="vk-bundle">
              <div className="vk-bundle-head">
                <div>
                  <span className="eyebrow">Søk samlet</span>
                  <h3>{PACKAGE_LABELS[pkg].name}</h3>
                  <p className="muted small">
                    {members.length} tjenester på de samme bevisene. {PACKAGE_LABELS[pkg].why}
                  </p>
                </div>
                <button
                  className="btn-link"
                  onClick={() =>
                    setChosen((previous) => {
                      const next = new Set(previous);
                      const all = members.every((a) => next.has(a.service.id));
                      for (const a of members) all ? next.delete(a.service.id) : next.add(a.service.id);
                      return next;
                    })
                  }
                >
                  {members.every((a) => chosen.has(a.service.id)) ? "Velg bort alle" : "Velg alle"}
                </button>
              </div>
              <div className="vk-grid-2">
                {members.map((assessment) => (
                  <ServiceCard key={assessment.service.id} assessment={assessment} selected={chosen.has(assessment.service.id)} onToggle={() => toggle(assessment.service.id)} />
                ))}
              </div>
            </div>
          ))}
          {loose.length > 0 && (
            <div className="vk-grid-2">
              {loose.map((assessment) => (
                <ServiceCard key={assessment.service.id} assessment={assessment} selected={chosen.has(assessment.service.id)} onToggle={() => toggle(assessment.service.id)} />
              ))}
            </div>
          )}
        </section>
        <Group id="mangler" title="Nesten i mål, del ett bevis til" count={missing.length} tone="warn" intro="Disse kan du søke på hvis du deler ett bevis til fra lommeboka. Vi har ikke bedt om noe du ikke har.">
          {missing.map((assessment) => (
            <ServiceCard key={assessment.service.id} assessment={assessment} onShareMore={onShareMore} />
          ))}
        </Group>
        <Group
          id="ikke-rett"
          title="Dette har du ikke rett på"
          count={ineligible.length}
          tone="off"
          intro="Ut fra det bevisene dine sier. Vi viser hvilken opplysning som avgjorde det, så du kan se om noe er feil eller har endret seg."
          empty="Ingen av bevisene dine utelukker noe. Alt du ikke kan søke på nå, mangler bare et bevis."
        >
          {ineligible.map((assessment) => (
            <ServiceCard key={assessment.service.id} assessment={assessment} />
          ))}
        </Group>
      </section>

      <div className="vk-bar">
        <div className="wrap">
          <div>
            <strong>
              {chosenAssessments.length === 0 ? "Ingen tjenester valgt" : `${chosenAssessments.length} ${chosenAssessments.length === 1 ? "tjeneste" : "tjenester"} valgt`}
            </strong>
            <span className="small">{chosenAssessments.length === 0 ? "Huk av det du vil søke på" : "Sendes samlet, med bevisene som vedlegg"}</span>
          </div>
          <div className="vk-bar-actions">
            <button className="btn btn-ghost" onClick={() => setChosen(new Set())} disabled={chosenAssessments.length === 0}>
              Nullstill
            </button>
            <button className="btn btn-accent" onClick={() => onApply(chosenAssessments)} disabled={chosenAssessments.length === 0}>
              Søk om valgte →
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}

function chipText(credential: PresentedCredential): string {
  const label = CREDENTIAL_BY_ID[credential.queryId].label;
  const c = credential.claims;
  switch (credential.queryId) {
    case "pid": {
      const year = claimText(c.birthdate).slice(0, 4);
      return `${label} · ${[claimText(c.given_name), claimText(c.family_name)].filter(Boolean).join(" ")}${year ? `, f. ${year}` : ""}${c.resident_municipality ? `, ${claimText(c.resident_municipality)}` : ""}`;
    }
    case "barn":
      return `${label} · ${claimText(c.antall_barn)} barn`;
    case "inntektsbekreftelse":
      return `${label} · ${claimText(c.kvalifisert).toLowerCase() === "ja" ? "kvalifisert" : "ikke kvalifisert"} ${claimText(c.inntektsaar)}`.trim();
    case "legeerklaering":
      return `${label} · gyldig til ${claimText(c.gyldig_til)}`;
    case "foererkort":
      return `${label} · klasse ${claimText(c.klasser)}`;
    case "elevbevis":
      return `${label} · ${claimText(c.skole)}`;
    case "studentbevis":
      return `${label} · ${claimText(c.laerested)}`;
    case "leiekontrakt":
      return `${label} · ${claimText(c.maanedlig_husleie)} kr/mnd`;
    case "felleskostnader":
      return `${label} · ${claimText(c.maanedlig_beloep)} kr/mnd`;
    case "boliglaan":
      return `${label} · ${claimText(c.maanedlig_terminbeloep)} kr/mnd`;
    case "eiendomsskatt":
      return `${label} · ${claimText(c.aarlig_eiendomsskatt)} kr/år`;
    case "tilpasset_bolig":
      return `${label} · ${claimText(c.adresse)}`;
  }
}

function Group({ id, title, count, tone, intro, empty, children }: { id: string; title: string; count: number; tone: "ok" | "warn" | "off"; intro?: string; empty?: string; children: React.ReactNode }) {
  if (count === 0 && !empty) return null;
  return (
    <section className="vk-group" id={id}>
      <div className="vk-group-title">
        <h2>{title}</h2>
        <span className={`pill pill-${tone}`}>{count}</span>
      </div>
      {intro && count > 0 && <p className="muted">{intro}</p>}
      {count === 0 ? <p className="muted">{empty}</p> : <div className="vk-grid-2">{children}</div>}
    </section>
  );
}

function ServiceCard({ assessment, selected, onToggle, onShareMore }: { assessment: Assessment; selected?: boolean; onToggle?: () => void; onShareMore?: () => void }) {
  const { service, outcome } = assessment;
  const selectable = outcome === "ready" && onToggle;
  const failed = assessment.checks.filter((check) => check.result === "failed");

  return (
    <article
      className={`card vk-service ${selected ? "selected" : ""} ${outcome === "ineligible" ? "ineligible" : ""} ${selectable ? "" : "static"}`}
      role={selectable ? "checkbox" : undefined}
      aria-checked={selectable ? !!selected : undefined}
      tabIndex={selectable ? 0 : undefined}
      onClick={selectable ? onToggle : undefined}
      onKeyDown={selectable ? (event) => { if (event.key === " " || event.key === "Enter") { event.preventDefault(); onToggle(); } } : undefined}
    >
      <span className={`vk-check ${selected ? "on" : ""} ${selectable ? "" : "disabled"}`} aria-hidden="true">
        {selected ? "✓" : ""}
      </span>
      <div className="vk-service-body">
        <span className="cat">
          {CATEGORY_LABELS[service.category]}
          {service.handledBy ? ` · behandles av ${service.handledBy}` : ""}
        </span>
        <h3>{service.name}</h3>
        <p>{service.summary}</p>

        <div className="vk-verdict">
          {outcome === "ready" && <span className="ok">✓ Du har rett på dette, ut fra {assessment.coveredLabels.join(" og ").toLowerCase()}</span>}
          {outcome === "ineligible" && (
            <span className="off">
              ✗ Du har ikke rett på dette. {failed.map((check) => `${check.label} sier «${check.evidence}», og ${lowerFirst(check.rule)}`).join(". ")}.
            </span>
          )}
          {outcome === "missing" && (
            <>
              <span className="pill pill-warn">Mangler: {assessment.missingLabels.join(", ")}</span>
              <button className="btn-link" onClick={(event) => { event.stopPropagation(); onShareMore?.(); }}>
                Del bevis
              </button>
            </>
          )}
        </div>

        <Checks checks={assessment.checks} />

        {outcome === "ready" && <span className="small muted">Svar innen {service.responseTime}</span>}
      </div>
    </article>
  );
}

const lowerFirst = (text: string) => text.charAt(0).toLowerCase() + text.slice(1);

/** «Slik vurderte vi»: én linje per regel, med det beviset faktisk sa. */
function Checks({ checks }: { checks: Check[] }) {
  const icon = { ok: "✓", failed: "✗", missing: "–", skipped: "·" } as const;
  return (
    <ul className="vk-checks" aria-label="Slik vurderte vi" onClick={(event) => event.stopPropagation()}>
      {checks.map((check, index) => (
        <li key={index} className={check.result}>
          <span className="icon" aria-hidden="true">{icon[check.result]}</span>
          <span className="text">
            <span className="who">{check.label}</span>
            <span className="rule">{check.rule}</span>
            <span className="evidence">{check.evidence ?? (check.result === "skipped" ? "ikke delt, ikke nødvendig" : "ikke delt")}</span>
          </span>
        </li>
      ))}
    </ul>
  );
}
