# Studio McLeod — Local Development Quickstart

This guide gets you running in about 10 minutes.

---

## 1. Install prerequisites

```bash
brew install git node poppler
npm install -g pnpm
```

Verify:

```bash
node --version    # should be 22+
pnpm --version
pdftoppm -v
```

---

## 2. Navigate to the repo

You should already have it from before.

```bash
cd miro-pdf-image-converter
```

---

## 3. Add the .env file

Nick has already passed you the `.env` file. Drop it into the project root (`miro-pdf-image-converter/.env`).

Open it and change `SEED_USER_PASSWORD` to a password of your choice.

---

## 4. Install and run

```bash
pnpm install
pnpm dev
```

You should see:

```
[0] Studio McLeod listening    (backend on port 8080)
[1] VITE ready on port 5173    (frontend with live reload)
```

---

## 5. Open the app

Visit **http://localhost:5173**. Sign in with `duncan@studiomcleod.com` and the password you set.

That's it. Drag a PDF onto the page, pick your settings, and hit Process.

---

## Handy commands

| Command | What it does |
|---|---|
| `pnpm dev` | Run everything (HMR frontend + auto-restart backend) |
| `pnpm build` | Production build |
| `pnpm typecheck` | Check for TypeScript errors |
| `pnpm test` | Run automated tests |
