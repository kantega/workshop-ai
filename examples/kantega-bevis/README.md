# kantega-bevis - Personlig veiviser for Våler kommune, på Kantegas bevisplattform

To flater i én app:

- **`/` - innbyggerflata «Personlig veiviser».** Innbyggeren skanner én QR-kode med lommeboka,
  deler de bevisene hun har (alle valgfrie), og får tjenestene i Våler kommune sortert i «kan søke
  nå», «nesten i mål» og «ikke aktuelt». Hun huker av og søker samlet. Design og innhold følger
  Figma-fila «Hackathon» (farger og typografi fra valer.kommune.no).
- **`#/verktoy` - workshop-panelet** for oss som rigger demoen: statuslamper, KS-sandkassens
  inntektsvurdering, utstedelse til lommebok, fremvisning, og et panel som legger testbevis av alle
  typene i lommeboka. Den gamle adressen `/debug` går til samme panel.

QR-koden bor i kortet «Skann med lommeboka di» øverst til høyre på forsiden
([`src/veiviser/Veiviser.tsx`](src/veiviser/Veiviser.tsx)). Kortet starter en fremvisningssesjon
med én gang oppsettet er klart, tegner koden, poller verifieren, og sender innbyggeren videre til
tjenestene når bevisene er godkjent. Svarer ikke testmiljøet, sier kortet fra i stedet for å stå
tomt.

Innbyggerflata bruker **én fremvisningsregel, «Personlig veiviser 2026»** (`VEIVISER_RULE` i
`src/catalog.ts`), som ber om alle
bevistypene i [`src/catalog.ts`](src/catalog.ts) (12 stk.) som hvert sitt valgfrie
`credential_set` (`required: false`). Verifieren godkjenner uansett hvor mange som kom; appen
leser `presentations[].queryId` og regner. Regelen og bevistypene rigges idempotent i
organisasjonen din første gang siden lastes.

**Uten plattform:** forsiden virker uansett. QR-kortet sier fra hvis testmiljøet ikke svarer, og
«Demo: lat som du delte bevis» under det lar deg velge en testperson (Kari, Ola, Emma, Jonas) og
bevis, og hoppe rett til tjenestene. Bevisene er oppdiktet
([`src/veiviser/demo-personas.ts`](src/veiviser/demo-personas.ts)), resten av reisen er den samme.

**Demo-oppskrift:** `#/verktoy` → steg 1-2 gir Inntektsbekreftelse fra KS-sandkassen → steg 4
legger eID (bosted «Våler») i lommeboka → `/` → skann → se tjenestene → søk. Én ekte lommebok på
telefonen holder; Kantegas iOS-lommebok deler ett bevis per skanning, så «Del flere bevis» på
tjenestesiden er veien til flere.

Tjenestenes krav i `src/catalog.ts` er tre slags: `req` (må deles), `opt` (brukes hvis delt) og
`anyOf` (ett av flere holder, hvert med egen betingelse; bostøtte trenger ett bevis på
boutgiftene). Hvert krav sjekker INNHOLDET i beviset, ikke bare at det er delt: alder, bosted,
gyldighetsdato, førerkortklasse, og inntektsgrense per ordning (`INNTEKTSGRENSER`, 2025-satser
som må verifiseres).

**Inntektsbekreftelsen godtas på én måte: den ble laget for akkurat denne ordningen og sier
«kvalifisert: ja».** Fremvisningen ber ikke om `beregningsbeloep` - beløpet ligger i beviset, men
kommunen får det ikke, og det gjelder innbyggerflata like fullt som enkeltbevis-reisen. Prisen er
at én inntektsbekreftelse bare åpner sin egen ordning: de sju andre inntektsgrensede tjenestene
havner i «nesten i mål» og ber om et bevis for seg. Det er et bevisst valg, ikke en mangel - se
`incomeBelow` i `src/catalog.ts`.

Vurderingen vises linje for linje på hvert kort, med verdien fra beviset. 25 tjenester, tre «pakker» (`package`)
som vises samlet og forhåndsavkrysset når to eller flere av dem er klare: barnefamilie, bolig,
tilrettelegging. Skattemelding, lønnsslipp og NAV-vedtak er med vilje ikke egne bevis: de er
kildene bak Inntektsbekreftelsen.

Overtar du prosjektet: start med [`OVERLEVERING.md`](OVERLEVERING.md).
Oversikt over bevisene og claimene deres: [`docs/BEVIS.md`](docs/BEVIS.md).

Koden: `src/catalog.ts` (bevis, tjenester, kvalifiseringsmotor), `src/veiviser/` (sidene),
`src/api.ts` (`ensureVeiviser`, kundeveien), `src/Verktoy.tsx` (panelet).

---

## Bakgrunn: startpakka

Startpakke for en workshop der du bygger oppå Kantegas eIDAS2-plattform **slik en kunde gjør
det**: KS' AI-sandkasse ([`ks-no/workshop-ai`](https://github.com/ks-no/workshop-ai)) kjører på
maskinen din, plattformen kjører i Kantegas testmiljø, og appen kaller den med en
integrasjonsklient og et token. Du trenger ikke plattformens kildekode, ingen JVM, ingen tunnel.

Appen ligger i `examples/kantega-bevis/` i denne forken av `workshop-ai`, så du får den med klonen. Den er
frittstående: eget `package.json`, npm (ikke pnpm), og utenfor sandkassens pnpm-workspace.

## Reisen appen kjører

1. **Sandkassen regner ut retten.** For en testperson: start en prosessøkt for «redusert
   foreldrebetaling i barnehage», spol fram til samtykkesteget, registrer samtykke, hent
   husstandsinntekt og vilkårsvurdering. Alt mot KS' `tools-api` på 8083.
2. **Utstederen legger svaret i lommeboka.** Bevistypen «Inntektsbekreftelse» rigges idempotent i
   organisasjonen din i testmiljøet og utstedes forhåndsautorisert, som QR-kode.
3. **Kommunen ber om beviset.** Verifieren dømmer fremvisningen. Regelen ber om `navn`,
   `ordning`, `inntektsaar` og `kvalifisert` — **aldri `beregningsbeloep`**. Beløpet ligger i
   beviset, men kommunen får det ikke. Det er forskjellen på at kommunen slår opp inntekten din
   og at du viser fram at du kvalifiserer.

## Kom i gang

### 1. Registrer en integrasjonsklient (én gang, i kontrollflata)

Logg inn på <https://design.dev2.bevisstudio.no>. Har du ingen organisasjon der, registrerer du
en; den får utsteder og verifier automatisk. Gå til **Organisasjon → Integrasjonsklienter** og
opprett en klient:

| Felt | Verdi |
|---|---|
| Navn | noe du kjenner igjen, f.eks. `ks-workshop <ditt navn>` |
| Autentisering | **`client_secret`** |
| Scopes | knappen **«Velg alle scopes»** |
| Snevring til utstedere | ingen |

Scopene appen bruker:

```
issuers:read  verifiers:read
credential-types:read  credential-types:write
issuance-rules:read  issuance-rules:write
verification-rules:read  verification-rules:write
certificates:read  certificates:write
access-certificates:read  access-certificates:write
issuance:read  issuance:write  deploy:read  deploy:write
verification:write  presentations:read  presentations:write
```

Du får en klient-id (`cli_…`) og en hemmelighet (`cs_…`). **Hemmeligheten vises én gang.** Den
er nok til å opptre som organisasjonen din: ikke i et repo, ikke i en chat.

Sertifikatene til utstederen og verifieren trenger du ikke tenke på: appen adopterer Kantegas
sandkassesertifikat for begge første gang den kjører, og sier hva du skal gjøre hvis det feiler.

### 2. Legg legitimasjonen i `.env.local`

```bash
cp .env.example .env.local        # fyll inn EIDAS_CLIENT_ID og EIDAS_CLIENT_SECRET
```

`.env.local` er gitignored og leses bare av dev-serveren
([`server/platform-auth.ts`](server/platform-auth.ts)). Nettleseren ser aldri hemmeligheten.

### 3. Start KS-sandkassen

```bash
./start.sh --mock                 # fra rota av workshop-ai
```

`--mock` hopper over språkmodellen; API-ene appen bruker trenger den ikke. Første gang tar det
4–7 minutter nedlasting — gjør det hjemme. Krever Docker.

### 4. Start appen

```bash
cd examples/kantega-bevis
npm install
npm run dev
```

Åpne <http://localhost:5173>. Der møter du innbyggerflata: QR-kortet «Skann med lommeboka di»
starter en fremvisning av seg selv så snart oppsettet er ferdig.

Rigger du demoen, gå til <http://localhost:5173/#/verktoy> (eller den gamle adressen `/debug`).
Øverst står fire lamper. De to KS-lampene skal si «svarer»; de to plattformlampene skal si
«svarer» **og** «bærer» med scopene tokenet fikk. Panelet viser kommandoen som fikser det som
mangler. Deretter, fire paneler nedover: «Hent testpersoner» → velg en (`person-001` Maja Solberg
er et trygt valg) → «Gi samtykke og hent inntekt» → «Utsted til lommebok» → «Ny fremvisning», og
til slutt testbevis-panelet som legger alle 12 typene i lommeboka.

## Slik virker legitimasjonen

Kundeveien inn i plattformen er OAuth 2.0 `client_credentials`. Alt du trenger å vite:

- **Adressene leses, ikke antas.** `GET <bevisstudio>/.well-known/oauth-authorization-server`
  gir `token_endpoint` og `resources_supported`. Dev-serveren leser dem ved oppstart.
- **Ett token gjelder én tjeneste.** Du sier hvilken med `resource`. Et token for bevisstudio
  virker ikke mot verifieren, med vilje. Dev-serveren henter derfor ett token for `/api/studio`
  og ett for `/api/verifier`, cacher dem til de utløper, og prøver én gang på nytt ved 401.
- **Organisasjonen er aldri en parameter.** Den utledes av klient-id-en.
- **404 betyr tre ting** — finnes ikke, er ikke din, eller du mangler scopet — og de er
  uskillbare med vilje. Sjekk scopene i statuspanelet før du feilsøker en 404.

Appen bruker `client_secret_basic` og Bearer-token, den korte veien. Plattformen støtter også
`private_key_jwt` med DPoP-bundne tokens, som gjør et stjålet token verdiløst — men den veien
krever at plattformen kan hente appens JWKS over offentlig https, altså en tunnel per deltaker.
På en workshop er det den ene tingen som stjeler formiddagen. Prisen for den korte veien: et
lekket token kan brukes til det utløper. Derfor når hemmeligheten likevel aldri nettleseren.

`/app-api/status` er dev-serverens eget statusbilde: om tjenestene svarer, om tokenet bærer, og
hvilke scopes det fikk. Det er det statuspanelet leser.

## Lommebok

Utstederen i testmiljøet er nåbar fra internett, så **en lommebok på telefonen** virker uten
tunnel. Kantegas egen lommebok for iPhone ligger på TestFlight:
<https://testflight.apple.com/join/VRKXvPRA> (installer TestFlight fra App Store først). Skann
QR-koden i steg 2 for å motta beviset, og QR-koden i steg 3 for å vise det fram.

## Samtykkesperren, som er ekte

Inntekt er ikke fritt tilgjengelig i sandkassen. Både `get_household_income` og
`check_eligibility` svarer `403 {"feil": "Inntektsdata krever registrert samtykke."}` uten et
registrert samtykke. Samtykket henger på en **prosessøkt**, ikke på personen, og kan bare
opprettes mens økten står på `CONSENT_REQUEST`-steget. Kaller du `consent_response` på steg 0,
ignoreres den stille og du får `500 Kunne ikke opprette aktivt samtykke`. Appen spoler derfor
fram til samtykkesteget først (`advanceToConsent` i [`src/ks.ts`](src/ks.ts)) — og leter etter
steget framfor å telle, siden prosessdefinisjonene kan redigeres i sandkassen.

## Feilsøking

**Legitimasjon «ikke satt opp»** — `.env.local` mangler eller er tom. Start `npm run dev` på nytt
etter at du har fylt den ut; Vite leser `.env`-filer ved oppstart.

**Legitimasjon «avvist», `invalid_client`** — feil klient-id eller hemmelighet, eller
hemmeligheten er rotert. Endepunktet sier ikke hvilken, med vilje.

**Legitimasjon «avvist», `invalid_target`** — `EIDAS_VERIFIER_URL` står ikke i
`resources_supported`. Miljøet har flyttet; feilmeldingen viser hva som annonseres.

**404 på noe som finnes** — to årsaker, i denne rekkefølgen. Mangler du scopet, ser du det ved å
sammenligne statuspanelet med lista over. Er scopene på plass og svaret er en **404 med tom kropp
på en `POST`**, er klienten *snevret*: «Snevring til utstedere» ble satt da den ble registrert, og
en snevret klient kan ikke opprette noe som helst — ikke en bevistype, ikke en regel, ikke en ny
klient. Sjekk med `GET /v1/integration-clients`: er `scopeRestriction` noe annet enn `null`, må du
registrere en ny klient uten snevring. Feltet kan ikke redigeres i etterkant.

**KS-lampene nede** — `./start.sh --mock` i KS-repoet. Sandkassen krever at 8080–8087, 3000 og
3001 er ledige, og nekter å starte ellers.

**«Fikk ikke rigget opp plattformen»** — se statuspanelet: bærer tokenet, og har det scopene?
Sier meldingen at organisasjonen mangler utsteder eller verifier, opprett dem i kontrollflata.

**Lommeboka svarer `request_data_no_document`** — feilen kommer fra lommeboka, ikke fra appen: den
har lest forespørselen og funnet **ingenting å vise fram**. Fremvisningsregelen låser beviset til
én `vct` (`meta.vct_values`), så lommeboka tilbyr bare et bevis med nøyaktig den. Tre grunner, i
den rekkefølgen de er sannsynlige:

1. **Ingenting er utstedt til den telefonen ennå.** Forsiden (`/`) starter en fremvisning av seg
   selv så snart oppsettet er ferdig, og har ingen utstedelse. Beviset lages i verktøypanelet
   (`#/verktoy`, eller `/debug`): «Hent testpersoner» → «Gi samtykke og hent inntekt» →
   **«Utsted til lommebok»** (skann den QR-en først) → «Ny fremvisning». Vil du ha alle 12
   bevistypene i lommeboka på én gang, bruk testbevis-panelet nederst.
2. **Regelen peker på et gammelt bevis.** Regler gjenbrukes på navn; bytter du bevistype, utsteder
   eller claim-liste, spør den gamle regelen fortsatt etter den gamle `vct`-en. `reconcileRule` i
   `src/api.ts` oppdager avviket og skriver regelen på nytt - går ikke det, sier feilmeldingen
   hvilke `vct`-er som ikke stemmer og hva du skal gjøre. Det gjelder begge riggene: `ensureSetup`
   (ett bevis, verktøypanelet) og `ensureVeiviser` (hele katalogen, innbyggerflata).
3. **Lommeboka forstår ikke DCQL.** `mdoc-presentasjon feilet` i meldingen er den gamle
   ISO-18013/Presentation-Exchange-veien. En lommebok som er eldre enn OID4VP 1.0 leter etter
   `presentation_definition`, finner bare `dcql_query`, og ender på null dokumenter. Det er
   lommeboka som må oppdateres; appen kan ikke gjøre noe med det.

Skille 1 og 2 fra 3: hent forespørselen lommeboka faktisk får (bruk «Kopier forespørselen» i
verktøypanelet - `request_uri` er en engangshemmelighet, så start en fersk fremvisning først):

```bash
curl -s "<request_uri>" | cut -d. -f2 | base64 -d 2>/dev/null | jq
```

Står det `dcql_query` og ingen `presentation_definition`, er forespørselen riktig og feilen ligger
i punkt 1 eller 3.

## Hva som er verifisert, og hva som ikke er det

**Hele reisen er kjørt ende til ende 2026-09-09**, med en ekte klient og en ekte lommebok på
telefon: bevistypen opprettes, utstederen og verifieren får sertifikatene sine, tilbudet havner i
lommeboka, og verifieren dømmer fremvisningen `VERIFIED`. Den leverte `navn`, `ordning`,
`inntektsaar` og `kvalifisert: ja` — og **ikke** `beregningsbeloep`, som ligger i beviset, men som
regelen ikke ber om. Det er hele poenget, og det er nå målt.

KS-siden (`src/ks.ts`) er kjørt mot en levende sandkasse: `person-001` gir inntektsår 2025,
485 000 kr og «rett til redusert betaling».

**Ikke verifisert:** DigDirs demolommebok — se «Lommebok» over. Bruk vår.

**Ikke verifisert: innbyggerflata mot testmiljøet.** Veiviseren er typesjekket og bygget, og
demo-lommeboka tar hele reisen fra forsiden til kvittering uten plattform. Men ingen har kjørt
`ensureVeiviser` med gyldig `.env.local`, så første kjøring er den som ser om alle 12 bevistypene
rigges, og om verifieren i testmiljøet er ny nok til å svare med `queryId` per bevis. Er den ikke
det, kjenner appen beviset igjen på `vct` i stedet
([`src/veiviser/presentation.ts`](src/veiviser/presentation.ts)). Se
[`OVERLEVERING.md`](OVERLEVERING.md) for resten av forbeholdene.

## Bygg videre med Claude Code

Denne appen er én kommune og ett sett regler. Din er et annet, og veien dit er å kopiere
mønsteret. Bytt ut det som står i vinkelparenteser:

```text
Jeg er på KS-hackathon og skal bygge videre på appen i examples/kantega-bevis.

Les disse først, i denne rekkefølgen:
- examples/kantega-bevis/README.md — hvordan appen henger sammen
- examples/kantega-bevis/src/api.ts — ALLE kallene mot plattformen, ensureSetup()
  og ensureVeiviser()
- examples/kantega-bevis/src/catalog.ts — bevisene, tjenestene og reglene
- examples/kantega-bevis/src/veiviser/Veiviser.tsx — forsiden, og QR-kortet
- examples/kantega-bevis/src/Verktoy.tsx — riggeverktøyet: sandkasse →
  utstedelse → fremvisning
- examples/kantega-bevis/server/platform-auth.ts — token per tjeneste

Oppgaven: <hva appen skal gjøre, i to–tre setninger>

Beviset skal hete «<Bevisnavn>» og bære claimene <claim1, claim2, claim3>.
Fremvisningen skal be om <delmengden mottakeren faktisk trenger> — og aldri
<det følsomme som ligger i beviset, men ikke skal utleveres>.

Regler:
- Kopier mønsteret i src/api.ts. Alt går kundeveien: bare API-er en
  integrasjonspartner også har. Trenger du noe som ikke finnes, si fra —
  ikke finn på et endepunkt.
- ensureSetup() og ensureVeiviser() er finn-eller-opprett og må forbli
  idempotente. De kjøres på hver sidelast.
- Ikke rør server/platform-auth.ts, og ikke flytt klient-id eller hemmelighet
  inn i nettleseren. Hemmeligheten er nok til å opptre som organisasjonen min.
- Claims fra en fremvisning er VILKÅRLIG JSON, ikke strenger: beviset bærer
  alltid iss, vct, iat, exp og status ved siden av sine egne, og status er et
  nøstet objekt. Bruk PresentedClaims og claimText() slik catalog.ts gjør.
- Norsk i UI og kommentarer, engelsk i identifikatorer.

Verifiser før du sier deg ferdig: npx tsc --noEmit skal være ren, og du skal ha
kjørt reisen i nettleseren på http://localhost:5173 og sett den virke. Ikke be
meg sjekke — sjekk selv, og vis meg hva du så.
```

De fire linjene som betyr mest er filene å lese, «kopier mønsteret i `api.ts`», regelen om claims
som JSON, og kravet om å verifisere selv. Uten den siste får du kode som kompilerer og en påstand
om at den virker.

## Hva dette er, og ikke er

En startpakke og et mønster, ikke et produkt: ingen innlogging i appen, ingen persistens.
Appen går kundeveien — bare API-er en integrasjonspartner også har. Trenger dere noe som ikke
finnes, er det plattformen som skal utvides, ikke denne appen.
