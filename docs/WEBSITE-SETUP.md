# Tafelhelden als website

Tafelhelden is een installeerbare website (PWA). Zet de inhoud van `dist/` na `pnpm build` op een HTTPS-webhost. GitHub Pages kan een statische site publiceren. Zodra de site een vaste HTTPS-adres heeft, kan die op telefoon of tablet via de browser aan het beginscherm worden toegevoegd.

## Wat nu wordt bewaard

- Profiel, poules, uitnodigingen, punten en klascode worden in de browser opgeslagen.
- Instellingen (geluid, snelmodus, bewegingen, oefenbereik, extra denktijd en juichbericht) en de beste reeks blijven op dat apparaat bewaard, ook nadat je het tabblad sluit.
- Browsergegevens wissen of een andere browser/apparaat gebruiken wist of deelt deze lokale gegevens niet automatisch. Een tijdelijke online gastaccount kan niet worden teruggehaald nadat browsergegevens zijn gewist.

## Klascodes op meerdere apparaten

Een klascode kan alleen leerlingen op verschillende apparaten verbinden via een gedeelde online database. De SQL voor poulecodes en toetreden met een code staat in `supabase/schema.sql`; de website roept deze functies aan zodra Supabase is geconfigureerd.

1. Maak een Supabase-project aan en vul `VITE_SUPABASE_URL` en `VITE_SUPABASE_ANON_KEY` in `.env.local`.
2. Voer `supabase/schema.sql` uit in de Supabase SQL Editor.
3. Zet anonieme aanmelding aan in Supabase. Apple/Google-login is optioneel; met tijdelijke gebruikersnamen kunnen leerlingen een code invullen zonder e-mailadres.
4. Voltooi eerst de ouderlijke toestemming en privacy-inrichting voor de doelgroep 9–11 jaar. Zet `VITE_CHILD_SOCIAL_READY=true` pas daarna aan.
5. Voer `pnpm build` uit en publiceer `dist/` opnieuw.

De Supabase Free-tier kost op dit moment $0, maar heeft gebruikslimieten en projecten kunnen na een week inactiviteit worden gepauzeerd. Controleer de actuele limieten voordat je de klas ermee laat werken. Een gratis statische host alleen is niet voldoende voor klascode-synchronisatie.
