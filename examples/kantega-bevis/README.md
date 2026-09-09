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
| Skoper | lista under |
| Snevring til utstedere | ingen |

Skopene appen bruker:

```
issuers:read  verifiers:read
credential-types:read  credential-types:write
issuance-rules:read  issuance-rules:write
verification-rules:read  verification-rules:write
access-certificates:read  access-certificates:write
issuance:read  issuance:write  deploy:read  deploy:write
verification:write  presentations:read  presentations:write
```

Du får en klient-id (`cli_…`) og en hemmelighet (`cs_…`). **Hemmeligheten vises én gang.** Den
er nok til å opptre som organisasjonen din: ikke i et repo, ikke i en chat.

> **Skjemaet i kontrollflata tilbyr ikke alle skopene (per 2026-09-09).** Det viser åtte grupper,
> og `access-certificates`, `credentials`, `issuance`, `deploy`, `verification` og `presentations`
> er ikke blant dem. En klient fra skjemaet stopper derfor med `404` på
> `/v1/access-certificates`. Omveien til det er rettet: registrer klienten i skjemaet med
> **Integrasjonsklienter: skrive** avkrysset, og bruk den til å registrere den egentlige klienten
> med alle skopene via API-et. To kall:
>
> ```bash
> TOKEN=$(curl -s -X POST https://bevisstudio.agreeabledune-b07a297d.norwayeast.azurecontainerapps.io/oauth/token \
>   -u 'cli_<fra-skjemaet>:cs_<fra-skjemaet>' \
>   --data-urlencode grant_type=client_credentials \
>   --data-urlencode resource=https://bevisstudio.agreeabledune-b07a297d.norwayeast.azurecontainerapps.io | python3 -c 'import sys,json;print(json.load(sys.stdin)["access_token"])')
> ```
>
> ```bash
> curl -s -X POST https://bevisstudio.agreeabledune-b07a297d.norwayeast.azurecontainerapps.io/v1/integration-clients \
>   -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' -d '{
>   "name": "ks-workshop <ditt navn>",
>   "authentication": { "method": "CLIENT_SECRET" },
>   "allowedScopes": ["issuers:read","verifiers:read","credential-types:read","credential-types:write",
>     "issuance-rules:read","issuance-rules:write","verification-rules:read","verification-rules:write",
>     "access-certificates:read","access-certificates:write","issuance:read","issuance:write",
>     "deploy:read","deploy:write","verification:write","presentations:read","presentations:write"],
>   "scopeRestriction": null }'
> ```
>
> Svaret har `clientId` og `clientSecret` for den nye klienten. Det er DEN som skal i `.env.local`.

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
plattformlampene skal si «svarer» **og** «bærer» med skopene tokenet fikk. Panelet viser
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
- **404 betyr tre ting** — finnes ikke, er ikke din, eller du mangler skopet — og de er
  uskillbare med vilje. Sjekk skopene i statuspanelet før du feilsøker en 404.

Appen bruker `client_secret_basic` og Bearer-token, den korte veien. Plattformen støtter også
`private_key_jwt` med DPoP-bundne tokens, som gjør et stjålet token verdiløst — men den veien
krever at plattformen kan hente appens JWKS over offentlig https, altså en tunnel per deltaker.
På en workshop er det den ene tingen som stjeler formiddagen. Prisen for den korte veien: et
lekket token kan brukes til det utløper. Derfor når hemmeligheten likevel aldri nettleseren.

`/app-api/status` er dev-serverens eget statusbilde: om tjenestene svarer, om tokenet bærer, og
hvilke skoper det fikk. Det er det statuspanelet leser.

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

**404 på noe som finnes** — du mangler skopet. Sammenlign skopene i statuspanelet med lista over.

**KS-lampene nede** — `./start.sh --mock` i KS-repoet. Sandkassen krever at 8080–8087, 3000 og
3001 er ledige, og nekter å starte ellers.

**«Fikk ikke rigget opp plattformen»** — se statuspanelet: bærer tokenet, og har det skopene?
Sier meldingen at organisasjonen mangler utsteder eller verifier, opprett dem i kontrollflata.

## Hva som er verifisert, og hva som ikke er det

**Verifisert 2026-09-09, uten legitimasjon:** testmiljøets metadatadokument, helsesjekker på
tjenestene og token-endepunktets feilform (`401 invalid_client`). Appen starter, `npm run check`
er grønn, statuspanelet viser «ikke satt opp» uten `.env.local` og «avvist» med feil hemmelighet.

**Ikke verifisert:** selve reisen med en ekte klient. Den første som kjører med gyldig
`.env.local` er den som ser at bevistypen opprettes, at verifieren får plattformens
tilgangssertifikat, og at en telefon-lommebok når tilbudet. KS-siden (`src/ks.ts`) er kjørt mot
en levende sandkasse tidligere: `person-001` gir inntektsår 2025, 485 000 kr og «rett til
redusert betaling».

## Hva dette er, og ikke er

En startpakke og et mønster, ikke et produkt: ingen innlogging i appen, ingen persistens.
Appen går kundeveien — bare API-er en integrasjonspartner også har. Trenger dere noe som ikke
finnes, er det plattformen som skal utvides, ikke denne appen.
