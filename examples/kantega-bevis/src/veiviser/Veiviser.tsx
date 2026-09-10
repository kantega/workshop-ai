import QRCode from "qrcode";
import { useEffect, useRef, useState } from "react";
import { presentationPhase, presentationResult, startPresentation, walletUri, type VeiviserSetup } from "../api";
import { CREDENTIAL_GROUP_LABELS, CREDENTIALS, SERVICES, servicesUsing, type CredentialGroup, type PresentedCredential } from "../catalog";
import { DemoWallet } from "./DemoWallet";
import { toCredentials } from "./presentation";

export type SetupState = { kind: "rigging"; step: string } | { kind: "ready"; setup: VeiviserSetup } | { kind: "error"; message: string };

type Sharing =
  | { kind: "starting" }
  | { kind: "waiting"; sessionId: string; qr: string; uri: string; phase: string }
  | { kind: "verified" }
  | { kind: "rejected"; reason: string }
  | { kind: "expired" }
  | { kind: "error"; message: string };

const PHASE_TEXT: Record<string, string> = {
  PENDING_REQUEST: "Venter på lommeboka …",
  REQUEST_DELIVERED: "Lommeboka har hentet forespørselen. Godkjenn delingen på telefonen.",
  RESPONSE_RECEIVED: "Svar mottatt, verifiserer …",
};

/**
 * Skjerm 1: Personlig veiviser. Starter en fremvisningssesjon med én gang, viser QR-koden, poller
 * verifieren, og gir bevisene videre når de er godkjent.
 */
export function Veiviser({
  setupState,
  already,
  onShared,
  onDemo,
}: {
  setupState: SetupState;
  already: readonly PresentedCredential[];
  onShared: (credentials: PresentedCredential[]) => void;
  onDemo: (credentials: PresentedCredential[]) => void;
}) {
  const [sharing, setSharing] = useState<Sharing>({ kind: "starting" });
  const [attempt, setAttempt] = useState(0);
  const polling = useRef<number | null>(null);
  const setup = setupState.kind === "ready" ? setupState.setup : null;

  useEffect(() => {
    if (!setup) return;
    let cancelled = false;
    const stop = () => {
      if (polling.current !== null) window.clearInterval(polling.current);
      polling.current = null;
    };

    (async () => {
      try {
        const started = await startPresentation(setup.ruleId);
        const uri = walletUri(started);
        const qr = await QRCode.toDataURL(uri, { width: 512, margin: 1, color: { dark: "#2c280e", light: "#ffffff" } });
        if (cancelled) return;
        setSharing({ kind: "waiting", sessionId: started.id, qr, uri, phase: "PENDING_REQUEST" });

        polling.current = window.setInterval(async () => {
          try {
            const phase = await presentationPhase(started.id);
            if (cancelled) return;
            if (phase !== "VERIFIED" && phase !== "REJECTED" && phase !== "EXPIRED") {
              setSharing((previous) => (previous.kind === "waiting" ? { ...previous, phase } : previous));
              return;
            }
            stop();
            const result = await presentationResult(started.id);
            if (cancelled) return;
            if (result.status === "VERIFIED") {
              const { credentials, unknown } = toCredentials(result, setup);
              if (unknown.length > 0) console.warn("Bevis appen ikke kjenner:", unknown);
              setSharing({ kind: "verified" });
              window.setTimeout(() => onShared(credentials), 500);
            } else if (result.status === "EXPIRED") {
              setSharing({ kind: "expired" });
            } else {
              const reason = (result.failures ?? [])
                .map((failure) => [failure.queryId, failure.check, failure.detail].filter(Boolean).join(": "))
                .join("; ");
              setSharing({ kind: "rejected", reason: reason || "Verifieren godtok ikke delingen." });
            }
          } catch (failure) {
            stop();
            if (!cancelled) setSharing({ kind: "error", message: (failure as Error).message });
          }
        }, 1500);
      } catch (failure) {
        if (!cancelled) setSharing({ kind: "error", message: (failure as Error).message });
      }
    })();

    return () => {
      cancelled = true;
      stop();
    };
    // `attempt` starter en ny sesjon; onShared er stabil for siden.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attempt, setup]);

  const restart = () => {
    setSharing({ kind: "starting" });
    setAttempt((n) => n + 1);
  };

  return (
    <main>
      <section className="vk-hero">
        <div className="wrap">
          <div className="vk-hero-text">
            <span className="eyebrow">Digital lommebok</span>
            <h1>Personlig veiviser</h1>
            <p className="lead">
              Del bevisene du allerede har i den digitale lommeboka di, så viser vi deg hvilke tjenester i Våler kommune du
              kan søke på. Ingen skjemaer å lete etter, ingen dokumenter å laste opp.
            </p>
            {already.length > 0 && (
              <p className="small muted">
                Du har allerede delt {already.length} bevis. Nye bevis legges til det du delte.{" "}
                <a href="#/tjenester">Tilbake til tjenestene</a>
              </p>
            )}
            <ol className="vk-steps">
              <li>
                <span className="num">1</span>
                <div>
                  <strong>Skann koden</strong>
                  <span className="muted">Åpne lommeboka på telefonen og skann. Lommeboka viser deg nøyaktig hva kommunen spør om.</span>
                </div>
              </li>
              <li>
                <span className="num">2</span>
                <div>
                  <strong>Velg hva du deler</strong>
                  <span className="muted">Alle bevis er valgfrie. Deler du færre, får du færre forslag, aldri en feil.</span>
                </div>
              </li>
              <li>
                <span className="num">3</span>
                <div>
                  <strong>Se tjenestene dine</strong>
                  <span className="muted">Vi foreslår tjenester du kan søke på nå, og du søker rett her i portalen.</span>
                </div>
              </li>
            </ol>
          </div>

          <div className="vk-hero-side">
            <QrCard setupState={setupState} sharing={sharing} onRestart={restart} />
            <DemoWallet onShared={onDemo} />
          </div>
        </div>
      </section>

      <section className="wrap vk-section" id="bevis">
        <div className="vk-section-head">
          <h2>Dette spør vi lommeboka om</h2>
          <p>
            Når du skanner, ber kommunen om disse {CREDENTIALS.length} bevisene. Alle er valgfrie: du velger i lommeboka hvilke du
            deler, og hvert bevis åpner sine tjenester. Vi ber bare om det tjenestereglene faktisk sjekker: alder, bosted,
            gyldighet, førerkortklasse, og om du kvalifiserer til en ordning. Aldri diagnosen din, og aldri hva du tjener -
            av inntektsbekreftelsen får kommunen «kvalifisert: ja», ikke beløpet. Til sammen dekker de {SERVICES.length} tjenester.
          </p>
        </div>
        {(Object.keys(CREDENTIAL_GROUP_LABELS) as CredentialGroup[]).map((group) => (
          <div key={group} className="vk-credential-group">
            <h3>{CREDENTIAL_GROUP_LABELS[group]}</h3>
            <div className="vk-grid-5">
              {CREDENTIALS.filter((credential) => credential.group === group).map((credential) => {
                const opens = servicesUsing(credential.queryId);
                return (
                  <article key={credential.queryId} className="card vk-credential">
                    <span className="pill pill-cream">Valgfritt</span>
                    <h3>{credential.label}</h3>
                    <p>{credential.description}</p>
                    <p className="opens">
                      <strong>Åpner {opens.length === 1 ? "1 tjeneste" : `${opens.length} tjenester`}:</strong>{" "}
                      {opens.slice(0, 3).map((service) => service.name).join(", ")}
                      {opens.length > 3 ? ` og ${opens.length - 3} til` : ""}
                    </p>
                    <span className="issued">Utstedt av {credential.issuedBy}</span>
                  </article>
                );
              })}
            </div>
          </div>
        ))}
      </section>

      <section className="vk-privacy">
        <div className="wrap">
          <h2>Slik tar vi vare på det du deler</h2>
          <div className="vk-privacy-cols">
            <div>
              <span className="bar" />
              <h3>Du bestemmer</h3>
              <p>Lommeboka viser deg hva kommunen spør om før du godkjenner. Du kan velge bort hvert enkelt bevis.</p>
            </div>
            <div>
              <span className="bar" />
              <h3>Ingenting lagres</h3>
              <p>Bevisene brukes til å regne ut forslagene og finnes bare i denne økten. Lukker du siden, er de borte.</p>
            </div>
            <div>
              <span className="bar" />
              <h3>Bare det som trengs</h3>
              <p>Hver regel sjekkes mot det beviset sier, og du ser vurderingen linje for linje. Ingen skjulte kriterier.</p>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}

function QrCard({ setupState, sharing, onRestart }: { setupState: SetupState; sharing: Sharing; onRestart: () => void }) {
  if (setupState.kind !== "ready") {
    return (
      <aside className="card vk-qr-card" aria-live="polite">
        <h3>Skann med lommeboka di</h3>
        <div className="vk-qr placeholder">{setupState.kind === "rigging" ? "Lager kode …" : "Fikk ikke kontakt med plattformen"}</div>
        {setupState.kind === "rigging" ? (
          <span className="vk-status">
            <span className="dot" /> {setupState.step}
          </span>
        ) : (
          <>
            <span className="vk-status">
              <span className="dot bad" /> QR-koden trenger bevisplattformen i testmiljøet.
            </span>
            <pre className="error">{setupState.message}</pre>
            <p className="small muted">
              Se hva som mangler i <a href="#/verktoy">verktøypanelet</a>, eller bruk demo-lommeboka under for å se resten av reisen.
            </p>
            <button className="btn btn-secondary" onClick={() => window.location.reload()}>
              Prøv igjen
            </button>
          </>
        )}
      </aside>
    );
  }

  return (
    <aside className="card vk-qr-card" aria-live="polite">
      <h3>Skann med lommeboka di</h3>

      {sharing.kind === "waiting" ? (
        <div className="vk-qr">
          <img src={sharing.qr} alt="QR-kode for å dele bevis fra lommeboka" />
        </div>
      ) : (
        <div className="vk-qr placeholder">
          {sharing.kind === "starting" && "Lager kode …"}
          {sharing.kind === "verified" && "Bevisene er verifisert"}
          {sharing.kind === "expired" && "Koden gikk ut"}
          {sharing.kind === "rejected" && "Delingen ble avvist"}
          {sharing.kind === "error" && "Fikk ikke kontakt"}
        </div>
      )}

      {sharing.kind === "waiting" && (
        <>
          <span className="vk-status">
            <span className="dot" /> {PHASE_TEXT[sharing.phase] ?? sharing.phase}
          </span>
          <p className="small muted">
            Kommunen spør om <a href="#bevis">{CREDENTIALS.length} bevis</a>, alle valgfrie. Lommeboka viser hva som blir delt før du
            godkjenner. Koden gjelder i noen minutter.
          </p>
          <a className="btn btn-secondary" href={sharing.uri}>
            Åpne i lommeboka på denne enheten
          </a>
          <details>
            <summary>Lenken som tekst (lim inn i lommeboka)</summary>
            <code>{sharing.uri}</code>
          </details>
        </>
      )}

      {sharing.kind === "verified" && (
        <span className="vk-status">
          <span className="dot ok" /> Henter tjenestene dine …
        </span>
      )}

      {(sharing.kind === "expired" || sharing.kind === "rejected" || sharing.kind === "error") && (
        <>
          <span className="vk-status">
            <span className="dot bad" />{" "}
            {sharing.kind === "expired" ? "Koden gikk ut før lommeboka svarte." : sharing.kind === "rejected" ? sharing.reason : "Fikk ikke kontakt med plattformen."}
          </span>
          {sharing.kind === "error" && <pre className="error">{sharing.message}</pre>}
          <button className="btn btn-primary" onClick={onRestart}>
            Lag ny kode
          </button>
        </>
      )}

      <a className="small" href="https://testflight.apple.com/join/VRKXvPRA" target="_blank" rel="noreferrer">
        Har du ikke en digital lommebok ennå?
      </a>
    </aside>
  );
}
