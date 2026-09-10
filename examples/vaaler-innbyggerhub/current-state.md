# Current state — Våler innbyggerhub

> Levende dokument. Oppdateres når status endrer seg, ikke i ettertid.

## Hva prosjektet er

Innbyggerportal for Våler kommune til KS-hackathonet: logg inn, del flere bevis fra lommeboka i
én fremvisning, få forslag til kommunale tjenester du kan søke på. Vålers eget system, snakker
med Kantega-plattformen utenfra (kundeveien). Kun lokal kjøring.

## Status akkurat nå

- **Fase:** PoC / hackathon
- **Sist oppdatert:** 2026-09-10
- **Eier:** Michael

## Hva som er på plass

- [x] Next.js 16 (App Router) + TS + Tailwind v4, vitest. Eget git-repo (ingen commits, ingen remote).
- [x] Bevis-katalog (5 typer), tjenestekatalog (8 Våler-tjenester med krav), kvalifiseringsmotor med tester.
- [x] `PresentationGateway` med to implementasjoner: `mock` (default) og `verifier`.
- [x] Verifier-gateway: token via `/oauth/token` (client_secret, per `resource`), idempotent rigging av
      bevistyper + fremvisningsregel i Bevis Studio (DCQL med valgfrie `credential_sets`), sesjon/poll/resultat,
      same-device `continuationUri`, demo-utstedelse.
- [x] Sider: `/`, `/logg-inn` (stub, 4 testpersoner), `/del-bevis` (QR + polling + demo-lommebok), `/tjenester`,
      `/del-bevis/fortsett`, `/demo-bevis` (verifier-modus).
- [x] Mock-flyten verifisert ende til ende med curl mot `next start`. `check`, `lint`, `test`, `build` grønne.

## Hva som jobbes på nå

- [ ] Ingenting pågående.

## Hva som er neste

- [ ] Kjøre verifier-modus mot riggen. Ikke testet mot ekte rigg ennå; kontrakten er lest fra kildekoden
      (`VerificationController.kt`, `VerifierJson.kt`, `DcqlWire.kt`, `VerificationRuleController.kt`).
- [ ] Sjekke at verifieren godtar et svar der alle `credential_sets` er `required: false` og lommeboka sender
      et delmengde. Bevisboka (web) håndterer det; iOS-lommeboka sender kun ett bevis (se prosjektnotat).
- [ ] Visuell gjennomgang i nettleser (kun testet via curl/HTML).
- [ ] Ekte Våler-tjenester og søknadslenker; nå er `applyUrl` kommunens forside.

## Kjente problemer / tekniske gjeld

- Økt og mock-sesjoner bor i minnet. Restart av dev-serveren nullstiller alt. Med vilje.
- `npm install` trengte `--legacy-peer-deps` (arborist-feil på peer-sett med vitest 4 + eslint-config-next 16).
- Fremvisningsregelen finnes per navn (`VERIFICATION_RULE_NAME`); to hubber mot samme organisasjon deler regel.
- `normalizeClaims` gjør `"true"`/`"false"` om til boolean; verifieren kan gi claims som tekst.

## Hvordan kjøre lokalt

```bash
npm install --legacy-peer-deps
npm run dev                 # mock-modus
cp .env.example .env.local  # PLATFORM_MODE=verifier mot riggen
```

## Avhengigheter til andre systemer / personer

- Kantega-plattformen (Bevis Studio 8080, verifier 8095, eller KS-portene). Kun i verifier-modus.
- Lommebok: Bevisboka (web) for flere bevis; iOS-lommeboka gir ett bevis per svar.

## Lenker

- Repo: lokalt, `projects/vaaler-innbyggerhub/` (ikke pushet)
- Plattform-docs: monorepoet `docs/integrasjon/kom-i-gang-med-api-et.md`, `apps/ks-hackathon/OPPSTART.md`
