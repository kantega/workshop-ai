import { type AppSpec } from "./api";

/**
 * Beviset denne appen utsteder. Legg merke til hva fremvisningsregelen IKKE ber om:
 * beregningsbeløp står i beviset, men kommunen får det aldri. Den får «kvalifisert: ja» for
 * riktig ordning og år — som er alt vedtaket trenger. Det er hele poenget med å la innbyggeren
 * fremvise et bevis framfor at kommunen slår opp inntekten.
 *
 * Både forsiden og /debug bruker den samme spec-en, så de peker på den samme bevistypen og den
 * samme fremvisningsregelen i organisasjonen.
 */
export const SPEC: AppSpec = {
  credentialTypeName: "Inntektsbekreftelse",
  claims: [
    { name: "navn", dataType: "STRING", mandatory: true },
    { name: "ordning", dataType: "STRING", mandatory: true },
    { name: "inntektsaar", dataType: "STRING", mandatory: true },
    { name: "kvalifisert", dataType: "STRING", mandatory: true },
    { name: "beregningsbeloep", dataType: "STRING", mandatory: false },
  ],
  rule: {
    name: "Redusert foreldrebetaling — innsjekk",
    queryId: "inntektsbekreftelse",
    requestedClaims: ["navn", "ordning", "inntektsaar", "kvalifisert"],
  },
};
