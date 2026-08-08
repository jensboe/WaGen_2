Backend scaffold (Node.js + TypeScript + Express + Prisma)

Quick start (local):
1. copy .env.example to .env and set DATABASE_URL, PORT, UPLOAD_DIR
2. npm install
3. npx prisma generate
4. npx prisma migrate dev --name init
5. npm run dev

Notes for netcup deployment:
- Build with `npm run build` and run `npm start` on the server.
- Use your preferred deploy method (SSH/rsync or FTP). Ensure node version on netcup matches requirements.
- Place uploads (UPLOAD_DIR) outside webroot if you want restricted access; static serving is exposed under /static.
