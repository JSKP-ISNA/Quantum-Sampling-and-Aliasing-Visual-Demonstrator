# Quantum Signal Studio Frontend

The frontend now supports two launch modes:

- `npm run dev`
  Starts Vite and opens the app inside the desktop webview shell.
- `npm run dev:web`
  Starts the plain browser-based Vite dev server.
- `npm run preview`
  Runs the production preview inside the desktop webview shell.
- `npm run preview:web`
  Runs the plain browser-based production preview.

## Stack

- React 19
- Vite
- Framer Motion
- Recharts
- React Three Fiber / Drei
- Zustand
- Electron desktop shell

## Notes

- The webview shell loads the same frontend routes you use on the web.
- Backend calls stay same-origin from the frontend app through the existing Vite/nginx proxy setup.
