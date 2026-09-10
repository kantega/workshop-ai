# Overlevering: Personlig veiviser for Våler kommune

Til deg som overtar. Kort versjon først, detaljer i `README.md` (kjøring), `docs/BEVIS.md`
(bevisene) og kommentarene i `src/catalog.ts` (reglene).

## Hva dette er

En innbyggerportal for Våler kommune, bygget til KS-hackathonet, oppå Kantegas eIDAS2-plattform.
Innbyggeren skanner én QR-kode med lommeboka, deler de bevisene hun har (alle valgfrie), og får
kommunens tjenester sortert i «kan søke nå», «nesten i mål» og «har du ikke rett på», med
vurderingen linje for linje: hvilket bevis, hvilken regel, hva beviset sa. Hun huker av og søker
samlet.

Portalen er Vålers eget system og snakker med plattformen **utenfra, kundeveien**: bare API-er en
integrasjonspartner har (`/oauth/token`, Bevis Studios `/v1/*`, verifierens
`/v1/presentation-sessions`). Ingen interne snarveier. Skal noe mangle, er det plattformen som
utvides, ikke denne appen.

## Kom i gang

```bash
cd examples/kantega-bevis
npm install                 # kjør på DIN maskin, ikke i en sandkasse (Rollup henter plattformbinær)
npm run dev                 # http://localhost:5173
```

- **Uten plattform:** forsiden virker. QR-kortet sier fra at testmiljøet ikke svarer, og
  «Demo: lat som du delte bevis» lar deg velge en testperson og hoppe rett til tjenestene.
- **Med plattform:** `cp .env.example .env.local`, legg inn en integrasjonsklient fra
  <https://design.dev2.bevisstudio.no> (Organisasjon → Integrasjonsklienter, `client_secret`,
  «Velg alle scopes»). Restart `npm run dev`. Første last rigger 12 bevistyper og regelen
  «Personlig veiviser 2026» i organisasjonen din. Verktøypanelet på `#/verktoy` viser status og
  legger testbevis i en ekte lommebok.
- Sjekk: `npm run check` (tsc) og `npm run build`.

## Kart

| Fil | Hva | Rør denne når |
|---|---|---|
| `src/catalog.ts` | Bevistyper, tjenester med krav, inntektsgrenser, kvalifiseringsmotor (`assess`) | Nytt bevis, ny tjeneste, endret regel eller sats |
| `src/api.ts` | Kundeveien: `ensureVeiviser` og `ensureSetup` (rigger typer + regel idempotent), sesjon, poll, resultat | Kobling mot plattformen |
| `server/platform-auth.ts` | Dev-server-middleware: token per tjeneste, hemmeligheten når aldri nettleseren | Auth |
| `src/App.tsx` | Ruting (`/`, `#/tjenester`, `#/kvittering`, `#/verktoy`, `/debug`), økt i minnet, personbytte | Flyt |
| `src/veiviser/Veiviser.tsx` | Forsiden: QR-kortet «Skann med lommeboka di» med statuser, «Dette spør vi lommeboka om», demo-lommebok | UI forside |
| `src/veiviser/Tjenester.tsx` | Tjenestesiden: oppsummering, pakker, kort med vurderingslinjer, bunnlinje | UI tjenester |
| `src/veiviser/Kvittering.tsx` | Kvittering | UI |
| `src/veiviser/presentation.ts` | Verifierens svar → bevis (på `queryId`, fallback `vct`) | Resultatform |
| `src/veiviser/demo-personas.ts` | Testpersonene i demo-lommeboka | Nye demoer |
| `src/veiviser/veiviser.css` | Våler-stilen, scopet under `.vk` | Utseende |
| `src/Verktoy.tsx` | Workshop-panelet (status, KS-sandkasse, utsted, fremvis, testbevis) | Rigging |
| `src/ks.ts` | KS-sandkassen (inntekt, samtykke) | KS-flyten |

## Slik virker reglene

- Én fremvisningsregel, alle 12 bevis som hvert sitt `credential_set` med `required: false`.
  Verifieren godkjenner uansett hvor mange som kom; appen leser `presentations[].queryId`.
- Krav per tjeneste: `req` (må deles), `opt` (brukes hvis delt; kan utelukke, f.eks. «eier bolig»),
  `anyOf` (ett av flere, hvert med egen betingelse). Betingelser har `test()` og `evidence()`;
  motoren returnerer `checks[]` som UI-et viser rett fram. Ny regel = ny forklaring, gratis.
- Et delt bevis som sier nei vinner over et bevis som mangler («har du ikke rett på» framfor
  «del ett til»).
- **`test()` har tre svar, ikke to.** `"ukjent"` betyr at beviset er delt, men ikke svarer på
  spørsmålet - claimen ble ikke bedt om, eller lommeboka holdt den tilbake. Da er tjenesten
  «nesten i mål», aldri «har du ikke rett på»: et avslag vi ikke har dekning for er den verste
  feilen portalen kan gjøre. `both()` arver «ukjent», men ett ekte nei slår alt. Alle
  betingelsene svarer «ukjent» når claimen de leser mangler helt; `excludes()` er unntaket, for
  der ER det å ha delt beviset hele poenget.
- Inntekt: beviset godtas hvis det er laget for akkurat ordningen og sier «kvalifisert: ja»
  (KS-caset). Fremvisningen ber **ikke** om `beregningsbeloep`, så grensene i `INNTEKTSGRENSER`
  kan ikke måles direkte. Følgen: én inntektsbekreftelse åpner bare sin egen ordning, og de sju
  andre inntektsgrensede tjenestene havner i «nesten i mål». Det er personvernpoenget som koster
  det, og valget er tatt med åpne øyne - `incomeBelow` leser fortsatt beløpet hvis en lommebok
  skulle dele det frivillig.
- Pakker (`package` på tjenesten): når ≥2 klare tjenester deler pakke, vises de samlet og
  forhåndsavkrysset.

## To flater, to rigger, og hvorfor de ikke kolliderer

`Verktoy.tsx` kjører `ensureSetup` (én bevistype, «Inntektsbekreftelse», regelen «Redusert
foreldrebetaling — innsjekk») og deretter `ensureVeiviser` (hele katalogen, regelen «Personlig
veiviser»). Rekkefølgen er med vilje: begge vil finne-eller-opprette «Inntektsbekreftelse», og
kjørte de samtidig ville den ene tapt på duplikat.

Begge går gjennom `reconcileRule`, som leser hva regelen faktisk spør om før den gjenbrukes.
Uten den peker en regel som finnes fra før fortsatt på den gamle `vct`-en når du bytter bevistype
eller claim-liste, alt ser grønt ut, og lommeboka svarer `request_data_no_document` først når noen
skanner. Feilmeldingen navngir de to `vct`-ene når den ikke får rettet opp selv.

Regelnavnet på linje 52 i `Verktoy.tsx` bærer en tankestrek. Den står der fordi regler slås opp på
navn: retter du tegnet, mister du regelen som allerede finnes i organisasjonen din.

**Navnet er en nøkkel, og det er en rømningsvei.** Finnes regelen fra før og spør etter noe annet,
retter `reconcileRule` den - men et abonnement som bare tillater å OPPRETTE regler svarer 403
(`not-in-access-plan`) på oppdateringen, og da står den gamle regelen i veien. Kommer du ikke til
i kontrollflata for å slette den, bump `VEIVISER_RULE` i stedet. Det er derfor den heter
«Personlig veiviser 2026»: forgjengeren ba førerkortet om `klasser` alene, uten `gyldig_til`, og
kunne ikke rettes.

## Det som IKKE er verifisert

1. **Innbyggerflata mot det ekte testmiljøet.** Appen er typesjekket og bygget, og demo-lommeboka
   tar hele reisen uten plattform, men ingen har kjørt `ensureVeiviser` med gyldig `.env.local`.
   Første kjøring vil avdekke ting: feltnavn er sjekket mot plattformens kildekode, men verifieren
   i testmiljøet kan være eldre enn koden i monorepoet (da mangler `queryId`; fallback på `vct`
   finnes i `src/veiviser/presentation.ts`).
2. **Inntektsgrensene** i `INNTEKTSGRENSER` er 2025-satser etter hukommelsen. Sjekk de nasjonale
   (foreldrebetaling, gratis kjernetid) mot regjeringen.no; resten er kommunens å sette.
3. **Bostøtte-grensen** avhenger egentlig av husstandsstørrelse og kommunegruppe; her er den
   én sats.
4. **iOS-lommeboka deler ett bevis per skanning.** «Del flere bevis» på tjenestesiden er veien;
   Bevisboka (web) deler flere i én.

Den gamle enkeltbevis-reisen i verktøypanelet **er** kjørt ende til ende med ekte klient og
lommebok, 2026-09-09. Se «Hva som er verifisert» i `README.md`.

## Kjente forenklinger

- Økten bor i minnet. Reload = start på nytt. Med vilje.
- «Søk om valgte» sender ingenting; kvitteringen er en prototype med oppdiktet referanse.
- `Barn i husstanden` bærer bare yngste og eldste; aldersspenn sjekkes som overlapp.
- Alle claims er tekst («ja»/«nei»), fordi plattformens test-utstedelse tar strenger.

## Forslag til neste steg

1. Kjør mot testmiljøet med ekte klient, rett det som knekker, logg det i README.
2. Verifiser satsene. `beregningsbeloep` er allerede ute av regelen; det som gjenstår er
   motstykket: én inntektsbekreftelse per ordning fra Skatteetaten, så de sju andre
   inntektsgrensede tjenestene kan nås igjen uten at beløpet utleveres.
3. Kjedede bevis: når kommunen innvilger, utsted et bevis på vedtaket (TT-kort → honnør,
   bostøtte → strømstøtte). Utstedelse finnes allerede i `api.ts` (`orderCredential`).
4. Mobil: fungerer, men ikke finpusset under 400 px.

## Design

Figma: fila «Hackathon», side «Våler innbyggerhub» (tre skjermer + stilguide). Farger og logo
fra valer.kommune.no; fonten deres (Centra No1) er proprietær, DM Sans/system er stand-in.
Figma viser 5 bevis; koden har 12.
