import { readConfig } from "./config";
import { MockGateway } from "./mock-gateway";
import type { PresentationGateway } from "./types";
import { VerifierGateway } from "./verifier-gateway";

declare global {
  var __vaalerGateway: PresentationGateway | undefined;
}

/** Én gateway per prosess. Modus velges av PLATFORM_MODE. */
export function gateway(): PresentationGateway {
  if (!globalThis.__vaalerGateway) {
    const config = readConfig();
    globalThis.__vaalerGateway = config.mode === "verifier" ? new VerifierGateway(config) : new MockGateway();
    console.info(`[platform] Gateway: ${config.mode}${config.mode === "verifier" ? ` (studio ${config.studioUrl}, verifier ${config.verifierUrl})` : ""}`);
  }
  return globalThis.__vaalerGateway;
}

export { readConfig } from "./config";
export type * from "./types";
export { isSimulatable, TERMINAL_PHASES } from "./types";
