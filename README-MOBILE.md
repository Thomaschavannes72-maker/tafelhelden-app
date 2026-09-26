# Tafelhelden voor iOS en Android

## Zonder betaalde store: installeren als webapp

Gebruik [de live versie van Tafelhelden](https://thomaschavannes72-maker.github.io/tafelhelden-app/). Op een Mac kun je hem in Safari via **Archief → Voeg toe aan Dock** installeren. Op iPhone en iPad open je de link in Safari, tik je op **Deel** en kies je **Zet op beginscherm**. Dat geeft een app-icoon en een schermvullende app-ervaring zonder App Store.

Een native iOS/iPadOS-appbestand kan niet zomaar via GitHub worden geïnstalleerd: Apple moet zo'n app ondertekenen voor het apparaat. Daarvoor is een Apple-ontwikkelaarsaccount nodig. De webapp hierboven is de gratis installatieoptie.

De app is nu verpakt met Capacitor 8. De webbron blijft `outputs/index.html`; Vite bouwt die naar `dist/`, en Capacitor kopieert de build naar `ios/` en `android/`.

## Benodigd voor echte accounts en poules

1. Maak een Supabase-project aan.
2. Kopieer `.env.example` naar `.env.local` en vul de project-URL en de **publishable/anon key** in. Zet nooit de service-role key in de app. Laat `VITE_CHILD_SOCIAL_READY=false` totdat er een beoordeelde ouderlijke-toestemmingsflow is ingericht.
3. Voer `supabase/schema.sql` uit in de SQL Editor.
4. Deploy de functie `supabase/functions/delete-account` en stel in de Supabase Functions Secrets `SUPABASE_SERVICE_ROLE_KEY` in.
5. Zet `nl.tafelhelden.app://auth/callback` bij de Supabase Auth redirect-URL's.
6. Schakel Google en Apple in onder Supabase Auth providers. Google heeft een OAuth client ID en secret nodig; Apple heeft een Apple Developer-account, Services ID, Team ID, Key ID en Sign in with Apple private key nodig. Gebruik de callback-URL die Supabase in het provider-scherm toont.

Zonder geldige configuratie én expliciete ontwikkelaarsvrijgave via `VITE_CHILD_SOCIAL_READY=true` blijft de app in lokale proefmodus. Zet die vrijgave niet aan voordat de kindprivacy- en ouderlijke-toestemmingsflow is gebouwd en beoordeeld. De OAuth-knoppen en poules zijn dan geen online dienst.

## Bouwen en openen

```sh
pnpm install
pnpm build
pnpm exec cap sync
pnpm exec cap open ios
pnpm exec cap open android
```

Open iOS in Xcode en Android in Android Studio. Voor iOS is Xcode op een Mac vereist; voor Android zijn Android Studio en de Android SDK vereist. Stel een unieke bundle ID/package ID in voordat je store-assets of signing configureert. De huidige ID `nl.tafelhelden.app` is een startwaarde en kan al in gebruik zijn.

## Storevoorbereiding (nog nodig)

- Apple Developer Program- en App Store Connect-toegang van de eigenaar, plus Google Play Console-toegang.
- Geldige privacy policy-URL, support contactgegevens en volledige store-teksten en screenshots.
- De app is bedoeld voor kinderen van 9–11 jaar. Laat de gegevensverwerking, ouderlijke toestemming, accountverwijdering en sociale uitnodigingen juridisch en privacytechnisch beoordelen voordat je echte kinderaccounts activeert. Zie [RELEASE-CHECKLIST.md](docs/RELEASE-CHECKLIST.md) en [PRIVACY-POLICY-DRAFT.md](docs/PRIVACY-POLICY-DRAFT.md).
- Vul App Store Connect en Play Console waarheidsgetrouw in voor de doelgroep, gegevensverzameling, leeftijdsrating, review-instructies en privacylabels.
- Maak een testaccount voor de reviewer aan zodra de cloudauth werkt.
- Maak een ondertekende iOS archive en Android App Bundle, test op echte apparaten en dien ze in met de eigenaar-account.

Deze omgeving heeft nog geen Xcode-installatie, Android SDK, store-accounts of Supabase-projectcredentials. De bronprojecten zijn gegenereerd, maar er zijn hier nog geen store-builds gecompileerd of ingestuurd.
