# localtable

Browse linked records from notes and sync note links back to connected data tools. Airtable is the first supported integration.

This repository is named `obsidian-localtable`, while the community plugin manifest stays `localtable`.

<p align="center">
  <a href="#features">Features</a>
  ·
  <a href="#requirements">Requirements</a>
  ·
  <a href="#installation">Installation</a>
  ·
  <a href="#setup">Setup</a>
  ·
  <a href="#usage">Usage</a>
</p>

## Features

- Open a dedicated data view for notes linked to Airtable tables or records
- Read Airtable data on desktop and mobile through Obsidian `requestUrl()`
- Sync note links back to Airtable with secret storage for API keys
- Create local notes from Airtable records with configurable templates and note locations
- Optionally use the `localtable` desktop daemon as a read-through accelerator

## Requirements

- Obsidian `>= 1.11.5`
- An Airtable Personal Access Token with access to the target base
- An Airtable base ID

## Installation

### BRAT

1. Install the BRAT plugin.
2. Add the `oleksiiluchnikov/obsidian-localtable` repository.
3. Enable `localtable` in Community Plugins.

### Manual

1. Download `main.js`, `manifest.json`, and `styles.css` from the latest release.
2. Create `VaultFolder/.obsidian/plugins/localtable/`.
3. Copy the release files into that folder.
4. Enable `localtable` in Community Plugins.

## Setup

1. Open `Settings -> localtable`.
2. Store your Airtable token in the secret field.
3. Set your Airtable base ID.
4. Add Airtable frontmatter to notes you want the plugin to recognize.

### Table note

```yaml
---
airtable_table_id: tblXXXXXXXXXXXXXX
---
```

### Record note

```yaml
---
uuid: recXXXXXXXXXXXXXX
airtable_table_id: tblXXXXXXXXXXXXXX
---
```

### View note

```yaml
---
airtable_table_id: tblXXXXXXXXXXXXXX
airtable_view_id: viwXXXXXXXXXXXXXX
---
```

## Usage

### Views

- Open `localtable` from the ribbon or command palette
- Open a note with `airtable_table_id` to load the connected table
- Open a note with a record `uuid` to load that specific record
- Open a note with `airtable_view_id` plus `airtable_table_id` to load a filtered Airtable view
- Create notes for linked records directly from the table and record views

### Commands

- `Open localtable`
- `Toggle localtable`
- `Open current note in Airtable`
- `Sync link to Airtable`

### Behavior

- Mobile uses direct Airtable requests
- Desktop can optionally use the `localtable` daemon when available
- API keys stay in Obsidian secret storage and are not stored in `data.json`
- Secret storage is per-device and is not synced with the vault
- Synced Airtable note links use standard `obsidian://open` URLs and do not require extra Obsidian plugins
- If you rename or move a synced note, run `Sync link to Airtable` again to refresh the stored path

## Development

```bash
npm install
npm run build
```

Release assets are `main.js`, `manifest.json`, and `styles.css`.

## Release

1. Update `manifest.json`, `package.json`, and `versions.json`.
2. Create and push a tag such as `v1.0.1`.
3. GitHub Actions builds the plugin and uploads the release assets automatically.

## Notes

- `localtable` is independent and is not affiliated with, endorsed by, or sponsored by Airtable
- Airtable is the current integration layer; the plugin naming stays decoupled so other connectors can be added later

## License

MIT
