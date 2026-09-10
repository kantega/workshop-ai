# Overlevering: Våler innbyggerhub

Kort versjon for deg som overtar. Detaljer i `README.md` (kjøring), `current-state.md` (status),
`arkitekturavgjørelser.md` (hvorfor) og `arbeidslogg.md` (hva som er gjort når).

## Hva dette er

Innbyggerportal for Våler kommune til KS-hackathonet. Innbyggeren logger inn, deler flere bevis fra
den digitale lommeboka si i én fremvisning, og får se hvilke kommunale tjenester hun kan søke på nå,
hvilke hun mangler ett bevis til, og hvilke som ikke er aktuelle.

Portalen er Vålers eget system. Den snakker med Kantega-plattformen (Bevis Studio + verifier)
**utenfra, kundeveien**: bare API-er en integrasjonspartner også har. Ingen interne snarveier.

## Kom i gang på 5 minutter

```bash
npm install --legacy-peer-deps   # vanlig npm install feiler på et peer-sett, ikke vår kode
npm run dev                      # http://localhost:3000
```

Uten konfigurasjon kjører du **mock-modus**: ingen rigg, «lommeboka» er avkrysningsbokser på skjermen.
Logg inn som Kari, del begge bevisene, se `/tjenester`. Prøv Ola og Emma etterpå.

Sjekk at alt er grønt: `npm run check && npm run lint && npm test`.

## Kart over koden

| Mappe | Hva | Rør denne når |
|---|---|---|
| `src/lib/catalog/credentials.ts` | Bevistypene hubben ber om (queryId, navn i Bevis Studio, claims) | Nytt bevis |
| `src/lib/catalog/services.ts` | Vålers tjenester med krav og betingelser | Ny tjeneste, endret regel |
| `src/lib/catalog/eligibility.ts` | Motoren: klar / mangler / ikke aktuelt | Sjelden. Har tester |
| `src/lib/platform/types.ts` | `PresentationGateway`, grensesnittet sidene bruker | Aldri, helst |
| `src/lib/platform/mock-gateway.ts` | Lommebok-simulator | Demo-behov |
| `src/lib/platform/verifier-gateway.ts` | Ekte: rigger regel i Bevis Studio, sesjon, poll, resultat | Kobling mot riggen |
| `src/lib/platform/studio-client.ts` | Token (`/oauth/token`, client_secret, per `resource`) + HTTP | Auth-problemer |
| `src/lib/platform/dcql.ts` | Bygger DCQL: ett valgfritt `credential_set` per bevis | Endret spørrestrategi |
| `src/lib/session/` | Cookie-økt i minnet, testpersoner | Nye testpersoner |
| `src/app/` | Sidene: `/` → `/logg-inn` → `/del-bevis` → `/tjenester`. API under `api/` | UI |

Én env-variabel bytter alt: `PLATFORM_MODE=mock|verifier`. Se `.env.example`.

## Det viktigste du må vite

1. **Verifier-modus er skrevet, ikke kjørt.** Kontrakten er lest fra plattformens kildekode
   (feltnavn sjekket), men ingen har startet hubben mot en rigg ennå. Første oppgave: gjør det.
2. **Én regel, alle bevis valgfrie.** Regelen i Bevis Studio ber om alle kjente bevistyper som
   hvert sitt `credential_set` med `required: false`. Hubben leser hvilke `queryId`-er som kom
   tilbake. Regelen rigges av seg selv første gang (`VERIFICATION_RULE_ID` overstyrer).
3. **iOS-lommeboka deler ett bevis per svar.** «Del mange bevis i én skanning» virker med Bevisboka
   (web-lommeboka) og mock. Avklar hvilken lommebok demoen skal bruke før dere bygger mer.
4. **Be aldri om mer enn tjenestene bruker.** `beregningsbeloep` ligger i inntektsbeviset, men skal
   aldri inn i DCQL-en. Det er poenget med hele caset.

## Første oppgave: kjør mot riggen

1. Start riggen i monorepoet (`./gradlew dev`). Med KS-sandkassen ved siden av: bruk portene i
   `apps/ks-hackathon/OPPSTART.md` (studio på 8060).
2. `cp .env.example .env.local`, sett `PLATFORM_MODE=verifier` og evt. `BEVISSTUDIO_URL`.
3. Restart `npm run dev`, logg inn, gå til `/del-bevis`. Terminalen skal si
   `[platform] Opprettet fremvisningsregelen «Våler innbyggerhub»`.
4. `/demo-bevis` legger testpersonens bevis i en ekte lommebok (QR-tilbud). Deretter `/del-bevis`
   og lim `openid4vp://`-lenken inn i lommebokas `/textInputPage`.
5. Det som knekker: logg i `arbeidslogg.md`, rett i `verifier-gateway.ts`.

Telefon når ikke `localhost`. Trengs telefon: riggens tunnel (`docs/lokal-utvikling.md` i monorepoet)
og sett `BEVISSTUDIO_URL`, `VERIFIER_URL`, `PUBLIC_BASE_URL` deretter.

## Plattform-dokumentasjon du trenger

I monorepoet:
- `docs/integrasjon/kom-i-gang-med-api-et.md` — token, skoper, feilkoder
- `docs/integrasjon/lommeboka-for-de-som-bygger-oppaa.md` — hvorfor du aldri kaller lommeboka
- `apps/ks-hackathon/OPPSTART.md` — rigg + KS-sandkasse side om side
- `apps/template/src/api.ts` — samme kundevei, referanseimplementasjon

## Arbeidsform

Små steg. `npm run check && npm run lint && npm test` før push. Ny post i `arbeidslogg.md` per økt,
`current-state.md` oppdatert når status endrer seg. ADR bare ved reelle strukturvalg.
