// Grensesnittet hubben ser plattformen gjennom. To implementasjoner: mock (uten rigg) og
// verifier (ekte Bevis Studio + verifier, kundeveien). Sidene og route-handlerne kjenner bare
// dette grensesnittet.

import type { CredentialQueryId, PresentedCredential } from "@/lib/catalog/credentials";

export type PlatformMode = "mock" | "verifier";

export type StartedSharing = {
  sessionId: string;
  /** `openid4vp://…`-lenken lommeboka skal åpne. Vises som QR og som knapp på samme enhet. */
  walletUri: string;
  expiresAt: string;
};

/** Speiler verifierens SessionPhase. */
export type SharingPhase =
  | "PENDING_REQUEST"
  | "REQUEST_DELIVERED"
  | "RESPONSE_RECEIVED"
  | "VERIFIED"
  | "REJECTED"
  | "EXPIRED";

export type SharingFailure = { queryId: string | null; check: string | null; detail: string | null };

export type SharingResult =
  | {
      status: "VERIFIED";
      credentials: PresentedCredential[];
      /** Presentasjoner med query-id hubben ikke kjenner. Logges, brukes ikke. */
      unknownQueryIds: string[];
    }
  | { status: "REJECTED"; failures: SharingFailure[] }
  | { status: "EXPIRED" };

export type StartOptions = {
  /**
   * Same-device-flyt (OID4VP §8.2): lommeboka sender nettleseren hit etterpå, med en
   * `response_code` som første resultatoppslag må bevise.
   */
  continuationUri?: string;
};

export interface PresentationGateway {
  readonly mode: PlatformMode;
  start(options?: StartOptions): Promise<StartedSharing>;
  phase(sessionId: string): Promise<SharingPhase>;
  result(sessionId: string, responseCode?: string): Promise<SharingResult>;
}

/** Bare mock-gatewayen har denne: «lommeboka» svarer uten telefon. */
export interface SimulatableGateway extends PresentationGateway {
  simulate(sessionId: string, credentials: PresentedCredential[]): Promise<void>;
}

export function isSimulatable(gateway: PresentationGateway): gateway is SimulatableGateway {
  return "simulate" in gateway;
}

export const TERMINAL_PHASES: ReadonlySet<SharingPhase> = new Set(["VERIFIED", "REJECTED", "EXPIRED"]);

export class PlatformError extends Error {
  constructor(
    readonly status: number,
    readonly body: string,
    message: string,
  ) {
    super(message);
  }
}

export type VctByQueryId = Partial<Record<CredentialQueryId, string>>;
