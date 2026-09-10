import { assess, type Assessment, type PresentedCredential } from "../catalog";
import { firstName } from "./presentation";

export interface SentApplication {
  assessment: Assessment;
  reference: string;
  sentAt: Date;
}

/** Skjerm 3: kvittering. Søknadene finnes bare i denne økten; det er en prototype. */
export function Kvittering({ sent, credentials, onBack, onShareMore }: { sent: SentApplication[]; credentials: readonly PresentedCredential[]; onBack: () => void; onShareMore: () => void }) {
  const name = firstName(credentials);
  const missing = assess(credentials).filter((a) => a.outcome === "missing");
  const missingLabels = [...new Set(missing.flatMap((a) => a.missingLabels))].map((label) => label.toLowerCase());
  const missingText = missingLabels.length <= 1 ? missingLabels.join("") : `${missingLabels.slice(0, -1).join(", ")} eller ${missingLabels.at(-1)}`;
  const one = missingLabels.length === 1;

  return (
    <main>
      <section className="vk-band vk-receipt-band">
        <div className="wrap">
          <span className="vk-bigcheck" aria-hidden="true">✓</span>
          <h1>
            {name ? `Takk, ${name}. ` : "Takk. "}
            {sent.length === 1 ? "Søknaden er sendt." : `${sent.length} søknader er sendt.`}
          </h1>
          <p className="lead">
            Bevisene du delte fulgte med søknaden, så kommunen slipper å be deg om dokumentasjon. Du får svar i Min kommune og
            på e-post.
          </p>
        </div>
      </section>

      <section className="wrap vk-receipt">
        <h2>Dette ble sendt</h2>
        {sent.map(({ assessment, reference, sentAt }) => (
          <article key={reference} className="card vk-receipt-row">
            <div>
              <h3>{assessment.service.name}</h3>
              <span className="small muted">
                Referanse {reference} · Sendt {sentAt.toLocaleString("no-NO", { dateStyle: "long", timeStyle: "short" })} · Vedlagt:{" "}
                {assessment.coveredLabels.join(", ")}
              </span>
              <span className="small muted">
                Grunnlag: {assessment.checks.filter((check) => check.result === "ok").map((check) => check.evidence).join(" · ")}
              </span>
            </div>
            <span className="pill pill-ok">Mottatt</span>
            <span className="small muted">Svar innen {assessment.service.responseTime}</span>
          </article>
        ))}
        <div className="vk-actions">
          <a className="btn btn-primary" href="https://www.valer.kommune.no/" target="_blank" rel="noreferrer">
            Gå til Min kommune
          </a>
          <button className="btn btn-secondary" onClick={onBack}>
            Tilbake til forslagene
          </button>
        </div>
        {missing.length > 0 && (
          <div className="card vk-tip">
            <span className="bar" />
            <div>
              <strong>
                {missing.length === 1 ? "Én tjeneste til venter på" : `${missing.length} tjenester til venter på`} {one ? "ett bevis" : "flere bevis"}
              </strong>
              <span className="muted small">
                {missing.map((a) => a.service.name).join(", ")} trenger {missingText}. Har du det i lommeboka, tar det ett minutt til.
              </span>
            </div>
            <button className="btn-link" onClick={onShareMore}>
              Del bevis
            </button>
          </div>
        )}
      </section>
    </main>
  );
}
