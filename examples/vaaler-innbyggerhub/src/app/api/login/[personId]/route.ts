// Snarvei for demo og skript: GET /api/login/kari logger inn som testpersonen og sender videre.
// Samme effekt som skjemaet på /logg-inn.

import { NextResponse } from "next/server";
import { switchPerson } from "@/lib/session";
import { findTestPerson } from "@/lib/session/test-persons";

export async function GET(request: Request, context: { params: Promise<{ personId: string }> }): Promise<NextResponse> {
  const { personId } = await context.params;
  if (!findTestPerson(personId)) return NextResponse.json({ error: `Ukjent testperson «${personId}»` }, { status: 404 });
  await switchPerson(personId);
  return NextResponse.redirect(new URL("/del-bevis", request.url), 303);
}
