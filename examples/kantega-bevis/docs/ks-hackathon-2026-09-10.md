# KS-hackathon 10.–11. september 2026: slik kommer dere i gang

Til teamet som skal på KS' AI-hackathon torsdag og fredag. Dette er de tre tingene dere skal ha
klare, i den rekkefølgen dere trenger dem: KS-sandkassen med appen vår i, lommeboka på telefonen,
og `reisen.http` for dere som vil se hvert API-kall.

**Plattformen vår kjører i testmiljøet, ikke lokalt.** Dere trenger verken `./gradlew dev` eller
tunnel på hackathonet. Det som trengs er en integrasjonsklient, og den lager dere selv.

## Kvelden før (20 minutter, det meste er nedlasting)

### 1. Klon forken og start sandkassen

Vi har forket KS' repo til <https://github.com/kantega/workshop-ai>. Appen vår ligger på branchen
`kantega-bevis` i `examples/kantega-bevis/`.

```bash
git clone -b kantega-bevis https://github.com/kantega/workshop-ai.git
cd workshop-ai
./start.sh --mock
```

Krever Docker. Første gang laster den ned images i 4–7 minutter, derfor kvelden før. `--mock`
kjører uten språkmodell; API-ene appen bruker trenger den ikke. Suksess er `✅ Ready` og grønt
på <http://localhost:3001>. Stopp med `./start.sh -d`.

**Har du en lokal rigg oppe, stopp den.** Sandkassen krever 8080–8087, 3000 og 3001 ledige og
nekter å starte ellers.

### 2. Lag en integrasjonsklient i kontrollflata

Logg inn på <https://design.dev2.bevisstudio.no>. Har teamet ingen organisasjon der, registrer én
og del den: utsteder og verifier opprettes automatisk. Lag så **én klient per person** under
**Organisasjon → Integrasjonsklienter**, siden hemmeligheten vises én gang og ikke skal deles i
en chat:

| Felt | Verdi |
|---|---|
| Navn | `ks-hackathon <ditt navn>` |
| Autentisering | **`client_secret`** |
| Skoper | alle i lista under |
| Snevring til utstedere | ingen |

```
issuers:read  verifiers:read
credential-types:read  credential-types:write
issuance-rules:read  issuance-rules:write
verification-rules:read  verification-rules:write
access-certificates:read  access-certificates:write
issuance:read  issuance:write  deploy:read  deploy:write
verification:write  presentations:read  presentations:write
```

Ta vare på `cli_…` og `cs_…`.

### 3. Start appen

```bash
cd examples/kantega-bevis
cp .env.example .env.local        # lim inn EIDAS_CLIENT_ID og EIDAS_CLIENT_SECRET
npm install
npm run dev
```

Åpne <http://localhost:5173>. Fire lamper øverst skal si «svarer», og de to plattformlampene
skal i tillegg si «bærer» med skopene tokenet fikk. Sier en lampe noe annet, står kommandoen som
fikser det rett under. Feilsøkingen i appens `README.md` dekker de fem feilene som finnes.

### 4. Lommeboka på telefonen

Installer TestFlight fra App Store, og deretter lommeboka vår:
<https://testflight.apple.com/join/VRKXvPRA>. Utstederen i testmiljøet er nåbar fra internett,
så telefonen skanner QR-kodene rett fra skjermen.

## På dagen: reisen

1. **Hent testpersoner** → velg `person-001` Maja Solberg → **Gi samtykke og hent inntekt**.
   Appen starter en prosessøkt i sandkassen, spoler fram til samtykkesteget, registrerer
   samtykket og henter tallene: inntektsår 2025, 485 000 kr, «rett til redusert betaling».
2. **Utsted til lommebok** → skann QR-en med telefonen. Beviset «Inntektsbekreftelse» legges i
   lommeboka, utstedt av `issuer-kantega-sandkasse` i testmiljøet.
3. **Ny fremvisning** → skann QR-en. Verifieren dømmer beviset, og appen viser claimene som kom
   ut: navn, ordning, inntektsår, kvalifisert. **Aldri beløpet.** Det er poenget dere skal vise.

Kjør reisen én gang før dere begynner å bygge. Da vet dere at klienten, organisasjonen og
lommeboka henger sammen, og feil dere treffer etterpå er deres egne.

## `reisen.http`: hvert kall for seg

For dere som vil se hva appen gjør, eller bygge noe annet enn den: `reisen.http` i denne mappa
er de samme ti stegene som enkeltkall, og den går nå mot testmiljøet.

1. Åpne [`reisen.http`](reisen.http) i IntelliJ og velg miljøet **`test`** i
   [`http-client.env.json`](http-client.env.json). Adressene er fylt ut; lim inn `clientId` og
   `clientSecret` fra klienten din. **Ikke commit fila etterpå.**
2. Hopp over steg 1 (registrering er en medlemsflate, og klienten har dere alt). Kjør steg 0 og
   2a/2b: du får ett token for bevisstudio og ett for verifieren. Ett token gjelder én tjeneste.
3. Kjør 3–10 ovenfra og ned. Hvert steg fanger id-ene det neste trenger. Steg 7 og 8 skriver ut
   de to lommeboklenkene; lag QR av dem eller lim dem inn i lommeboka.

I testmiljøet er alt skarpt, i motsetning til lokalt: 401 er feil token eller feil `resource`,
404 er «finnes ikke, er ikke din, eller du mangler skopet». Sjekk `scope` i tokensvaret før du
feilsøker en 404.

## Det vi ikke har fått verifisert

Vær ærlige med dere selv om dette når noe ikke virker på dagen:

- **Reisen med en ekte klient mot testmiljøet er ikke kjørt ennå.** Metadata, helsesjekker og
  token-endepunktets feilform er verifisert; selve oppsettet av bevistype og regler er det ikke.
  Den første som kjører steg 1–3 kvelden før er den som ser om det holder. Si fra i kanalen.
- **At verifieren i testmiljøet får tilgangssertifikat automatisk.** Appen ber om plattformens
  standardsertifikat hvis verifieren mangler et aktivt. Feiler det, sier appen hva du skal gjøre
  i kontrollflata.
- **At TestFlight-lommeboka godtar beviset.** Utstederen i test signerer under DigDirs EAA-CA,
  som lommeboka har innebygd, så det skal gå. Gjør det ikke det, er det Kantega-siden som må
  fikses, ikke noe dere skal jobbe rundt.

## Kart

| Hva | Hvor |
|---|---|
| Forken med appen | <https://github.com/kantega/workshop-ai>, branch `kantega-bevis` |
| Appens egen oppskrift og feilsøking | `examples/kantega-bevis/README.md` i forken |
| Kontrollflata i test | <https://design.dev2.bevisstudio.no> |
| Lommebok for iPhone | <https://testflight.apple.com/join/VRKXvPRA> |
| Enkeltkallene | [`reisen.http`](reisen.http) + [`http-client.env.json`](http-client.env.json), miljø `test` |
| API-kontrakten | [`kom-i-gang-med-api-et.md`](../kom-i-gang-med-api-et.md) |
| KS' egen deltakerstart | `docs/deltakerstart.md` i forken |
