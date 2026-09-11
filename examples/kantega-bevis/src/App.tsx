import { useEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { ensureVeiviser } from "./api";
import { claimText, CREDENTIALS, mergeCredentials, VEIVISER_RULE, type Assessment, type PresentedCredential } from "./catalog";
import Verktoy from "./Verktoy";
import { Kvittering, type SentApplication } from "./veiviser/Kvittering";
import { Layout } from "./veiviser/Layout";
import { fullName } from "./veiviser/presentation";
import { Tjenester } from "./veiviser/Tjenester";
import { Veiviser, type SetupState } from "./veiviser/Veiviser";
import "./veiviser/veiviser.css";

type Route = "veiviser" | "tjenester" | "kvittering" | "verktoy";

/**
 * Innbyggerflata ruter på hash, så en reload på `#/tjenester` treffer samme index.html.
 * `/debug` er unntaket: den er en STI, den var adressen til utviklerpanelet før veiviseren kom,
 * og den er bokmerket. Den viser samme panel som `#/verktoy` framfor å bli en tom forside.
 */
function currentRoute(): Route {
  if (window.location.pathname.replace(/\/+$/, "") === "/debug") return "verktoy";
  const hash = window.location.hash.replace(/^#\/?/, "");
  if (hash.startsWith("verktoy")) return "verktoy";
  if (hash.startsWith("tjenester")) return "tjenester";
  if (hash.startsWith("kvittering")) return "kvittering";
  return "veiviser";
}

function go(route: Route) {
  window.location.hash = route === "veiviser" ? "/" : `/${route}`;
}

export default function App() {
  const [route, setRoute] = useState<Route>(currentRoute);
  useEffect(() => {
    const onNavigate = () => setRoute(currentRoute());
    window.addEventListener("hashchange", onNavigate);
    // Tilbakeknappen mellom `/` og `/debug` gir popstate, ikke hashchange.
    window.addEventListener("popstate", onNavigate);
    return () => {
      window.removeEventListener("hashchange", onNavigate);
      window.removeEventListener("popstate", onNavigate);
    };
  }, []);

  if (route === "verktoy") return <Verktoy />;
  return <Innbyggerflate route={route} />;
}

function Innbyggerflate({ route }: { route: Exclude<Route, "verktoy"> }) {
  const [setupState, setSetupState] = useState<SetupState>({ kind: "rigging", step: "Kobler til plattformen …" });
  const [credentials, setCredentials] = useState<PresentedCredential[]>([]);
  const [sent, setSent] = useState<SentApplication[]>([]);

  // StrictMode kjører effekten dobbelt i dev; to samtidige ensureVeiviser kappløper om finn-eller-opprett.
  // Riggingen blokkerer ikke siden: bare QR-koden trenger plattformen, demo-lommeboka gjør det ikke.
  const started = useRef(false);
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    ensureVeiviser(CREDENTIALS, VEIVISER_RULE, (step) => setSetupState({ kind: "rigging", step }))
      .then((setup) => setSetupState({ kind: "ready", setup }))
      .catch((failure: Error) => setSetupState({ kind: "error", message: failure.message }));
  }, []);

  // Sider som forutsetter delte bevis sender tilbake til start hvis de mangler (f.eks. etter reload).
  useEffect(() => {
    if (route !== "veiviser" && credentials.length === 0) go("veiviser");
  }, [route, credentials.length]);

  const person = fullName(credentials);

  // Samme person deler mer: slå sammen. En annen person (annen eID): start på nytt, ellers arver
  // hun forrige persons bevis. Demo-lommeboka starter alltid på nytt.
  const onShared = (incoming: PresentedCredential[], mode: "merge" | "replace" = "merge") => {
    // Ingenting kom fram, og ingenting lå der fra før: da har tjenestesiden ingenting å vise, og
    // vakten under ville sendt henne rett tilbake til QR-koden - som ser ut som en ny forespørsel
    // om å skanne. Bli stående, så får hun beskjeden fra kortet i stedet for en ny kode.
    if (incoming.length === 0 && (mode === "replace" || credentials.length === 0)) return;
    // Bevisene må være TEGNET FERDIG før hash-en endres, ellers finnes det en tegning der ruten er
    // «tjenester» mens bevislisten fortsatt er tom - og vakten under sender henne rett tilbake til
    // forsiden, som lager en NY QR-kode.
    //
    // Grunnen er prioritet, ikke rekkefølge. Etter en ekte skanning kommer vi hit fra en timer i
    // Veiviser, og en setState derfra havner i standardkøen React tømmer litt senere. Men
    // `hashchange` står på React sin liste over DISKRETE hendelser (se `getEventPriority` i
    // react-dom, ved siden av «click» og «popstate»), så `setRoute` i lytteren tømmes med én gang
    // og tegner ALENE: standardkøen med bevisene blir stående. Vakten ser tom liste, hash-en går
    // tilbake til «/», og Veiviser monteres på nytt med en fersk sesjon.
    //
    // Det slo til nøyaktig én gang, og det er samme forklaring: andre gang er listen allerede full,
    // så `credentials.length === 0` er falsk uansett hvilken tegning vakten treffer. Demo-lommeboka
    // merket det aldri, fordi et klikk allerede er diskret og tømmes før `hashchange` rekker fram.
    flushSync(() => {
      setCredentials((existing) => (mode === "replace" || !samePerson(existing, incoming) ? incoming : mergeCredentials(existing, incoming)));
      setSent([]);
    });
    go("tjenester");
  };

  const onApply = (chosen: Assessment[]) => {
    const now = new Date();
    const stamp = now.toISOString().slice(0, 10);
    setSent(
      chosen.map((assessment, index) => ({
        assessment,
        reference: `${stamp}/${String(4470 + index + sent.length).padStart(4, "0")}`,
        sentAt: now,
      })),
    );
    go("kvittering");
  };

  const forget = () => {
    setCredentials([]);
    setSent([]);
    go("veiviser");
  };

  return (
    <Layout person={person}>
      {route === "veiviser" && (
        <Veiviser setupState={setupState} already={credentials} onShared={(incoming) => onShared(incoming, "merge")} onDemo={(incoming) => onShared(incoming, "replace")} />
      )}
      {route === "tjenester" && credentials.length > 0 && (
        <Tjenester credentials={credentials} onApply={onApply} onShareMore={() => go("veiviser")} onForget={forget} />
      )}
      {route === "kvittering" && credentials.length > 0 && (
        <Kvittering sent={sent} credentials={credentials} onBack={() => go("tjenester")} onShareMore={() => go("veiviser")} />
      )}
    </Layout>
  );
}

/** Ulik eID i det som fantes og det som kom: en annen person. Uten eID på begge sider antar vi samme. */
function samePerson(existing: readonly PresentedCredential[], incoming: readonly PresentedCredential[]): boolean {
  const before = existing.find((c) => c.queryId === "pid");
  const after = incoming.find((c) => c.queryId === "pid");
  if (!before || !after) return true;
  const key = (c: PresentedCredential) => [c.claims.given_name, c.claims.family_name, c.claims.birthdate].map(claimText).join("|");
  return key(before) === key(after);
}
