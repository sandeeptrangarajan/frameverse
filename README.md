# FrameVerse 2026

Registration website for the FRAMEVERSE creative event — a **React + Vite** frontend backed by a **Flask + SQLite** API, with a protected admin view for registrations.

## Tech stack

| Layer     | Technology                                              |
| --------- | ------------------------------------------------------- |
| Frontend  | React 19, Vite 8, oxlint (`frontend/`)                  |
| Backend   | Flask 3, python-dotenv, Gunicorn (`backend/`)           |
| Database  | SQLite (auto-created on first run)                      |
| Deploy    | Docker multi-stage build, Render Blueprint (`render.yaml`) |

## Project structure

```
.
├── backend/            Flask API + SQLite database
│   ├── app.py
│   ├── requirements.txt
│   └── .env.example    Template for local secrets
├── frontend/           React + Vite single-page app
│   ├── src/
│   └── package.json
├── Dockerfile          Multi-stage build (frontend + backend)
├── render.yaml         Render deployment blueprint
├── DEPLOY_RENDER.md    Full local + online deployment guide
└── README_WORKING_SETUP.md   Detailed local setup notes
```

## Quick start (local, Windows)

### 1. Backend

```bat
cd backend
py -m venv .venv
.venv\Scripts\activate
py -m pip install -r requirements.txt
copy .env.example .env
```

Generate a secret key and paste it into `backend\.env` as `FRAMEVERSE_SECRET_KEY`:

```bat
py -c "import secrets; print(secrets.token_hex(32))"
```

Generate the admin password hash and paste it into `FRAMEVERSE_ADMIN_PASSWORD_HASH`:

```bat
py -c "from werkzeug.security import generate_password_hash; print(generate_password_hash('Choose-A-Strong-Password'))"
```

Set `FRAMEVERSE_ADMIN_USER` to your chosen username, then start the API:

```bat
py app.py
```

The backend runs at `http://127.0.0.1:5000`. Verify it at `http://127.0.0.1:5000/api/health` — it should return `{"database":"connected","status":"ok"}`.

### 2. Frontend

In a second terminal:

```bat
cd frontend
npm install
npm run dev
```

Open the URL Vite prints (usually `http://localhost:5173`). The Vite dev server proxies `/api` requests to Flask on port 5000.

### 3. Admin

Go to `http://localhost:5173/admin` and sign in with the credentials from step 1.

## Environment variables

These live in `backend/.env` (git-ignored — never commit it):

| Variable                        | Purpose                                        |
| ------------------------------- | ---------------------------------------------- |
| `FRAMEVERSE_SECRET_KEY`         | Flask session signing key                      |
| `FRAMEVERSE_ADMIN_USER`         | Admin login username                           |
| `FRAMEVERSE_ADMIN_PASSWORD_HASH`| Werkzeug hash of the admin password            |
| `FRAMEVERSE_DATABASE_PATH`      | SQLite file path (defaults to local file)      |
| `FRAMEVERSE_COOKIE_SECURE`      | Set `true` behind HTTPS in production          |

See `backend/.env.example` for the template.

## Deployment

Deploy to Render using the included `render.yaml` Blueprint, which builds the frontend and serves it with Flask via the multi-stage `Dockerfile`, backed by a persistent disk for SQLite.

Full step-by-step instructions (including persistence checks) are in **[DEPLOY_RENDER.md](DEPLOY_RENDER.md)**.

### Vercel Deployment

To deploy to Vercel (React frontend on Edge CDN + Flask serverless backend), see **[DEPLOY_VERCEL.md](DEPLOY_VERCEL.md)**.

> Note: SQLite on serverless platforms like Vercel uses ephemeral `/tmp` storage. For permanent database persistence across cold starts, refer to the guidance in `DEPLOY_VERCEL.md`.

## Notes

- Keep `backend/.env` private; it is excluded via `.gitignore`.
- Do not use the `npm run api` script for this setup — it starts a separate Node API, while the Vite proxy targets Flask.
- The registration form accepts 2–3 team members and requires the team lead to be listed as a member.
