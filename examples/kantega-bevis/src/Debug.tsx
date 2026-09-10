import QRCode from "qrcode";
import { useCallback, useEffect, useState } from "react";
import {
  orderCredential,
  platformStatus,
  type AppSetup,
  type PlatformStatus,
  type ServiceStatus,
} from "./api";
import { Kjennelse, KopierLenke, useAppSetup, usePresentation } from "./presentation";
import { SPEC } from "./spec";
import {
  advanceToConsent,
  alive as ksAlive,
  barnehageProcess,
  eligibility,
  giveConsent,
  householdIncome,
  ORDNING,
  people,
  processes,
  startSession,
  type KsPerson,
  type SjekkResultat,
} from "./ks";

const KS_KOMMANDO = "./start.sh --mock            # i din klone av github.com/ks-no/workshop-ai";
const ENV_KOMMANDO = "cp .env.example .env.local   # og fyll inn EIDAS_CLIENT_ID og EIDAS_CLIENT_SECRET, så npm run dev på nytt";

interface Grunnlag {
  person: KsPerson;
  oektsId: string;
  inntektsaar: string;
  beregningsbeloep: string;
  sjekk: SjekkResultat;
}

export default function Debug() {
  const { setup, step: setupStep, error: setupError } = useAppSetup(SPEC);
  const [grunnlag, setGrunnlag] = useState<Grunnlag | null>(null);

  return (
    <main className="shell">
      <header>
        <h1>KS-workshop mot testmiljøet</h1>
        <p className="muted">
          KS-sandkassen fra <code>ks-no/workshop-ai</code> kjører på maskinen din. Plattformen vår kjører i
          testmiljøet, og appen kaller den slik en kunde gjør: med en integrasjonsklient og et token. Ingen
          rigg, ingen portflytting — kjør reisen, se den virke, kopier mønsteret.
        </p>
      </header>

      <StatusPanel />

      <section className="panel">
        <h2>Reisen appen viser</h2>
        <ol className="journey">
          <li>
            Sandkassen regner ut husstandsinntekten for en testperson og avgjør om hun har rett til{" "}
            <strong>redusert foreldrebetaling</strong>. Deterministisk, som hos dem.
          </li>
          <li>
            Utstederen vår i testmiljøet pakker svaret som et <strong>bevis i lommeboka hennes</strong> — og
            fordi utstederen er nåbar utenfra, kan lommeboka være en ekte app på telefonen.
          </li>
          <li>
            Neste gang kommunen trenger det, <strong>fremviser hun beviset</strong>, og verifieren vår dømmer
            det. Kommunen får «kvalifisert: ja», aldri kronebeløpet.
          </li>
        </ol>
      </section>

      {setupError ? (
        <div className="panel error-panel">
          <h2>Fikk ikke rigget opp plattformen</h2>
          <p>Se statuspanelet over: er legitimasjonen på plass, og bærer tokenet scopene appen trenger?</p>
          <pre className="error">{setupError}</pre>
        </div>
      ) : !setup ? (
        <div className="panel">
          <p className="muted">{setupStep}</p>
        </div>
      ) : (
        <>
          <SandkassePanel onGrunnlag={setGrunnlag} />
          <UtstedPanel setup={setup} grunnlag={grunnlag} />
          <FremvisPanel setup={setup} />
        </>
      )}

      <footer className="muted">
        Appen går kundeveien: bare API-er en integrasjonspartner også har. Trenger dere noe som ikke finnes,
        er det plattformen som skal utvides — ikke denne appen. Se <code>README.md</code>.
      </footer>
    </main>
  );
}

function Lamp({ oppe }: { oppe: boolean | null }) {
  if (oppe === null) return <span className="muted">sjekker …</span>;
  return oppe ? <span className="lamp ok">svarer</span> : <span className="lamp bad">nede</span>;
}

function TokenLamp({ service }: { service: ServiceStatus | undefined }) {
  if (!service) return <span className="muted">sjekker …</span>;
  if (service.token === "ok") {
    return (
      <span>
        <span className="lamp ok">bærer</span>{" "}
        <span className="muted mono">{service.scope || "(ingen scopes)"}</span>
      </span>
    );
  }
  if (service.token === "unconfigured") return <span className="lamp bad">ikke satt opp</span>;
  return <span className="lamp bad">avvist</span>;
}

function StatusPanel() {
  const [ks, setKs] = useState<{ tools: boolean | null; sandbox: boolean | null }>({ tools: null, sandbox: null });
  const [platform, setPlatform] = useState<PlatformStatus | null | undefined>(undefined);

  const refresh = useCallback(async () => {
    setKs({ tools: null, sandbox: null });
    setPlatform(undefined);
    const [tools, sandbox, status] = await Promise.all([ksAlive("tools"), ksAlive("sandbox"), platformStatus()]);
    setKs({ tools, sandbox });
    setPlatform(status);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const fikser: string[] = [];
  if (ks.tools === false || ks.sandbox === false) fikser.push(KS_KOMMANDO);
  if (platform && !platform.configured) fikser.push(ENV_KOMMANDO);
  const avvist = platform ? [platform.studio, platform.verifier].filter((service) => service.token === "failed") : [];

  return (
    <section className="panel">
      <div className="panel-head">
        <h2>Står alt oppe?</h2>
        <button className="ghost" onClick={() => void refresh()}>
          Sjekk på nytt
        </button>
      </div>
      <table>
        <thead>
          <tr>
            <th>Tjeneste</th>
            <th>Hvor</th>
            <th>Status</th>
            <th>Legitimasjon</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>KS tools-api</td>
            <td className="mono">localhost:8083</td>
            <td>
              <Lamp oppe={ks.tools} />
            </td>
            <td className="muted">trengs ikke</td>
          </tr>
          <tr>
            <td>KS sandbox-backend</td>
            <td className="mono">localhost:8080</td>
            <td>
              <Lamp oppe={ks.sandbox} />
            </td>
            <td className="muted">trengs ikke</td>
          </tr>
          <tr>
            <td>Vår bevisstudio</td>
            <td className="mono">{platform?.studio.url ?? "testmiljøet"}</td>
            <td>
              <Lamp oppe={platform === undefined ? null : (platform?.studio.reachable ?? false)} />
            </td>
            <td>
              <TokenLamp service={platform?.studio} />
            </td>
          </tr>
          <tr>
            <td>Vår verifier</td>
            <td className="mono">{platform?.verifier.url ?? "testmiljøet"}</td>
            <td>
              <Lamp oppe={platform === undefined ? null : (platform?.verifier.reachable ?? false)} />
            </td>
            <td>
              <TokenLamp service={platform?.verifier} />
            </td>
          </tr>
        </tbody>
      </table>
      {platform === null && (
        <pre className="error">Dev-serveren svarer ikke på /app-api/status — kjører `npm run dev`?</pre>
      )}
      {fikser.length > 0 && (
        <div className="fix">
          <p className="muted">Start eller sett opp det som mangler:</p>
          {fikser.map((command) => (
            <pre key={command} className="command">
              {command}
            </pre>
          ))}
        </div>
      )}
      {avvist.map((service) => (
        <pre key={service.url} className="error">
          {service.error}
        </pre>
      ))}
      <p className="muted">
        Klient-id og hemmelighet bor i <code>.env.local</code> og leses bare av dev-serveren, som henter ett
        token per tjeneste og legger det på hvert kall. Nettleseren ser aldri hemmeligheten. Scopene i
        «Legitimasjon» er de tokenet faktisk fikk — mangler et, er det registreringen i kontrollflata som
        skal utvides.
        {platform?.clientId && (
          <>
            {" "}
            Klient: <code>{platform.clientId}</code>.
          </>
        )}
      </p>
    </section>
  );
}

function SandkassePanel({ onGrunnlag }: { onGrunnlag: (grunnlag: Grunnlag) => void }) {
  const [personer, setPersoner] = useState<KsPerson[] | null>(null);
  const [valgt, setValgt] = useState<string>("");
  const [resultat, setResultat] = useState<Grunnlag | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [jobber, setJobber] = useState(false);
  const [steg, setSteg] = useState<string | null>(null);

  const hentPersoner = async () => {
    setError(null);
    try {
      const liste = await people();
      setPersoner(liste);
      setValgt(liste[0]?.personId ?? "");
    } catch (failure) {
      setError((failure as Error).message);
    }
  };

  const vurder = async () => {
    const person = personer?.find((kandidat) => kandidat.personId === valgt);
    if (!person) return;
    setError(null);
    setJobber(true);
    try {
      setSteg("Finner prosessen for ordningen …");
      const prosess = barnehageProcess(await processes());
      if (!prosess) throw new Error("Fant ingen prosess for foreldrebetaling i sandkassens katalog.");

      setSteg(`Starter prosessøkt for ${person.navn} …`);
      const startet = await startSession(valgt, prosess.id);

      // Samtykket kan bare opprettes mens økten står på CONSENT_REQUEST-steget.
      const paaSamtykke = await advanceToConsent(startet, setSteg);
      const oektsId = paaSamtykke.oektsId;

      setSteg("Registrerer samtykke til inntektsoppslag …");
      await giveConsent(oektsId);

      setSteg("Henter inntekt og sjekker rett …");
      const [inntekt, sjekk] = await Promise.all([householdIncome(valgt), eligibility(valgt)]);

      const grunnlag: Grunnlag = {
        person,
        oektsId,
        inntektsaar: String(inntekt.inntektsaar ?? "ukjent"),
        beregningsbeloep: inntekt.beregningsbeloep?.toLocaleString("no-NO") ?? "ukjent",
        sjekk,
      };
      setResultat(grunnlag);
      onGrunnlag(grunnlag);
    } catch (failure) {
      setError((failure as Error).message);
    } finally {
      setSteg(null);
      setJobber(false);
    }
  };

  return (
    <section className="panel">
      <h2>
        <span className="ordinal">1</span> Sandkassen regner ut retten
      </h2>
      <p className="muted">
        Går via <code>tools-api</code> på 8083, som ikke krever token — den henter sitt eget Maskinporten-token
        bakover.
      </p>
      <p className="muted">
        <strong>Inntekt er samtykkesperret</strong>, og sperren er ekte: både <code>get_household_income</code> og{" "}
        <code>check_eligibility</code> svarer 403 «Inntektsdata krever registrert samtykke» uten den. Sandkassen
        henger samtykket på en prosessøkt, ikke på personen, så appen starter en økt og svarer{" "}
        <code>consent_response</code> før den spør om tall — fire kall, i den rekkefølgen.
      </p>
      {personer === null ? (
        <button onClick={() => void hentPersoner()}>Hent testpersoner</button>
      ) : (
        <>
          <label>
            Testperson
            <select value={valgt} onChange={(event) => setValgt(event.target.value)}>
              {personer.map((person) => (
                <option key={person.personId} value={person.personId}>
                  {person.navn} ({person.personId})
                </option>
              ))}
            </select>
          </label>
          <button onClick={() => void vurder()} disabled={jobber || !valgt}>
            {jobber ? "Jobber …" : "Gi samtykke og hent inntekt"}
          </button>
          {steg && <p className="muted">{steg}</p>}
        </>
      )}
      {resultat && (
        <>
          <table>
            <tbody>
              <tr>
                <th>Prosessøkt</th>
                <td className="mono">{resultat.oektsId}</td>
              </tr>
              <tr>
                <th>Samtykke</th>
                <td>registrert (SAMTYKKET)</td>
              </tr>
              <tr>
                <th>Inntektsår</th>
                <td>{resultat.inntektsaar}</td>
              </tr>
              <tr>
                <th>Beregningsbeløp</th>
                <td>{resultat.beregningsbeloep} kr</td>
              </tr>
              <tr>
                <th>Ordning</th>
                <td className="mono">{ORDNING}</td>
              </tr>
            </tbody>
          </table>
          <div className={`verdict ${resultat.sjekk.godkjent ? "ok" : "bad"}`}>
            {resultat.sjekk.godkjent ? "✔" : "✖"} {resultat.sjekk.melding}
          </div>
        </>
      )}
      {error && <pre className="error">{error}</pre>}
    </section>
  );
}

function UtstedPanel({ setup, grunnlag }: { setup: AppSetup; grunnlag: Grunnlag | null }) {
  const [qr, setQr] = useState<string | null>(null);
  const [uri, setUri] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const utsted = async () => {
    if (!grunnlag) return;
    setError(null);
    setQr(null);
    try {
      const offer = await orderCredential(setup.issuanceRuleId, {
        navn: grunnlag.person.navn,
        ordning: ORDNING,
        inntektsaar: grunnlag.inntektsaar,
        kvalifisert: grunnlag.sjekk.godkjent ? "ja" : "nei",
        beregningsbeloep: grunnlag.beregningsbeloep,
      });
      setUri(offer.offerUri);
      setQr(await QRCode.toDataURL(offer.offerUri, { width: 220, margin: 1 }));
    } catch (failure) {
      setError((failure as Error).message);
    }
  };

  return (
    <section className="panel">
      <h2>
        <span className="ordinal">2</span> Utstederen legger svaret i lommeboka
      </h2>
      {!grunnlag ? (
        <p className="muted">Gjør steg 1 først — beviset fylles med tallene derfra.</p>
      ) : (
        <>
          <p className="muted">
            Bevistypen «{SPEC.credentialTypeName}» fra utstederen «{setup.issuerName}» for {grunnlag.person.navn},
            utstedt forhåndsautorisert. Skann med lommeboka på telefonen — tilbudet peker på testmiljøet, som er
            nåbart utenfra.
          </p>
          <button onClick={() => void utsted()}>Utsted til lommebok</button>
        </>
      )}
      {qr && uri && (
        <div className="qr">
          <img src={qr} alt="QR-kode for utstedelsestilbudet" />
          <p className="muted">
            Skann med lommeboka, eller <a href={uri}>åpne på samme enhet</a>.
          </p>
          <KopierLenke uri={uri} etikett="Kopier tilbudslenka" />
        </div>
      )}
      {error && <pre className="error">{error}</pre>}
    </section>
  );
}

function FremvisPanel({ setup }: { setup: AppSetup }) {
  const { scan, start: nyFremvisning } = usePresentation(setup.ruleId);

  return (
    <section className="panel">
      <h2>
        <span className="ordinal">3</span> Kommunen ber om beviset
      </h2>
      <p className="muted">
        Regelen «{SPEC.rule.name}» hos verifieren «{setup.verifierName}» ber om{" "}
        {SPEC.rule.requestedClaims.join(", ")} — og aldri <code>beregningsbeloep</code>. Beløpet ligger i
        beviset, men blir ikke utlevert.
      </p>
      <button onClick={() => void nyFremvisning()}>Ny fremvisning</button>
      {scan.kind === "waiting" && (
        <div className="qr">
          <img src={scan.qr} alt="QR-kode for fremvisningen" />
          <p className="muted">
            Venter på lommeboka … <a href={scan.uri}>åpne på samme enhet</a>
          </p>
          <KopierLenke uri={scan.uri} etikett="Kopier forespørselen" />
        </div>
      )}
      {scan.kind === "verified" && <Kjennelse claims={scan.claims} />}
      {scan.kind === "rejected" && <div className="verdict bad">✖ Avvist: {scan.reason}</div>}
      {scan.kind === "error" && <pre className="error">{scan.message}</pre>}
    </section>
  );
}
