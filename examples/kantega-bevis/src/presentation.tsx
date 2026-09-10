// Fremvisningen — delt mellom forsiden (innbyggerflata) og /debug (utviklerreisen).
//
// QR-koden kommer IKKE fra bevisstudio. Bevisstudio eier fremvisningsregelen (hva vi spør om,
// som DCQL). Selve sesjonen lages hos VERIFIEREN — POST /v1/presentation-sessions med regel-id-en
// — og svaret derfra blir til lommeboklenka `openid4vp://?client_id=…&request_uri=…`, som vi
// tegner som QR i nettleseren. `requestUri` er en engangshemmelighet: én sesjon per QR.

import QRCode from "qrcode";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ensureSetup,
  presentationPhase,
  presentationResult,
  PROTOCOL_CLAIMS,
  startPresentation,
  walletUri,
  type AppSetup,
  type AppSpec,
  type PresentedClaims,
} from "./api";

export type Scan =
  | { kind: "idle" }
  | { kind: "waiting"; qr: string; uri: string }
  | { kind: "verified"; claims: PresentedClaims }
  | { kind: "rejected"; reason: string }
  | { kind: "error"; message: string };

/**
 * Rigger opp appens behov i organisasjonen og holder på framdriften mens det står på.
 * Idempotent, så begge sidene kan kalle den — den som kommer sist finner det den første lagde.
 */
export function useAppSetup(spec: AppSpec) {
  const [setup, setSetup] = useState<AppSetup | null>(null);
  const [step, setStep] = useState("Rigger opp i testmiljøet …");
  const [error, setError] = useState<string | null>(null);

  // Ref-vakten finnes fordi StrictMode kjører effekten dobbelt i dev: to samtidige ensureSetup
  // kappløper om finn-eller-opprett og den ene taper på duplikat.
  const started = useRef(false);
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    ensureSetup(spec, setStep)
      .then(setSetup)
      .catch((failure: Error) => setError(failure.message));
  }, [spec]);

  return { setup, step, error };
}

/**
 * Én fremvisning fra start til dom: lag sesjonen hos verifieren, tegn QR-en, og spør om fasen til
 * den er avgjort. Vi spør på FASEN først og henter resultatet etterpå — resultatendepunktet svarer
 * 404 helt til sesjonen er avgjort, og det er «ikke ennå», ikke en feil.
 */
export function usePresentation(ruleId: string) {
  const [scan, setScan] = useState<Scan>({ kind: "idle" });
  const polling = useRef<number | null>(null);

  const stopPolling = useCallback(() => {
    if (polling.current !== null) {
      window.clearInterval(polling.current);
      polling.current = null;
    }
  }, []);

  useEffect(() => stopPolling, [stopPolling]);

  const start = useCallback(async () => {
    stopPolling();
    try {
      const started = await startPresentation(ruleId);
      const uri = walletUri(started);
      setScan({ kind: "waiting", qr: await QRCode.toDataURL(uri, { width: 220, margin: 1 }), uri });

      polling.current = window.setInterval(async () => {
        try {
          const phase = await presentationPhase(started.id);
          if (phase !== "VERIFIED" && phase !== "REJECTED" && phase !== "EXPIRED") return;
          stopPolling();
          const result = await presentationResult(started.id);
          if (result.status === "VERIFIED") {
            setScan({
              kind: "verified",
              claims: result.presentations?.find((outcome) => outcome.claims)?.claims ?? {},
            });
          } else {
            const reason = result.failures
              ?.map((failure) => [failure.check, failure.detail].filter(Boolean).join(": "))
              .join("; ");
            setScan({ kind: "rejected", reason: reason || result.status });
          }
        } catch (failure) {
          stopPolling();
          setScan({ kind: "error", message: (failure as Error).message });
        }
      }, 1500);
    } catch (failure) {
      setScan({ kind: "error", message: (failure as Error).message });
    }
  }, [ruleId, stopPolling]);

  return { scan, start };
}

/**
 * QR-koden er for telefonen. Lenka bak den er `openid-credential-offer://…` eller
 * `openid4vp://…`, og den er verdt å ha i utklippstavla: lim den inn i en lommebok på samme
 * maskin, i `curl` for å se hva forespørselen faktisk inneholder, eller i en melding til den som
 * feilsøker sammen med deg.
 */
export function KopierLenke({ uri, etikett }: { uri: string; etikett: string }) {
  const [tilstand, setTilstand] = useState<"klar" | "kopiert" | "merket">("klar");
  const lenke = useRef<HTMLElement>(null);

  const kopier = async () => {
    try {
      await navigator.clipboard.writeText(uri);
      setTilstand("kopiert");
    } catch {
      // Utklippstavla krever et sikkert opphav og et fokusert dokument, og kan nektes uansett.
      // Da merker vi teksten i stedet, så ⌘C/Ctrl+C gjør resten — en blindvei hjelper ingen.
      const range = document.createRange();
      if (lenke.current) range.selectNodeContents(lenke.current);
      const selection = window.getSelection();
      selection?.removeAllRanges();
      selection?.addRange(range);
      setTilstand("merket");
    }
    window.setTimeout(() => setTilstand("klar"), 2500);
  };

  return (
    <div className="kopier">
      <button className="ghost" onClick={() => void kopier()}>
        {tilstand === "kopiert" ? "✔ Kopiert" : tilstand === "merket" ? "Merket — trykk ⌘C" : etikett}
      </button>
      <code className="mono lenke" ref={lenke}>
        {uri}
      </code>
    </div>
  );
}

/**
 * Én claim-verdi som tekst. `status` er et objekt (`{ status_list: { uri, idx } }`), og et objekt
 * rett inn i JSX kaster «Objects are not valid as a React child» — som river ned HELE React-treet
 * og gir en blank side. Alt som ikke er en streng blir derfor JSON her.
 */
export function somTekst(value: unknown): string {
  if (typeof value === "string") return value;
  if (value === null || value === undefined) return "";
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return JSON.stringify(value);
}

export function ClaimTabell({ claims }: { claims: PresentedClaims }) {
  return (
    <table>
      <tbody>
        {Object.entries(claims).map(([key, value]) => (
          <tr key={key}>
            <th>{key}</th>
            <td className="mono">{somTekst(value)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/**
 * Det kommunen faktisk fikk. Beviset skiller seg i to, og skillet er verdt å vise fram: claimene
 * fremvisningsregelen ba om, og protokoll-claimene ethvert SD-JWT VC bærer uansett — utsteder,
 * bevistype, gyldighet og statuslista beviset kan tilbakekalles gjennom.
 *
 * `visProtokoll` er av på innbyggerflata: der er protokoll-claimene støy, ikke lærdom.
 */
export function Kjennelse({ claims, visProtokoll = true }: { claims: PresentedClaims; visProtokoll?: boolean }) {
  const kvalifisert = somTekst(claims["kvalifisert"]) === "ja";
  const bevisets = Object.fromEntries(Object.entries(claims).filter(([key]) => !PROTOCOL_CLAIMS.includes(key)));
  const protokoll = Object.fromEntries(Object.entries(claims).filter(([key]) => PROTOCOL_CLAIMS.includes(key)));

  return (
    <>
      <div className={`verdict ${kvalifisert ? "ok" : "bad"}`}>
        {kvalifisert ? "✔ Kvalifisert" : "✖ Ikke kvalifisert"} — {somTekst(claims["navn"]) || "(ukjent)"}
      </div>
      <ClaimTabell claims={bevisets} />
      {visProtokoll && Object.keys(protokoll).length > 0 && (
        <details>
          <summary className="muted">Protokoll-claimene beviset alltid bærer</summary>
          <ClaimTabell claims={protokoll} />
        </details>
      )}
    </>
  );
}
