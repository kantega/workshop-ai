"use client";

// Klientsiden av delingen: starter en sesjon, viser QR + same-device-knapp, poller fasen, og
// sender innbyggeren videre når verifieren har avgjort. I mock-modus finnes i tillegg en
// «demo-lommebok» som svarer med et klikk.

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import QRCode from "react-qr-code";

type Started = {
  sessionId: string;
  walletUri: string;
  expiresAt: string;
  mode: "mock" | "verifier";
  demoWallet: { queryId: string; label: string }[] | null;
};

type Poll =
  | { phase: string; status?: undefined }
  | { phase: string; status: "VERIFIED"; shared: string[] }
  | { phase: string; status: "REJECTED"; failures: { queryId: string | null; check: string | null; detail: string | null }[] }
  | { phase: string; status: "EXPIRED" };

type State =
  | { kind: "starting" }
  | { kind: "waiting"; started: Started; phase: string }
  | { kind: "done"; shared: string[] }
  | { kind: "rejected"; failures: { queryId: string | null; check: string | null; detail: string | null }[] }
  | { kind: "expired" }
  | { kind: "error"; message: string };

const PHASE_TEXT: Record<string, string> = {
  PENDING_REQUEST: "Venter på at lommeboka skanner koden …",
  REQUEST_DELIVERED: "Lommeboka har hentet forespørselen. Godkjenn delingen på telefonen.",
  RESPONSE_RECEIVED: "Svar mottatt, verifiserer …",
};

export function ShareCredentials() {
  const router = useRouter();
  const [state, setState] = useState<State>({ kind: "starting" });
  const [chosen, setChosen] = useState<Set<string>>(new Set());
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [attempt, setAttempt] = useState(0);

  const start = () => {
    setState({ kind: "starting" });
    setAttempt((n) => n + 1);
  };

  useEffect(() => {
    let cancelled = false;
    startSharing().then(
      (started) => {
        if (cancelled) return;
        setChosen(new Set(started.demoWallet?.map((entry) => entry.queryId) ?? []));
        setState({ kind: "waiting", started, phase: "PENDING_REQUEST" });
      },
      (error: unknown) => {
        if (!cancelled) setState({ kind: "error", message: error instanceof Error ? error.message : String(error) });
      },
    );
    return () => {
      cancelled = true;
    };
  }, [attempt]);

  useEffect(() => {
    if (state.kind !== "waiting") return;
    const { sessionId } = state.started;
    let cancelled = false;

    const tick = async () => {
      try {
        const response = await fetch(`/api/presentation/${sessionId}`, { cache: "no-store" });
        if (!response.ok) throw new Error(await errorText(response));
        const poll = (await response.json()) as Poll;
        if (cancelled) return;
        if (poll.status === "VERIFIED") {
          setState({ kind: "done", shared: poll.shared });
          setTimeout(() => router.push("/tjenester"), 600);
          return;
        }
        if (poll.status === "REJECTED") return setState({ kind: "rejected", failures: poll.failures });
        if (poll.status === "EXPIRED") return setState({ kind: "expired" });
        setState((previous) => (previous.kind === "waiting" ? { ...previous, phase: poll.phase } : previous));
        timer.current = setTimeout(tick, 1500);
      } catch (error) {
        if (!cancelled) setState({ kind: "error", message: error instanceof Error ? error.message : String(error) });
      }
    };
    timer.current = setTimeout(tick, 1000);
    return () => {
      cancelled = true;
      if (timer.current) clearTimeout(timer.current);
    };
    // Bare sesjons-id-en skal starte polling på nytt, ikke hver faseendring.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.kind === "waiting" ? state.started.sessionId : null]);

  const simulate = async () => {
    if (state.kind !== "waiting") return;
    const response = await fetch("/api/presentation/simulate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId: state.started.sessionId, queryIds: [...chosen] }),
    });
    if (!response.ok) setState({ kind: "error", message: await errorText(response) });
  };

  if (state.kind === "starting") return <Panel>Starter deling …</Panel>;
  if (state.kind === "error")
    return (
      <Panel tone="warn">
        <p className="font-medium">Fikk ikke kontakt med plattformen.</p>
        <p className="mt-1 break-words text-sm text-muted">{state.message}</p>
        <button onClick={start} className="btn-secondary mt-3">
          Prøv igjen
        </button>
      </Panel>
    );
  if (state.kind === "expired")
    return (
      <Panel tone="warn">
        <p className="font-medium">Koden gikk ut.</p>
        <button onClick={start} className="btn-secondary mt-3">
          Lag ny kode
        </button>
      </Panel>
    );
  if (state.kind === "rejected")
    return (
      <Panel tone="warn">
        <p className="font-medium">Verifieren godtok ikke delingen.</p>
        <ul className="mt-2 list-disc pl-5 text-sm text-muted">
          {state.failures.map((failure, index) => (
            <li key={index}>
              {failure.queryId ?? "ukjent bevis"}: {failure.check ?? "sjekk"} {failure.detail ? `(${failure.detail})` : ""}
            </li>
          ))}
        </ul>
        <button onClick={start} className="btn-secondary mt-3">
          Prøv igjen
        </button>
      </Panel>
    );
  if (state.kind === "done")
    return (
      <Panel tone="ok">
        <p className="font-medium">Bevisene er verifisert. Henter tjenestene dine …</p>
      </Panel>
    );

  const { started, phase } = state;
  return (
    <div className="grid gap-6 md:grid-cols-[auto_1fr]">
      <div className="card flex flex-col items-center gap-4">
        <div className="rounded-md bg-white p-3">
          <QRCode value={started.walletUri} size={208} />
        </div>
        <a href={started.walletUri} className="btn-secondary w-full">
          Åpne i lommeboka på denne enheten
        </a>
        <details className="w-full text-xs text-muted">
          <summary className="cursor-pointer">Lenken som tekst (lim inn i lommeboka)</summary>
          <code className="mt-2 block break-all rounded bg-bg p-2">{started.walletUri}</code>
        </details>
      </div>

      <div className="space-y-4">
        <Panel>
          <div className="flex items-center gap-2">
            <span className="size-2 animate-pulse rounded-full bg-brand" />
            <span className="text-sm">{PHASE_TEXT[phase] ?? phase}</span>
          </div>
        </Panel>

        {started.demoWallet ? (
          <div className="card space-y-3 border-dashed">
            <div>
              <div className="text-xs font-semibold uppercase tracking-wide text-accent">Demo-lommebok (mock-modus)</div>
              <p className="text-sm text-muted">Ingen telefon nødvendig. Velg hva «lommeboka» skal dele.</p>
            </div>
            <ul className="space-y-2">
              {started.demoWallet.map((entry) => (
                <li key={entry.queryId}>
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={chosen.has(entry.queryId)}
                      onChange={(event) => {
                        const next = new Set(chosen);
                        if (event.target.checked) next.add(entry.queryId);
                        else next.delete(entry.queryId);
                        setChosen(next);
                      }}
                    />
                    {entry.label}
                  </label>
                </li>
              ))}
            </ul>
            <button onClick={simulate} className="btn-primary" disabled={chosen.size === 0}>
              Del {chosen.size} bevis
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function Panel({ children, tone = "neutral" }: { children: React.ReactNode; tone?: "neutral" | "ok" | "warn" }) {
  const toneClass = tone === "ok" ? "bg-ok-soft border-ok/30" : tone === "warn" ? "bg-warn-soft border-warn/30" : "bg-surface border-line";
  return <div className={`rounded-lg border p-4 ${toneClass}`}>{children}</div>;
}

async function startSharing(): Promise<Started> {
  const response = await fetch("/api/presentation", { method: "POST" });
  if (!response.ok) throw new Error(await errorText(response));
  return (await response.json()) as Started;
}

async function errorText(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as { error?: string; detail?: string };
    return body.detail ? `${body.error}: ${body.detail}` : (body.error ?? `HTTP ${response.status}`);
  } catch {
    return `HTTP ${response.status}`;
  }
}
