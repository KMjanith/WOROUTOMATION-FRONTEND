# WOROUTOMATION-FRONTEND

This is a React project created with [Vite](https://vitejs.dev/) and [TypeScript](https://www.typescriptlang.org/) support.

## Features

- Built with **React 18.3.1** and **TypeScript**
- Uses **Vite 5.4.x** for fast development and building
- ESLint configured for code quality
- Compatible with **Node.js 18+**
- Docker container management UI
- Log viewing and streaming with floating terminal windows
- Service search functionality

## Project Structure

```
src/
  components/
    CurrentContainersPage.tsx
    CurrentContainersPage.css
    LogsPage.tsx
    LogsPage.css
  App.tsx
  main.tsx
public/
  ...
```

## Development

Start the development server:

```bash
npm install
npm run dev
```

Build for production:

```bash
npm run build
```

Preview the production build locally:

```bash
npm run preview
```

## Usage

- The development server runs on [http://localhost:5173/](http://localhost:5173/)
- Make sure your backend server (API) is running on port `3001` for Docker and log endpoints.

## Notes

- The project uses compatible versions of Vite and React for Node.js 18.
- All UI code is written in TypeScript and follows strict typing.
- Floating terminal windows are boundary-constrained and support log streaming.
- Service search is available in the sidebar for quick filtering.