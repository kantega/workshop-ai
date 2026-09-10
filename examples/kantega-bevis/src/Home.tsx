import { useEffect, useRef } from "react";
import { Kjennelse, useAppSetup, usePresentation } from "./presentation";
import { SPEC } from "./spec";

/**
 * Forsiden: innbyggerflata. Kommunen ber om beviset, innbyggeren skanner QR-koden med lommeboka
 * si, og siden venter på dommen.
 *
 * Ingen kopier-lenke og ingen protokoll-claim her — det er feilsøkingsutstyr, og det bor på
 * /debug sammen med resten av utviklerreisen.
 */
export default function Home() {
  const { setup, step, error } = useAppSetup(SPEC);
  const { scan, start } = usePresentation(setup?.ruleId ?? "");

  // Innbyggeren skal ikke måtte trykke «lag QR» — den skal ligge der når sida er klar. Ref-vakten
  // sørger for at StrictMode ikke brenner to sesjoner på det.
  const startet = useRef(false);
  useEffect(() => {
    if (!setup || startet.current) return;
    startet.current = true;
    void start();
  }, [setup, start]);

  const påNytt = () => void start();

  return (
    <main className="shell">
      <header>
        <h1>Redusert foreldrebetaling</h1>
        <p className="muted">
          Skann QR-koden med lommeboka di for å vise fram inntektsbekreftelsen. Kommunen ber om{" "}
          {SPEC.rule.requestedClaims.join(", ")} — og aldri <code>beregningsbeloep</code>. Beløpet ligger i
          beviset, men blir ikke utlevert.
        </p>
      </header>

      <section className="panel">
        {error ? (
          <>
            <p className="muted">Fikk ikke kontakt med plattformen.</p>
            <pre className="error">{error}</pre>
          </>
        ) : !setup ? (
          <p className="muted">{step}</p>
        ) : (
          <>
            {scan.kind === "waiting" && (
              <div className="qr">
                <img src={scan.qr} alt="QR-kode for fremvisningen" />
                <p className="muted">
                  Venter på lommeboka … <a href={scan.uri}>åpne på samme enhet</a>
                </p>
              </div>
            )}
            {scan.kind === "verified" && <Kjennelse claims={scan.claims} visProtokoll={false} />}
            {scan.kind === "rejected" && (
              <>
                <div className="verdict bad">✖ Avvist: {scan.reason}</div>
                <button onClick={påNytt}>Prøv igjen</button>
              </>
            )}
            {scan.kind === "error" && (
              <>
                <pre className="error">{scan.message}</pre>
                <button onClick={påNytt}>Prøv igjen</button>
              </>
            )}
          </>
        )}
      </section>
    </main>
  );
}
