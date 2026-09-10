import { NextResponse } from "next/server";
import { PlatformError } from "./types";

/** Én måte å svare på når plattformen feiler, så klienten kan vise noe fornuftig. */
export function platformFailure(error: unknown): NextResponse {
  if (error instanceof PlatformError) {
    console.error("[platform]", error.message);
    return NextResponse.json({ error: "Plattformen svarte med feil", detail: error.message }, { status: 502 });
  }
  const message = error instanceof Error ? error.message : String(error);
  console.error("[platform]", message);
  return NextResponse.json({ error: message }, { status: 500 });
}
