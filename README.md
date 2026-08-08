# WaGen_2

A watermark generator with an Angular frontend and Node.js/TypeScript backend. The server stores original images, metadata, and final images.

## GitHub Project Management

We use GitHub Issues and GitHub Projects to plan, track, and organize work.

### Workflow

- Create new tasks as GitHub Issues using the appropriate template:
  - Task: for development work
  - Feature request: for new capabilities
  - Bug report: for bugs or unexpected behavior
- Use labels such as `task`, `enhancement`, and `bug`.
- Use a GitHub Project board to move issues through phases like `Backlog`, `In Progress`, and `Done`.

### Example Issues

- Scaffold frontend (Angular)
- Implement client-side image upload and cropping
- Connect frontend to backend upload endpoints
- Add MySQL/Prisma configuration for netcup deployment

### Technical Overview

- Backend: Node.js + Express + Prisma + MySQL
- Frontend: Angular (scaffolded in `frontend/`)
- Dev environment: VS Code, local development possible without Dev Container
- Netcup deployment: Node.js 26.x, MySQL, file upload directory

## Local Development

### Backend
1. Copy `backend/.env.example` to `backend/.env`
2. `cd backend && npm install`
3. `npm run prisma:generate`
4. `npm run dev`

### Frontend
1. `cd frontend && npm install`
2. `npm run build`
3. `npm start`

## Repository structure

- `backend/` — Node.js API server with Prisma and MySQL support
- `frontend/` — Angular application for image upload and watermarking

## Note

Project planning and requirements should be managed via GitHub Issues, not local documents.
