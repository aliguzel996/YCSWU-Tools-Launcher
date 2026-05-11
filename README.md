# YCSWU Tools Launcher

YCSWU Tools Launcher is a free open-source desktop launcher for the YCSWU creative tool set. It keeps multiple tools in one raw utility panel, checks release state, routes install and update actions, and leaves space for small built-in helper modules like the image router and release map.

Repository: [aliguzel996/YCSWU-Tools-Launcher](https://github.com/aliguzel996/YCSWU-Tools-Launcher)  
Publisher: YCSWU  
Creator: Ali Guzel

## What It Does

- Lists YCSWU desktop tools in one launcher
- Reads a local or remote tool catalog
- Checks install state and release state
- Supports portable and installer-based distribution
- Shows release status in a compact tool garage layout
- Includes launcher-side helper panels such as image router, release map, quick actions, and activity log

## Current Tool Set

- pixelmaxxxing
- ngon-junk
- gift converter
- giffer
- hot vs nice
- 2d-to-3d

## Project Structure

- `electron/` main process and preload bridge
- `src/main/` launcher service, catalog, registry, install logic
- `src/renderer/` launcher UI
- `config/catalog.local.json` local tool catalog
- `config/catalog.remote.json` remote manifest shape
- `config/release-sources.json` release source mapping
- `scripts/` catalog sync, manifest build, staging, and release helpers

## Releases

This launcher is designed to work with GitHub Releases and a machine-readable catalog.

- Repo: [https://github.com/aliguzel996/YCSWU-Tools-Launcher](https://github.com/aliguzel996/YCSWU-Tools-Launcher)
- Expected release source: GitHub Releases
- Expected manifest source: `catalog.json` in the repository

## Website Sync

The repository now also includes a static website layer in `site/`.

- The website page reads the same `catalog.json` used by the launcher
- The launcher tries the GitHub-backed manifest first, then falls back to the bundled local catalog
- If GitHub Releases and `catalog.json` are updated, both the website and installed launcher can see the new versions

For a cPanel upload bundle:

```powershell
node scripts/build-remote-manifest.mjs
node scripts/build-site-bundle.mjs
```

Then upload the contents of `site-dist/` into your cPanel folder for the tools page.

## English

YCSWU Tools Launcher is a desktop hub for a small group of weird, practical, visual tools. It is not a generic app store and it is not trying to look polished in a corporate way. It is a compact control panel for installing, opening, updating, and tracking YCSWU tools from one place.

Use it if you want:

- one place for YCSWU tools
- simple install and update flow
- release visibility without digging through folders
- a launcher that still feels like a tool bench instead of a dashboard

## Turkce

YCSWU Tools Launcher, YCSWU tarafinda yapilan garip ama ise yarar masaustu araclarini tek yerde toplamak icin hazirlanmis bir kontrol panelidir. Genel bir app store gibi davranmaz. Daha cok kurulum, acma, guncelleme ve surum takibini tek yerden yoneten kompakt bir arac garaji gibi calisir.

Sunlar icin kullanilir:

- YCSWU araclarini tek yerde toplamak
- kurulum ve guncelleme akislarini sade tutmak
- surum durumunu klasor karistirmadan gormek
- launcherin hala ham ve arac hissini korumasini saglamak

## Deutsch

YCSWU Tools Launcher ist ein Desktop-Hub fur eine kleine Sammlung seltsamer, praktischer und visueller Werkzeuge von YCSWU. Es ist kein allgemeiner App-Store und soll auch nicht wie ein glattes Unternehmens-Dashboard aussehen. Es ist eher ein kompaktes Kontrollfeld zum Installieren, Offnen, Aktualisieren und Nachverfolgen dieser Tools an einem Ort.

Geeignet fur:

- einen gemeinsamen Einstiegspunkt fur YCSWU-Tools
- einfache Installations- und Update-Ablaufe
- schnelle Sicht auf lokale und aktuelle Versionen
- ein rohes, werkstattartiges Launcher-Gefuhl

## Francais

YCSWU Tools Launcher est un hub desktop pour un petit ensemble d'outils creatifs YCSWU, a la fois etranges, utiles et directs. Ce n'est pas un app store classique et ce n'est pas un tableau de bord corporate. C'est plutot un panneau compact pour installer, ouvrir, mettre a jour et suivre plusieurs outils depuis un seul endroit.

Utile pour:

- centraliser les outils YCSWU
- garder un flux simple pour l'installation et la mise a jour
- voir rapidement l'etat des releases
- conserver une identite brute, utilitaire et atelier

## Russkiy

YCSWU Tools Launcher eto nastolnyy khab dlya nebolshogo nabora strannykh, poleznykh i vizualnykh instrumentov YCSWU. Eto ne obychnyy app store i ne korporativnaya panel. Eto kompaktnyy pult, v kotorom mozhno ustanavlivat, otkryvat, obnovlyat i otslezhivat instrumenty iz odnogo mesta.

Podkhodit dlya togo chtoby:

- sobrat instrumenty YCSWU v odnom meste
- uпростit ustanovku i obnovlenie
- bystro videt sostoyanie release-versiy
- sokhranit grubyy instrumentalnyy kharakter interfeisa

## Development

```powershell
npm install
npm run start
```

Useful scripts:

```powershell
node scripts/sync-local-catalog.mjs
node scripts/build-remote-manifest.mjs
node scripts/stage-release-bundle.mjs
node scripts/publish-github-release.mjs --dry-run
```

## Notes

- The launcher UI only shows normal user-facing fields like tool name, version, status, short descriptions, GitHub link, and actions.
- Internal metadata for catalogs, AI indexing, manifests, and release systems stays in machine-readable files.
- The visual direction is intentionally raw, monochrome, pixel-heavy, and utility-first.
