# Bevisene i Personlig veiviser

Generert fra `src/catalog.ts` (12 bevistyper). Alle claims er tekst; booleans er «ja»/«nei», fordi
plattformens test-utstedelse tar strenger. Kolonnen «Bes om» sier om fremvisningsregelen «Personlig
veiviser» ber lommeboka om claimen. Står det «nei, blir i lommeboka», ligger verdien i beviset, men
kommunen får den aldri: beløp, diagnose og restgjeld. Det er poenget med modellen. Kommunen får
«kvalifisert: ja», ikke tallet.

Alle 12 bes om i én fremvisning, som hvert sitt valgfrie `credential_set`. Innbyggeren velger i
lommeboka hvilke hun deler.

| Bevis | Teknisk id | Utsteder | Gruppe |
|---|---|---|---|
| eID | `pid` | Folkeregisteret | Hvem du er |
| Barn i husstanden | `barn` | Folkeregisteret | Hvem du er |
| Inntektsbekreftelse | `inntektsbekreftelse` | Skatteetaten via KS-sandkassen | Inntekt og utdanning |
| Studentbevis | `studentbevis` | Lærestedet | Inntekt og utdanning |
| Elevbevis | `elevbevis` | Skolen | Inntekt og utdanning |
| Legeerklæring | `legeerklaering` | Fastlegen | Helse og transport |
| Førerkort | `foererkort` | Statens vegvesen | Helse og transport |
| Leiekontrakt | `leiekontrakt` | Utleier | Bolig |
| Felleskostnader | `felleskostnader` | Borettslaget eller sameiet | Bolig |
| Boliglån | `boliglaan` | Banken | Bolig |
| Eiendomsskatt og festeavgift | `eiendomsskatt` | Våler kommune | Bolig |
| Spesialtilpasset bolig | `tilpasset_bolig` | Kommunen | Bolig |

## Hvem du er

### eID  (`pid`)

Navn, fødselsdato og bostedskommune. Utstedt av Folkeregisteret. Bevistype i Bevis Studio: «eID».

| Claim | Påkrevd i beviset | Bes om | Eksempel |
|---|---|---|---|
| `given_name` | ja | ja | Maja |
| `family_name` | ja | ja | Solberg |
| `birthdate` | ja | ja | 1988-05-14 |
| `resident_municipality` | ja | ja | Våler |

### Barn i husstanden  (`barn`)

Hvor mange barn du har foreldreansvar for, og alderen på yngste og eldste. Utstedt av Folkeregisteret. Bevistype i Bevis Studio: «Barn i husstanden».

| Claim | Påkrevd i beviset | Bes om | Eksempel |
|---|---|---|---|
| `antall_barn` | ja | ja | 2 |
| `yngste_foedselsdato` | ja | ja | 2022-09-03 |
| `eldste_foedselsdato` | ja | ja | 2016-02-17 |

## Inntekt og utdanning

### Inntektsbekreftelse  (`inntektsbekreftelse`)

Om husstanden kvalifiserer til en inntektsavhengig ordning. Ikke beløpet. Utstedt av Skatteetaten via KS-sandkassen. Bevistype i Bevis Studio: «Inntektsbekreftelse».

| Claim | Påkrevd i beviset | Bes om | Eksempel |
|---|---|---|---|
| `navn` | ja | ja | Maja Solberg |
| `ordning` | ja | ja | redusert-foreldrebetaling-barnehage |
| `inntektsaar` | ja | ja | 2025 |
| `kvalifisert` | ja | ja | ja |
| `beregningsbeloep` | nei | nei, blir i lommeboka | 485000 |

Følgen er verdt å vite: uten beløpet kan en inntektsbekreftelse bare åpne den ordningen den ble
laget for, den som står i `ordning`. De sju andre inntektsgrensede tjenestene havner i «nesten i
mål» og ber om en inntektsbekreftelse for sin egen ordning. Det er den prisen personvernpoenget
koster, og den er betalt med vilje.

### Studentbevis  (`studentbevis`)

At du er student eller elev, og om du er i arbeidsrettet tiltak. Utstedt av Lærestedet. Bevistype i Bevis Studio: «Studentbevis».

| Claim | Påkrevd i beviset | Bes om | Eksempel |
|---|---|---|---|
| `laerested` | ja | ja | Høgskolen i Innlandet |
| `gyldig_til` | ja | ja | 2027-06-30 |
| `arbeidsrettet_tiltak` | ja | ja | nei |
| `studentnummer` | nei | nei, blir i lommeboka | 123456 |

## Helse og transport

### Legeerklæring  (`legeerklaering`)

Varig funksjonsnedsettelse eller nedsatt gangfunksjon. Ikke diagnosen. Utstedt av Fastlegen. Bevistype i Bevis Studio: «Legeerklæring funksjonsnedsettelse».

| Claim | Påkrevd i beviset | Bes om | Eksempel |
|---|---|---|---|
| `varig_funksjonsnedsettelse` | ja | ja | ja |
| `nedsatt_gangfunksjon` | ja | ja | ja |
| `gyldig_til` | ja | ja | 2028-06-30 |
| `diagnose` | nei | nei, blir i lommeboka | M17 |

### Førerkort  (`foererkort`)

Førerkortklasser. Utstedt av Statens vegvesen. Bevistype i Bevis Studio: «Førerkort».

| Claim | Påkrevd i beviset | Bes om | Eksempel |
|---|---|---|---|
| `klasser` | ja | ja | B |
| `gyldig_til` | ja | ja | 2031-05-14 |

Datoen bes om fordi to tjenester sjekker den: parkeringstillatelse og bilstønad krever begge at
førerkortet er gyldig, og det kan ikke avgjøres uten å se datoen. Raden sto som «nei, blir i
lommeboka» og var feil.

## Inntekt og utdanning

### Elevbevis  (`elevbevis`)

Skole og trinn. Utstedt av Skolen. Bevistype i Bevis Studio: «Elevbevis».

| Claim | Påkrevd i beviset | Bes om | Eksempel |
|---|---|---|---|
| `skole` | ja | ja | Våler ungdomsskole |
| `trinn` | ja | ja | 10 |

## Bolig

### Leiekontrakt  (`leiekontrakt`)

At du leier bolig, og hva du betaler i husleie. Utstedt av Utleier. Bevistype i Bevis Studio: «Leiekontrakt».

| Claim | Påkrevd i beviset | Bes om | Eksempel |
|---|---|---|---|
| `adresse` | ja | ja | Vålgutua 12, 2436 Våler i Solør |
| `maanedlig_husleie` | ja | ja | 9500 |
| `fra_dato` | ja | ja | 2025-08-01 |
| `utleier` | nei | nei, blir i lommeboka | Solør Boligutleie AS |

### Felleskostnader  (`felleskostnader`)

Månedlige fellesutgifter i borettslag eller sameie. Utstedt av Borettslaget eller sameiet. Bevistype i Bevis Studio: «Felleskostnader».

| Claim | Påkrevd i beviset | Bes om | Eksempel |
|---|---|---|---|
| `adresse` | ja | ja | Kirkevegen 4, 2436 Våler i Solør |
| `maanedlig_beloep` | ja | ja | 4200 |
| `borettslag` | nei | nei, blir i lommeboka | Våler Borettslag |

### Boliglån  (`boliglaan`)

Terminbeløp på boliglånet, fra nedbetalingsplanen. Utstedt av Banken. Bevistype i Bevis Studio: «Boliglån».

| Claim | Påkrevd i beviset | Bes om | Eksempel |
|---|---|---|---|
| `adresse` | ja | ja | Skogvegen 18, 2436 Våler i Solør |
| `maanedlig_terminbeloep` | ja | ja | 11800 |
| `restgjeld` | nei | nei, blir i lommeboka | 2450000 |

### Eiendomsskatt  (`eiendomsskatt`)

Årlig eiendomsskatt og eventuell festeavgift for enebolig. Utstedt av Våler kommune. Bevistype i Bevis Studio: «Eiendomsskatt og festeavgift».

| Claim | Påkrevd i beviset | Bes om | Eksempel |
|---|---|---|---|
| `adresse` | ja | ja | Skogvegen 18, 2436 Våler i Solør |
| `aarlig_eiendomsskatt` | ja | ja | 6400 |
| `aarlig_festeavgift` | nei | ja | 0 |

### Tilpasset bolig  (`tilpasset_bolig`)

At boligen er spesialtilpasset på grunn av funksjonsnedsettelse. Gir høyere boutgiftstak. Utstedt av Kommunen. Bevistype i Bevis Studio: «Spesialtilpasset bolig».

| Claim | Påkrevd i beviset | Bes om | Eksempel |
|---|---|---|---|
| `adresse` | ja | ja | Vålgutua 12, 2436 Våler i Solør |
| `bekreftet` | ja | ja | ja |
| `dato` | nei | nei, blir i lommeboka | 2024-03-01 |

