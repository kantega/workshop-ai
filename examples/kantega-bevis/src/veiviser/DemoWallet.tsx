import { useState } from "react";
import { CREDENTIAL_BY_ID, type PresentedCredential, type QueryId } from "../catalog";
import { DEMO_PERSONAS, demoCredentials } from "./demo-personas";

/**
 * «Lat som du delte»: velg testperson og bevis, og gå rett til tjenestene. Trenger verken
 * plattform eller telefon. Merket tydelig som demo, så ingen tror det er den ekte reisen.
 */
export function DemoWallet({ onShared }: { onShared: (credentials: PresentedCredential[]) => void }) {
  const [personaId, setPersonaId] = useState(DEMO_PERSONAS[0].id);
  const persona = DEMO_PERSONAS.find((candidate) => candidate.id === personaId) ?? DEMO_PERSONAS[0];
  const [chosen, setChosen] = useState<Set<QueryId>>(() => new Set(persona.wallet.map((entry) => entry.queryId)));

  const pick = (id: string) => {
    const next = DEMO_PERSONAS.find((candidate) => candidate.id === id) ?? DEMO_PERSONAS[0];
    setPersonaId(next.id);
    setChosen(new Set(next.wallet.map((entry) => entry.queryId)));
  };

  const toggle = (queryId: QueryId) =>
    setChosen((previous) => {
      const next = new Set(previous);
      if (next.has(queryId)) next.delete(queryId);
      else next.add(queryId);
      return next;
    });

  return (
    <details className="vk-demo">
      <summary>
        <span className="pill pill-warn">Demo</span> Lat som du delte bevis, uten telefon
      </summary>
      <div className="vk-demo-body">
        <p className="small muted">Velger du en testperson her, hopper du over QR-koden. Bevisene er oppdiktet, resten av reisen er ekte.</p>
        <label className="vk-demo-field">
          <span>Testperson</span>
          <select value={personaId} onChange={(event) => pick(event.target.value)}>
            {DEMO_PERSONAS.map((candidate) => (
              <option key={candidate.id} value={candidate.id}>
                {candidate.name} · {candidate.tagline}
              </option>
            ))}
          </select>
        </label>
        <ul className="vk-demo-list">
          {persona.wallet.map((entry) => (
            <li key={entry.queryId}>
              <label>
                <input type="checkbox" checked={chosen.has(entry.queryId)} onChange={() => toggle(entry.queryId)} />
                <span>{CREDENTIAL_BY_ID[entry.queryId].label}</span>
              </label>
            </li>
          ))}
        </ul>
        <button className="btn btn-primary" disabled={chosen.size === 0} onClick={() => onShared(demoCredentials(persona, chosen))}>
          Del {chosen.size} bevis som {persona.name.split(" ")[0]}
        </button>
      </div>
    </details>
  );
}
