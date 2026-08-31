# Scene Background

Scene Background is an Owlbear Rodeo extension that lets the GM choose a custom color for the background surrounding a Scene. The selected color is shared automatically with every participant in the Room.

## Features

- GM-controlled background color.
- Automatic synchronization for all Room participants.
- Persistent configuration per Room.
- Consistent background when switching Scenes.
- Restore Owlbear Default action.
- Color picker and editable `#RRGGBB` value.
- No backend or external services.

## How It Works

The extension stores a small configuration containing only `enabled` and `color` in Owlbear Rodeo Room Metadata. Only the GM can update it.

Owlbear Effects are Local Only, so Effect items are not synchronized. Each client reads the shared configuration and creates its own local `VIEWPORT` Effect. The extension synchronizes the configuration, not Effect items.

## Development

Install dependencies and start the local development server:

```sh
npm install
npm run dev
```

Add `http://127.0.0.1:5173/manifest.json` as a local extension manifest in Owlbear Rodeo. If Vite selects a different port, use the manifest URL shown in its terminal output.

Run the project checks and production build with:

```sh
npm run typecheck
npm run lint
npm run build
```

The build output is written to `dist/` and is not committed.

## Technical Notes

- Scene Background uses the Owlbear Rodeo Effect API.
- The official Owlbear Rodeo documentation currently marks the Effect API as Experimental.
- Effects are Local Only.
- The extension therefore depends on experimental API behavior and may require adaptation if that API changes in the future.

## Privacy

Scene Background sends no data to an external server and includes no analytics or tracking. Only the `enabled` state and selected `color` are stored in Owlbear Rodeo Room Metadata.
