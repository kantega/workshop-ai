"use server";

import { redirect } from "next/navigation";
import { ensureSession, endSession, switchPerson } from "./index";
import { findTestPerson } from "./test-persons";

export async function logInAs(formData: FormData): Promise<void> {
  const personId = String(formData.get("personId") ?? "");
  if (!findTestPerson(personId)) throw new Error(`Ukjent testperson «${personId}»`);
  await switchPerson(personId);
  redirect("/del-bevis");
}

export async function logOut(): Promise<void> {
  await endSession();
  redirect("/");
}

export async function forgetCredentials(): Promise<void> {
  const session = await ensureSession();
  session.credentials = [];
  session.sharedAt = null;
  redirect("/del-bevis");
}
