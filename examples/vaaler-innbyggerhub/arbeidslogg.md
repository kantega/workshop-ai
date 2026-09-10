# Arbeidslogg — Våler innbyggerhub

> Kronologisk dagbok. Nyeste øverst.

---

## 2026-09-10 — Første økt: hele reisen i mock-modus, verifier-gateway skrevet

**Hva ble gjort**
- Scaffoldet prosjektet (Next.js 16, TS strict + `noUncheckedIndexedAccess`, Tailwind v4, vitest).
- Katalog: 5 bevistyper (pid, inntekt, legeerklaering, foererkort, elevbevis), 8 Våler-tjenester med krav
  og betingelser (alder, bosted, boolean-claims, gyldighet). Kvalifiseringsmotor med 7 tester.
- Plattformlag: `PresentationGateway`-interface, DCQL-bygger (ett valgfritt `credential_set` per bevis),
  mock-gateway, verifier-gateway med token-klient (`client_secret_basic`, per `resource`), idempotent
  rigging av regel i Bevis Studio, resultatmapping med tester.
- Sider og API-ruter. Cookie-økt i minnet. Same-device-fortsettelse. Demo-utstedelse i verifier-modus.
- Verifisert mock-flyten med curl: login → start → poll → simulate → poll → /tjenester gir riktig sortering.

**Hvorfor**
Hackathon-case «Våler innbygger hub». Statusnotatet fra kartleggingen anbefalte valgfrie
`credential_sets` framfor «alt du har»; det er lagt til grunn. Portalen er Vålers, derfor eget repo
og kun kunde-API-er.

**Åpne tråder**
- Verifier-modus er skrevet mot kildekoden, ikke kjørt. Feltnavnene er sjekket mot `VerifierJson.kt`
  og `StudioJson.kt` (`query`, `verifierId`, `status`, `credentialTypeId`), men første kjøring mot riggen
  vil likevel avdekke noe.
- iOS-lommeboka deler kun ett bevis per svar. Demo med flere bevis må gå via Bevisboka (web) eller mock.

**Neste**
- `PLATFORM_MODE=verifier` mot `./gradlew dev`, rett opp det som knekker, logg det her.

**Filer som ble berørt**
- Alt. Se `current-state.md`.

---
