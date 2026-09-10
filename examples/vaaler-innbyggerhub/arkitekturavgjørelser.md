# Arkitekturavgjørelser — Våler innbyggerhub

> ADR-logg. Nyeste øverst.

## [3] Én fremvisningsregel med valgfrie credential_sets — 2026-09-10
**Status:** valgt

**Kontekst**
Innbyggeren skal dele «det hun har» i én fremvisning, og hubben skal foreslå tjenester ut fra hva
som kom. DCQL kan uttrykke dette på flere måter.

**Alternativer vurdert**
- A: Én regel per tjeneste, innbyggeren deler per tjeneste. Presist, men mange QR-skanninger.
- B: Én regel som krever alle bevis. Feiler for alle som mangler ett.
- C: Én regel med alle kjente bevistyper som hvert sitt `credential_set` med `required: false`.

**Valg**
C. Verifieren (`Dcql.kt`) og Bevis Studios wire-modell støtter det allerede; statusnotatet anbefalte det.

**Konsekvenser**
- Positivt: én skanning, hubben leser `presentations[].queryId` og regner.
- Negativt: iOS-lommeboka sender ett bevis per svar; flere bevis krever Bevisboka (web) eller mock.
- Avveininger: hubben må tåle tomt svar (VERIFIED med null bevis).

## [2] Gateway-interface med mock og verifier — 2026-09-10
**Status:** valgt

**Kontekst**
Hackathon uten garantert rigg. Demoen må virke på én laptop, og koden må likevel være klar for
den ekte plattformen.

**Valg**
`PresentationGateway` (start / phase / result) med `MockGateway` og `VerifierGateway`, valgt av
`PLATFORM_MODE`. Sidene kjenner bare interfacet. Mock har i tillegg `simulate`.

**Konsekvenser**
- Positivt: hele UI-flyten kan testes uten rigg; byttet er én env-variabel.
- Negativt: to kodestier å holde i takt. Resultatmappingen er felles og testet.

## [1] Eget repo, kundeveien, Next.js — 2026-09-10
**Status:** valgt

**Kontekst**
Portalen er Våler kommunes system, ikke en app i Kantega-monorepoet.

**Alternativer vurdert**
- A: App under `apps/` i monorepoet. Nær koden, men feil eier og fristende med interne snarveier.
- B: Eget repo som bruker plattformen som en integrasjonspartner. Workspace-default (Next.js).

**Valg**
B. Bare `/oauth/token`, Bevis Studios `/v1/*` og verifierens `/v1/presentation-sessions`.

**Konsekvenser**
- Positivt: det vi demoer er det en kommune faktisk kan bygge.
- Negativt: må registrere integrasjonsklient mot en rigg som krever legitimasjon.
- Migrering: ingen; lokal kjøring er hele scopet.
