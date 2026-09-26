# Tafelhelden release checklist

Status: **niet klaar om naar de stores te sturen**.

## Accounts en backend

- [ ] Eigenaar levert/koppelt een Supabase-project en vult `.env.local` in.
- [ ] Database schema en `delete-account` Edge Function deployen.
- [ ] Google OAuth-client, Apple Sign in with Apple en redirect-URL's configureren.
- [ ] Gebruikersnaam-conflicten, uitnodigingen, weigeren, accountverwijdering en poules testen met twee aparte accounts/devices.
- [ ] Ouderlijk toezicht/toestemming ontwerpen en laten beoordelen voor de doelgroep 9–11 jaar.
- [ ] Bevestigen welke persoonsgegevens de OAuth-provider, Supabase en app verwerken en in welke regio ze worden bewaard.

## Kindveiligheid en privacy

- [ ] Een echte privacy policy publiceren en daarin Supabase, Apple, Google, gebruikersnamen, poulescores, bewaartermijnen en verwijdering beschrijven.
- [ ] Vaststellen of en hoe ouderlijke toestemming vooraf nodig is in alle landen waar de app beschikbaar komt.
- [ ] Sociale functies beperken tot uitnodigingen op gebruikersnaam; geen chat, openbare profielen of delen van foto's/contactgegevens toevoegen.
- [ ] Veiligheidsreminder bij uitnodigingen behouden en met kinderen testen.
- [ ] Apple Sign in with Apple-token revocation meenemen bij accountverwijdering.
- [ ] App Store privacy details en Google Play Data safety antwoorden afstemmen op werkelijk gedrag van alle SDK's.

## Apple App Store

- [ ] Apple Developer Program en App Store Connect-account van de eigenaar.
- [ ] Unieke bundle ID registreren; eventueel de start-ID `nl.tafelhelden.app` wijzigen.
- [ ] Xcode signing/provisioning instellen en iOS-build op een echt toestel controleren.
- [ ] App Review-info invullen, inclusief werkende reviewer-login en uitleg van poules.
- [ ] Leeftijdsrating/Kids Category en privacylabels zorgvuldig invullen.
- [ ] Store listing: naam, beschrijving, support-URL, privacy policy-URL, screenshots en app preview.
- [ ] Archive uploaden, build selecteren, `Add for Review` en daarna `Submit for Review` in App Store Connect.

## Google Play

- [ ] Play Console-account van de eigenaar, package ID en signing key.
- [ ] Android SDK/Android Studio-build, testen op echte apparaten en signed Android App Bundle.
- [ ] Target audience, Families policy, content rating en Data safety invullen.
- [ ] Privacy policy, store listing, screenshots en tester-instructies toevoegen.
- [ ] Uploaden naar internal testing, vervolgens productie-aanvraag doen.
