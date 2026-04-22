# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Full-stack prototype that generates AI-powered user stories via Claude and pushes them directly to Azure DevOps. Internal tool for Intempo Labs.

## Development Commands

### Backend (port 3001)
```bash
cd backend && npm install
npm run dev      # watch mode (node --watch)
npm start        # production
```

### Frontend (port 5173)
```bash
cd frontend && npm install
npm run dev      # Vite dev server
npm run build    # production bundle
npm run preview  # preview built app
```

Both servers must run simultaneously. Vite proxies `/api/*` → `http://localhost:3001`.

## Environment Setup

Copy `backend/.env.example` to `backend/.env` and fill in:
- `ANTHROPIC_API_KEY` — Claude API key
- `AZURE_DEVOPS_ORG` — Azure DevOps organization slug
- `AZURE_DEVOPS_PROJECT` — Project name
- `AZURE_DEVOPS_PAT` — Personal Access Token
- `AZURE_DEVOPS_WORK_ITEM_TYPE` — e.g. `Task`, `User Story`
- `PORT` — defaults to 3001

## Architecture

**Backend** (`backend/src/`) — Express.js with ES modules, stateless:
- `index.js` — server setup, CORS, environment validation, startup logging
- `routes/generate.js` — `POST /api/generate`: calls Claude, extracts JSON via regex fallback
- `routes/devops.js` — Azure DevOps REST API integration (GET estados, GET tareas-padre, POST push)
- `prompts/userStory.js` — Claude prompt builders; output schema is fixed JSON

**Frontend** (`frontend/src/`) — React 18 + Vite, no router:
- `App.jsx` — two-column layout, holds `historia` state, calls `/api/generate`
- `components/StoryForm.jsx` — inputs for descripcion (required, 10+ chars), rol, contexto
- `components/StoryOutput.jsx` — editable story fields, fetches DevOps parent tasks/states, pushes to Azure DevOps

## Key Integration Details

**Claude model:** `claude-haiku-4-5-20251001`, max 1200 tokens. Response is always JSON; backend uses regex to extract it from any surrounding text.

**Azure DevOps API version:** 7.1. Auth is Basic with base64-encoded PAT. `StoryPoints` field is skipped for `Task` and `Bug` work item types. Priority maps: Alta→2, Media→3, Baja→4. Description is sent as HTML (`<ul><li>` for acceptance criteria).

**No tests, no TypeScript, no database.** The app is intentionally minimal.
