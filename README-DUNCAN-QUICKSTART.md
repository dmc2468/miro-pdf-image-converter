# Studio McLeod — Local Development Quickstart

This guide gets you running in about 10 minutes. No prior Node.js experience required.

---

## 1. Install the prerequisites

Open **Terminal** and run each of these.

### Git

```bash
brew install git
git --version
```

### Node.js 22

```bash
brew install node
node --version
```

### pnpm

```bash
npm install -g pnpm
pnpm --version
```

### Poppler (renders PDFs)

```bash
brew install poppler
pdftoppm -v
```

---

## 2. Clone the repo

```bash
git clone https://github.com/dmc2468/miro-pdf-image-converter.git
cd miro-pdf-image-converter
```

---

## 3. Set up your environment

```bash
cp .env.example .env
```

Open `.env` in a text editor and set these values.

**You need these from Nick or another admin:**

| Variable | What to put |
|---|---|
| `MONGODB_URI` | MongoDB Atlas connection string |
| `S3_ACCESS_KEY_ID` | Your IAM access key |
| `S3_SECRET_ACCESS_KEY` | Your IAM secret key |

**Set these yourself:**

| Variable | What to put |
|---|---|
| `SEED_USER_EMAIL` | Your email address |
| `SEED_USER_PASSWORD` | A strong password (min 10 chars) |
| `SEED_USER_NAME` | Your name |

The other defaults are fine — `S3_REGION=eu-west-1`, `S3_BUCKET=studio-mcleod-miro-images`.

---

## 4. Install dependencies

```bash
pnpm install
```

---

## 5. Start the dev server

```bash
pnpm dev
```

Wait about 10 seconds. You should see two running processes:

```
[0] Studio McLeod listening    (backend on port 8080)
[1] VITE ready on port 5173    (frontend with live reload)
```

---

## 6. Open the app

Visit **http://localhost:5173** in your browser.

Sign in with the email and password you put in `.env`.

---

## What you can do

- **Convert a PDF** — drag a PDF onto the upload zone, pick your settings, click Process. The ZIP downloads automatically.
- **See previous jobs** — all conversions are listed in the Recent Jobs panel.
- **Delete a job** — click the X on any job row.
- **View an image** — click any preview thumbnail to open it full-size (press Escape to close).
- **Change your password** — click "Change password" at the bottom of the sidebar.
- **Create other users** — if you're an admin, the Users panel lets you create accounts and generate one-time magic links.

---

## Dev tips

- **Frontend changes** — save a file and the browser updates automatically (HMR).
- **Backend changes** — save a file and the server restarts automatically (`tsx watch`). API calls briefly hang during restart; the frontend proxy handles this gracefully.
- **All images go to S3** — anything you convert locally is visible on the live site (studio-mcleod.fly.dev) and vice versa.
- **Need a new magic link for someone?** — use the Users panel in the app.
- **Something broken?** — check the terminal output for error messages, or ask Nick.

---

## Project layout (where things live)

```
src/
  client/                   # React frontend
    src/
      App.tsx               # All UI components
      api.ts                # API client functions
  server/                   # Express backend
    app.ts                  # Route definitions
    config.ts               # Environment config
    services/
      conversion.ts         # PDF → JPEG → ZIP pipeline
    repositories/
      users.ts              # User storage (MongoDB / in-memory)
      jobs.ts               # Job storage (MongoDB / in-memory)
    storage/
      objectStore.ts        # S3 / local file storage
  shared/
    scaling.ts              # Pixel-width mapping table
    types.ts                # Shared TypeScript types
```

---

## Useful commands

```bash
pnpm dev          # Run the full dev environment
pnpm build        # Production build
pnpm typecheck    # Check for type errors
pnpm test         # Run automated tests
```
