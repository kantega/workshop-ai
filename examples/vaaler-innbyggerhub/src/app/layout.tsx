import type { Metadata } from "next";
import Link from "next/link";
import { currentPerson } from "@/lib/session";
import { logOut } from "@/lib/session/actions";
import "./globals.css";

export const metadata: Metadata = {
  title: "Våler innbyggerhub",
  description: "Del bevis fra lommeboka di og se hvilke kommunale tjenester du kan søke på.",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const person = await currentPerson();
  return (
    <html lang="nb">
      <body className="min-h-screen flex flex-col">
        <header className="bg-brand text-brand-ink">
          <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-4">
            <Link href="/" className="flex items-center gap-3">
              <span className="grid size-9 place-items-center rounded-full bg-white/15 text-lg font-bold">V</span>
              <span>
                <span className="block text-sm/tight opacity-80">Våler kommune</span>
                <span className="block font-semibold">Innbyggerhub</span>
              </span>
            </Link>
            {person ? (
              <form action={logOut} className="flex items-center gap-3 text-sm">
                <span className="opacity-90">{person.name}</span>
                <button type="submit" className="rounded-md border border-white/40 px-3 py-1.5 hover:bg-white/10">
                  Logg ut
                </button>
              </form>
            ) : null}
          </div>
        </header>
        <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-8">{children}</main>
        <footer className="border-t border-line px-4 py-6 text-center text-xs text-muted">
          Hackathon-prototype. Innlogging og bevis er testdata. Ingen data lagres utover økten.
        </footer>
      </body>
    </html>
  );
}
