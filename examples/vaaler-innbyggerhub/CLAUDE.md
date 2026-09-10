# Våler innbyggerhub

Les `current-state.md` først, så siste poster i `arbeidslogg.md`. Workspace-konvensjonene i
`../../CLAUDE.md` og `../../base-knowledge/` gjelder.

## Kort

Innbyggerportal for Våler kommune (hackathon-prototype). Innbyggeren logger inn, deler bevis fra
lommeboka si, og får se hvilke kommunale tjenester hun kan søke på. Portalen er Vålers eget
system og snakker med Kantega-plattformen **utenfra, kundeveien**: bare API-er en
integrasjonspartner også har.

## Kart

- `src/lib/catalog/` — bevistyper (`credentials.ts`), tjenester med krav (`services.ts`),
  kvalifiseringsmotor (`eligibility.ts`). Ren logikk, testet.
- `src/lib/platform/` — grensesnittet mot plattformen (`types.ts`), DCQL-bygger (`dcql.ts`),
  `mock-gateway.ts` (uten rigg) og `verifier-gateway.ts` (Bevis Studio + verifier via
  `studio-client.ts`). Valg i `index.ts` styrt av `PLATFORM_MODE`.
- `src/lib/session/` — innbyggerens økt (cookie + minne) og testpersonene.
- `src/app/` — sidene: `/` → `/logg-inn` → `/del-bevis` → `/tjenester`. API under `src/app/api/`.

## Regler

- Ingen interne snarveier inn i plattformen. Trenger hubben noe som ikke finnes i kunde-API-et,
  er det plattformen som skal utvides, ikke hubben som skal jukse.
- Be aldri om flere claims enn tjenestereglene bruker. `beregningsbeloep` skal aldri inn i DCQL-en.
- `npm run check && npm run lint && npm test` før du sier deg ferdig.
