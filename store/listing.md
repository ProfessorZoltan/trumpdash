# Google Play listing: Trump Dash

Copy for the Play Console store listing plus the answers for its declaration forms. Regenerate the
images with `node tools/make_icons.js` (feature graphic, icon) and `STORE=1 node tools/shoot.js store
store` (screenshots). The PNGs live in this folder and are not committed.

## Assets

| Play Console field | File | Spec |
| --- | --- | --- |
| App icon | `icons/icon-512-maskable.png` | 512x512 PNG, full bleed |
| Feature graphic | `store/feature.png` | 1024x500 PNG, required |
| Phone screenshots | `store/s01_menu.png` … `store/s12_map.png` | 1920x1080 PNG, use 2 to 8 of them |

Suggested screenshot order: s03_portal, s08_lowg, s02_constitution, s07_lock, s06_ice, s05_catapult,
s10_truck, s01_menu. The three ending shots (s10, s11, s12) are the funniest; the menu shows all six
levels.

## Store listing text

**App name** (30 characters max)

    Trump Dash: Rhythm Parody

Play removes apps on valid trademark complaints and TRUMP is a registered mark in many classes, so
a title without the name is the safer choice if the listing should survive a complaint, for example:

    Dash of the Deal: Rhythm Parody

**Short description** (80 characters max)

    Geometry Dash-style rhythm runner parody. Run, jump, annex, stay on the beat.

**Full description** (4000 characters max)

    A rhythm platformer parody in the style of Geometry Dash. Tap on the beat to jump, hold to keep
    jumping, and steer a pixel-art Trump through seven satirical levels, each with its own procedural
    soundtrack that tells you exactly when to press.

    SEVEN LEVELS
    • GREENLAND (Normal): across the ice past polar bears and a NOT FOR SALE sign, through the
      FLIP-FLOP portal that turns gravity upside down, to a map where the island gets stamped and
      relocated next to Florida.
    • VENEZUELA (Hard): from Washington to the Orinoco oil belt, over the Constitution, Congress and
      the Supreme Court, into a tanker truck that gets restamped U.S.A. and then TRUMP.
    • HORMUZ (Insane): off an aircraft carrier catapult into the Gulf, over mines, drones and water,
      to a strait that becomes a toll booth.
    • THE 51st STATE (Hard): north past Mounties and maple-syrup pits, with ice that speeds you up,
      to a border sign that gets a new name.
    • PANAMA CANAL (Expert): lock lifts that rise on the beat, a reggaeton track, and a canal gate
      that opens for one flag only.
    • THE MOON (Extreme): low gravity, gravity flips, asteroid belts and a UFO, ending at a plaque
      that gets engraved line by line.
    • QATARI JET (Expert): through Doha on foot, then board the gift and FLY it to Washington.
      Hold to climb, release to dive, through towers, storm clouds and the Emoluments Clause.

    HOW IT PLAYS
    • One control: tap to jump, hold to keep jumping.
    • Every jump beat is marked in the music with an accent and a clap.
    • Perfect and good timing build an on-beat combo; regular and practice records are kept
      separately per level.
    • Practice mode drops checkpoints every few bars so hard sections can be learned.
    • Tap-to-the-beat calibration fixes timing for Bluetooth headphones.
    • Plays offline once installed.

    Satire. Not affiliated with any person, government or oil company. No accounts, no ads, no
    purchases, no personal data collected.

**Category**: Games > Arcade (Music is the alternative)

**Tags**: rhythm, platformer, parody, arcade, one-tap

**Contact details**: an email address is required and is shown publicly on the listing. Use the
same address in the Contact section of `privacy.html`.

**Privacy policy URL**: https://www.trumpdash.com/privacy.html

## Declarations (Policy > App content)

| Form | Answer |
| --- | --- |
| Privacy policy | https://www.trumpdash.com/privacy.html |
| Ads | No, the app does not contain ads |
| App access | All functionality is available without special access |
| Content rating (IARC) | Category: Game. Violence: none realistic (cartoon character bumping into obstacles). Sexuality, drugs, gambling, profanity: none. User interaction: none. Digital purchases: none. Shares location: no. Expect Everyone or Teen. |
| Target audience | 13 and over (do not select any under-13 group; that triggers the Families policy). If asked whether the app could unintentionally appeal to children: no. |
| News app | No |
| COVID-19 apps | Not a COVID app |
| Data safety | Collects: "App activity > App interactions" for analytics (Cloudflare Web Analytics counts page views; no identifiers). Not shared with third parties for their own use. Not required, cannot be turned off, not personal. Data is not encrypted in transit? Answer yes, encrypted in transit (HTTPS). Users cannot request deletion because nothing identifies them. No other data types. |
| Government apps | No |
| Financial features | None |
| Health | None |
| Advertising ID | Not used |

## Release path

1. Testing > Closed testing > create a track (call it "Beta"), upload the `.aab` from PWABuilder or
   Bubblewrap, add release notes ("First Android release").
2. Testers tab: add a list of at least 12 Google account emails, save, copy the opt-in link and send
   it to them. They must opt in and install; the test must run 14 continuous days.
3. Dashboard > "Apply for production access" once the 14 days show as complete.
4. Production > create release with the same bundle, review the summary, roll out. Expect a few days
   of review.

## Android shell notes

- Package name `com.trumpdash.www.twa` (matches `.well-known/assetlinks.json`); it can never change.
- The app is signed twice: the upload key (from PWABuilder/Bubblewrap, used for sideloading the test
  APK) and Google's app signing key (Play Console > Setup > App signing). Put BOTH SHA-256
  fingerprints in `assetlinks.json`, or the Play build shows a URL bar.
- Manifest display is `fullscreen` and orientation `landscape`; choose the same in the packager.
