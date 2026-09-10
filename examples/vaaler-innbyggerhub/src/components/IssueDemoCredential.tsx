"use client";

import { useState } from "react";
import QRCode from "react-qr-code";
import type { Claims } from "@/lib/catalog/credentials";

export function IssueDemoCredential({ queryId, label, claims }: { queryId: string; label: string; claims: Claims }) {
  const [state, setState] = useState<{ kind: "idle" } | { kind: "busy" } | { kind: "offer"; offerUri: string } | { kind: "error"; message: string }>({ kind: "idle" });

  const issue = async () => {
    setState({ kind: "busy" });
    const response = await fetch("/api/demo/issue", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ queryId }),
    });
    if (!response.ok) {
      const body = (await response.json().catch(() => ({}))) as { error?: string; detail?: string };
      return setState({ kind: "error", message: body.detail ?? body.error ?? `HTTP ${response.status}` });
    }
    const offer = (await response.json()) as { offerUri: string };
    setState({ kind: "offer", offerUri: offer.offerUri });
  };

  return (
    <div className="card space-y-3">
      <div className="font-semibold">{label}</div>
      <dl className="grid grid-cols-[auto_1fr] gap-x-3 text-xs text-muted">
        {Object.entries(claims).map(([name, value]) => (
          <div key={name} className="contents">
            <dt className="font-mono">{name}</dt>
            <dd>{String(value)}</dd>
          </div>
        ))}
      </dl>
      {state.kind === "offer" ? (
        <div className="flex flex-col items-center gap-2">
          <div className="rounded-md bg-white p-2">
            <QRCode value={state.offerUri} size={160} />
          </div>
          <a href={state.offerUri} className="text-sm text-brand underline">
            Åpne i lommeboka på denne enheten
          </a>
        </div>
      ) : (
        <button onClick={issue} className="btn-secondary" disabled={state.kind === "busy"}>
          {state.kind === "busy" ? "Utsteder …" : "Legg i lommeboka"}
        </button>
      )}
      {state.kind === "error" ? <p className="text-sm text-warn">{state.message}</p> : null}
    </div>
  );
}
