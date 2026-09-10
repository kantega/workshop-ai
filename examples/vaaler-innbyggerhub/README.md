# Våler innbyggerhub

Innbyggeren logger inn, deler bevis fra den digitale lommeboka si, og får se hvilke av kommunens
tjenester hun kan søke på nå, hva som mangler, og hva som ikke er aktuelt. Hackathon-prototype
bygget på Kantega-plattformen (eIDAS 2.0 / OpenID4VP), kundeveien.

## Kjør lokalt

```bash
npm install
npm run dev        # http://localhost:3000
```

Uten konfigurasjon kjører hubben i **mock-modus**: ingen rigg, «lommeboka» er en knapp på
skjermen. Hele reisen kan demoes på én maskin.

### Mot riggen (verifier-modus)

```bash
cp .env.example .env.local     # sett PLATFORM_MODE=verifier
```

Krever en kjørende rigg (`./gradlew dev` i monorepoet). Første deling rigger hubbens
fremvisningsregel i Bevis Studio: bevistypene i `src/lib/catalog/credentials.ts` finnes eller
opprettes, `vct` hentes fra utstedelsesregelens deployment, og DCQL-en bygges med ett valgfritt
`credential_set` per bevis. Sett `VERIFICATION_RULE_ID` for å bruke en regel laget for hånd.

Mot en rigg som krever legitimasjon: registrer en integrasjonsklient i Bevis Studio
(Organisasjon → Integrasjonsklienter, `client_secret`) med skopene i
`src/lib/platform/studio-client.ts`, og sett `EIDAS_CLIENT_ID` / `EIDAS_CLIENT_SECRET`.

`/demo-bevis` legger testpersonens bevis i en ekte lommebok (QR-tilbud fra riggens utsteder).

**Telefon:** en ekte lommebok når ikke `localhost`. Bruk riggens tunnel
(`docs/lokal-utvikling.md` § «Navngitt tunnel» i monorepoet) og sett `BEVISSTUDIO_URL`,
`VERIFIER_URL` og `PUBLIC_BASE_URL` deretter. Uten telefon: lim lenken inn i lommebokas
`/textInputPage`.

## Reisen

1. `/logg-inn` — ID-porten-stub, velg testperson (hver har sin lommebok).
2. `/del-bevis` — QR-kode (`openid4vp://…`), polling av verifierens fase, same-device-knapp.
   Mock-modus: demo-lommebok med avkrysning.
3. `/tjenester` — tjenestene sortert: klar / mangler bevis / ikke aktuelt, med begrunnelse.

Snarvei for demo og skript: `GET /api/login/kari` logger inn som Kari.

## Sjekk

```bash
npm run check   # tsc
npm run lint
npm test        # vitest: kvalifiseringsmotor, DCQL, resultatmapping
```

## Legge til en tjeneste eller et bevis

- Ny tjeneste: én oppføring i `src/lib/catalog/services.ts` med `requirements`.
- Nytt bevis: én oppføring i `src/lib/catalog/credentials.ts` (queryId, navn i Bevis Studio,
  claims å be om). Regelen i Bevis Studio oppdateres av seg selv neste gang hubben starter en
  deling (PATCH når DCQL-en avviker).
