# Deploying FrameVerse 2026 to Vercel

This project is configured to deploy to **Vercel** with:
- **Frontend**: React 19 + Vite compiled and served via Vercel's global Edge CDN.
- **Backend**: Flask API serverless functions via Vercel's Python runtime (`api/index.py`).
- **Routing**: `vercel.json` handles rewrites for `/api/*` to Flask and non-API routes to the React SPA (`index.html`).

---

## ⚠️ Important Note: SQLite on Serverless

Vercel Serverless Functions run in stateless, ephemeral micro-containers.
- The runtime filesystem is read-only except `/tmp`.
- By default on Vercel, the app automatically stores its SQLite database at `/tmp/frameverse.db`.
- **Ephemeral Storage Warning**: Data in `/tmp` will be cleared whenever the serverless container recycles or cold-starts. For testing and demonstration, this works out-of-the-box.
- **For Production Event Registrations**:
  - **Option 1 (Hybrid - Recommended)**: Host the Flask backend on Render (using the included `render.yaml` with a persistent disk) or Railway, and use Vercel for the blazing-fast React frontend by setting a rewrite in `vercel.json` to proxy `/api/:path*` to your Render URL.
  - **Option 2 (Cloud Database)**: Connect Flask to a cloud database (e.g., Supabase PostgreSQL, Neon, or Turso).

---

## 1. Required Environment Variables

Set these in your Vercel Project Settings (**Settings → Environment Variables**):

| Variable | Description | Example / How to generate |
| :--- | :--- | :--- |
| `FRAMEVERSE_SECRET_KEY` | Flask session cookie encryption key | `python3 -c "import secrets; print(secrets.token_hex(32))"` |
| `FRAMEVERSE_ADMIN_USER` | Admin username for `/admin` | `admin` |
| `FRAMEVERSE_ADMIN_PASSWORD_HASH` | Werkzeug password hash | `python3 -c "from werkzeug.security import generate_password_hash; print(generate_password_hash('YourPasswordHere'))"` |
| `FRAMEVERSE_COOKIE_SECURE` | Set to `true` for HTTPS (Vercel provides HTTPS) | `true` |

---

## 2. Deployment Methods

### Method A: Deploy via GitHub & Vercel Dashboard (Recommended)

1. **Commit and Push Changes to GitHub**:
   ```bash
   git add .
   git commit -m "Configure Vercel deployment with serverless Flask backend"
   git push origin main
   ```

2. **Import to Vercel**:
   - Go to [vercel.com](https://vercel.com) and log in.
   - Click **Add New...** → **Project**.
   - Select your repository (`Frameverse2026`).
   - Keep the **Root Directory** as `./` (default).
   - Under **Environment Variables**, add the 4 variables listed above.
   - Click **Deploy**.

---

### Method B: Deploy via Vercel CLI

From the root of the project:

1. **Log in to Vercel**:
   ```bash
   npx vercel login
   ```

2. **Deploy Preview**:
   ```bash
   npx vercel
   ```
   Follow the interactive prompts (link to existing project or create a new one).

3. **Add Environment Variables**:
   ```bash
   npx vercel env add FRAMEVERSE_SECRET_KEY
   npx vercel env add FRAMEVERSE_ADMIN_USER
   npx vercel env add FRAMEVERSE_ADMIN_PASSWORD_HASH
   npx vercel env add FRAMEVERSE_COOKIE_SECURE
   ```

4. **Deploy to Production**:
   ```bash
   npx vercel --prod
   ```

---

## 3. Verify Deployment

Once deployed, test your live Vercel URL:
1. **Health Check**: Open `https://your-project.vercel.app/api/health`. Expected response:
   ```json
   {"database": "connected", "status": "ok"}
   ```
2. **Registration Form**: Submit a test registration from the home page.
3. **Admin Dashboard**: Visit `https://your-project.vercel.app/admin` and sign in with the username and password configured above.
