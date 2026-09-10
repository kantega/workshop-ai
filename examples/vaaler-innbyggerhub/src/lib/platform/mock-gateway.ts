// Mock-gateway: samme grensesnitt som verifieren, men «lommeboka» er en knapp på skjermen.
// Brukes uten rigg. Sesjonene bor i minnet på dev-serveren (globalThis, så de overlever HMR).

import { randomUUID } from "node:crypto";
import type { PresentedCredential } from "@/lib/catalog/credentials";
import {
  PlatformError,
  type SharingPhase,
  type SharingResult,
  type SimulatableGateway,
  type StartOptions,
  type StartedSharing,
} from "./types";

type MockSession = {
  id: string;
  phase: SharingPhase;
  expiresAt: Date;
  continuationUri?: string;
  result?: SharingResult;
};

const SESSION_TTL_MS = 10 * 60 * 1000;

declare global {
  var __vaalerMockSessions: Map<string, MockSession> | undefined;
}

const sessions: Map<string, MockSession> = (globalThis.__vaalerMockSessions ??= new Map());

export class MockGateway implements SimulatableGateway {
  readonly mode = "mock" as const;

  async start(options: StartOptions = {}): Promise<StartedSharing> {
    const id = randomUUID();
    const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
    sessions.set(id, { id, phase: "PENDING_REQUEST", expiresAt, continuationUri: options.continuationUri });
    return {
      sessionId: id,
      walletUri: `openid4vp://?client_id=mock-vaaler&request_uri=${encodeURIComponent(`mock://presentation-requests/${id}`)}`,
      expiresAt: expiresAt.toISOString(),
    };
  }

  async phase(sessionId: string): Promise<SharingPhase> {
    return this.find(sessionId).phase;
  }

  async result(sessionId: string): Promise<SharingResult> {
    const session = this.find(sessionId);
    if (!session.result) throw new PlatformError(404, "", `Sesjonen ${sessionId} er ikke avgjort`);
    return session.result;
  }

  async simulate(sessionId: string, credentials: PresentedCredential[]): Promise<void> {
    const session = this.find(sessionId);
    session.phase = "VERIFIED";
    session.result = { status: "VERIFIED", credentials, unknownQueryIds: [] };
  }

  private find(sessionId: string): MockSession {
    const session = sessions.get(sessionId);
    if (!session) throw new PlatformError(404, "", `Ukjent sesjon ${sessionId}`);
    if (session.phase !== "VERIFIED" && session.expiresAt < new Date()) {
      session.phase = "EXPIRED";
      session.result = { status: "EXPIRED" };
    }
    return session;
  }
}
