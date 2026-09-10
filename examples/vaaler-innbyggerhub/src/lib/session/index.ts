// Innbyggerens økt i hubben: hvem hun er logget inn som, og hvilke bevis hun har delt.
// Cookie med tilfeldig id, innholdet i minnet på serveren. Godt nok lokalt og på et hackathon;
// bytt lageret her hvis det noen gang skal lenger.

import { randomUUID } from "node:crypto";
import { cookies } from "next/headers";
import type { CredentialQueryId, PresentedCredential } from "@/lib/catalog/credentials";
import { findTestPerson, type TestPerson } from "./test-persons";

export type HubSession = {
  id: string;
  personId: string | null;
  /** Verifierens (eller mockens) sesjons-id for pågående deling. */
  sharingSessionId: string | null;
  /** Delte bevis, ett per queryId. Nyeste deling vinner. */
  credentials: PresentedCredential[];
  sharedAt: string | null;
};

const COOKIE = "vaaler_hub";

declare global {
  var __vaalerSessions: Map<string, HubSession> | undefined;
}
const store: Map<string, HubSession> = (globalThis.__vaalerSessions ??= new Map());

/** Leser økten uten å opprette en. */
export async function currentSession(): Promise<HubSession | null> {
  const id = (await cookies()).get(COOKIE)?.value;
  return id ? (store.get(id) ?? null) : null;
}

/** Leser eller oppretter økten. Kan bare kalles der cookies kan settes (route handler / server action). */
export async function ensureSession(): Promise<HubSession> {
  const jar = await cookies();
  const existing = jar.get(COOKIE)?.value;
  if (existing && store.has(existing)) return store.get(existing)!;
  const session: HubSession = { id: randomUUID(), personId: null, sharingSessionId: null, credentials: [], sharedAt: null };
  store.set(session.id, session);
  jar.set(COOKIE, session.id, { httpOnly: true, sameSite: "lax", path: "/" });
  return session;
}

export async function currentPerson(): Promise<TestPerson | null> {
  const session = await currentSession();
  return findTestPerson(session?.personId ?? undefined);
}

/** Bytter innlogget person. Delte bevis tilhører personen og nullstilles ved bytte. */
export async function switchPerson(personId: string): Promise<HubSession> {
  const session = await ensureSession();
  if (session.personId !== personId) {
    session.personId = personId;
    session.credentials = [];
    session.sharedAt = null;
    session.sharingSessionId = null;
  }
  return session;
}

export function mergeCredentials(session: HubSession, incoming: PresentedCredential[]): void {
  const byId = new Map<CredentialQueryId, PresentedCredential>(session.credentials.map((c) => [c.queryId, c]));
  for (const credential of incoming) byId.set(credential.queryId, credential);
  session.credentials = [...byId.values()];
  session.sharedAt = new Date().toISOString();
}

export async function endSession(): Promise<void> {
  const jar = await cookies();
  const id = jar.get(COOKIE)?.value;
  if (id) store.delete(id);
  jar.delete(COOKIE);
}
