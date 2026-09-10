# kantega-bevis — KS-sandkassen lokalt, Kantegas bevisplattform i testmiljøet

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

Åpne <http://localhost:5173>. Øverst står fire lamper. De to KS-lampene skal si «svarer»; de to
plattformlampene skal si «svarer» **og** «bærer» med scopene tokenet fikk. Panelet viser
kommandoen som fikser det som mangler. Deretter, tre paneler nedover: «Hent testpersoner» →
velg en (`person-001` Maja Solberg er et trygt valg) → «Gi samtykke og hent inntekt» → «Utsted
til lommebok» → «Ny fremvisning».

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

## Hva som er verifisert, og hva som ikke er det

**Hele reisen er kjørt ende til ende 2026-09-09**, med en ekte klient og en ekte lommebok på
telefon: bevistypen opprettes, utstederen og verifieren får sertifikatene sine, tilbudet havner i
lommeboka, og verifieren dømmer fremvisningen `VERIFIED`. Den leverte `navn`, `ordning`,
`inntektsaar` og `kvalifisert: ja` — og **ikke** `beregningsbeloep`, som ligger i beviset, men som
regelen ikke ber om. Det er hele poenget, og det er nå målt.

KS-siden (`src/ks.ts`) er kjørt mot en levende sandkasse: `person-001` gir inntektsår 2025,
485 000 kr og «rett til redusert betaling».

**Ikke verifisert:** DigDirs demolommebok — se «Lommebok» over. Bruk vår.

## Bygg videre med Claude Code

Denne appen er ett bevis og én reise. Din er en annen, og veien dit er å kopiere mønsteret. Bytt ut
det som står i vinkelparenteser:

```text
Jeg er på KS-hackathon og skal bygge videre på appen i examples/kantega-bevis.

Les disse først, i denne rekkefølgen:
- examples/kantega-bevis/README.md — hvordan appen henger sammen
- examples/kantega-bevis/src/api.ts — ALLE kallene mot plattformen, og ensureSetup()
- examples/kantega-bevis/src/App.tsx — reisen: sandkasse → utstedelse → fremvisning
- examples/kantega-bevis/server/platform-auth.ts — token per tjeneste

Oppgaven: <hva appen skal gjøre, i to–tre setninger>

Beviset skal hete «<Bevisnavn>» og bære claimene <claim1, claim2, claim3>.
Fremvisningen skal be om <delmengden mottakeren faktisk trenger> — og aldri
<det følsomme som ligger i beviset, men ikke skal utleveres>.

Regler:
- Kopier mønsteret i src/api.ts. Alt går kundeveien: bare API-er en
  integrasjonspartner også har. Trenger du noe som ikke finnes, si fra —
  ikke finn på et endepunkt.
- ensureSetup() er finn-eller-opprett og må forbli idempotent. Den kjøres på
  hver sidelast.
- Ikke rør server/platform-auth.ts, og ikke flytt klient-id eller hemmelighet
  inn i nettleseren. Hemmeligheten er nok til å opptre som organisasjonen min.
- Claims fra en fremvisning er VILKÅRLIG JSON, ikke strenger: beviset bærer
  alltid iss, vct, iat, exp og status ved siden av sine egne, og status er et
  nøstet objekt. Bruk PresentedClaims og somTekst() slik App.tsx gjør.
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
