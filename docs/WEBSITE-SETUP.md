# Tafelhelden als website

Tafelhelden is een installeerbare website (PWA). GitHub Pages kan de inhoud van `dist/` publiceren. Zodra de site een vaste HTTPS-adres heeft, kan die op telefoon of tablet via de browser aan het beginscherm worden toegevoegd.

## Wat nu wordt bewaard

- Een lokaal profiel, poules, uitnodigingen, punten en instellingen worden in de browser bewaard.
- Browsergegevens wissen of een andere browser/apparaat gebruiken wist of deelt deze lokale gegevens niet automatisch.
- Online poules en profielen werken pas nadat Supabase is ingesteld.

## Klascodes op meerdere apparaten

Een klascode kan alleen leerlingen op verschillende apparaten verbinden via een gedeelde online dienst. Supabase is hiervoor voorbereid in `supabase/schema.sql`.

1. Maak een Supabase-project aan. Vul `VITE_SUPABASE_URL` en `VITE_SUPABASE_ANON_KEY` in `.env.local` voor lokaal bouwen. Voor GitHub Pages voeg je ze toe bij **Repository → Settings → Secrets and variables → Actions → Secrets**.
2. Voer `supabase/schema.sql` uit in de Supabase SQL Editor.
3. Zet anonieme aanmelding aan in Supabase. Apple/Google-login is optioneel; leerlingen kunnen met een gebruikersnaam meedoen.
4. Voltooi eerst de ouderlijke toestemming en privacy-inrichting voor de doelgroep 9–11 jaar. Pas daarna voeg je bij **Settings → Secrets and variables → Actions → Variables** de variabele `VITE_CHILD_SOCIAL_READY=true` toe.
5. Publiceer de site opnieuw. GitHub Actions bouwt en publiceert `dist/` met deze instellingen.

## Live docentquiz

De docentquiz gebruikt Supabase Realtime om een tijdelijke quizkamer met een code te maken. De docent stelt tafels, aantal vragen en denktijd in. Leerlingen openen dezelfde website, melden zich aan met een gebruikersnaam en voeren de code in. De docent ziet wie meedoet, toont vragen op het bord en houdt de tussenstand bij. Vragen en antwoorden worden alleen tijdens de live sessie uitgezonden.

De docent vinkt in het profiel **Ik ben docent/leerkracht** aan. Dat veld wordt met het online profiel bewaard. Na de stappen hierboven kunnen docenten een klasquiz hosten en leerlingen met een code deelnemen. Zonder de online verbinding blijft de docentquizknop zichtbaar, maar meldt de app dat live spelen nog niet beschikbaar is. Een code kan niet tussen apparaten werken met alleen GitHub Pages of browseropslag.

Een gratis statische host alleen is niet voldoende voor klascode-synchronisatie.
