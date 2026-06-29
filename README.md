# Studio McLeod

Studio McLeod is a modular web platform for delivering specialist applications and workflow tools.

The first module provides high-fidelity conversion of architectural PDF drawings into correctly scaled JPEG images for importing into Miro.

The original Python desktop application remains in `MIRO Converter/PDFtoJPEGscaler.py` as the behavioural reference implementation. The hosted application has been rebuilt as a modern full-stack TypeScript platform to provide authentication, user management, cloud storage and a foundation for future Studio McLeod modules.

---

# Features

* React + Vite frontend
* Tailwind CSS user interface
* Node.js + Express TypeScript backend
* JWT authentication with securely hashed passwords
* Role-based access control (Administrator and User)
* Administrator-managed users
* One-time magic links for login and password reset
* MongoDB persistence for users and conversion history
* S3-compatible private object storage
* Poppler (`pdftoppm`) PDF rendering
* Sharp image processing
* ZIP download generation
* Fly.io deployment
* Fully automated TypeScript build and test pipeline

---

# Technology Stack

| Component        | Technology             |
| ---------------- | ---------------------- |
| Language         | TypeScript             |
| Frontend         | React + Vite           |
| Styling          | Tailwind CSS           |
| Backend          | Express                |
| Authentication   | JWT                    |
| Database         | MongoDB Atlas          |
| Object Storage   | AWS S3 (or compatible) |
| Image Processing | Sharp                  |
| PDF Rendering    | Poppler (`pdftoppm`)   |
| Deployment       | Fly.io                 |
| Package Manager  | pnpm                   |

---

# Behaviour Parity

The original Python desktop application remains the reference implementation.

The image scaling rules are shared across the application in:

```text
src/shared/scaling.ts
```

Automated parity tests compare the TypeScript implementation directly against the original Python scaling tables to ensure future changes cannot accidentally alter image dimensions.

The conversion pipeline is also covered by integration tests which verify that the generated JPEG dimensions exactly match those produced by the original desktop application.

---

# Local Development

## Prerequisites
If your name is Duncan and you are super excited and want to get stuck in immediately follow [this link](README-DUNCAN-QUICKSTART.md), otherwise stay here and plot through this lot.

If you have previously only developed Python applications, install the following tools before attempting to run Studio McLeod.

### 1. Install Git

macOS (Homebrew):

```bash
brew install git
```

Verify:

```bash
git --version
```

---

### 2. Install Node.js

Studio McLeod requires **Node.js 22 or later**.

Install using Homebrew:

```bash
brew install node
```

Verify:

```bash
node --version
npm --version
```

---

### 3. Install pnpm

Studio McLeod uses **pnpm** rather than npm.

Install globally:

```bash
npm install -g pnpm
```

Verify:

```bash
pnpm --version
```

---

### 4. Install Poppler

The PDF conversion pipeline relies on the `pdftoppm` utility supplied by Poppler.

Install:

```bash
brew install poppler
```

Verify:

```bash
pdftoppm -v
```

---

## Clone the Repository

```bash
git clone <repository-url>
cd studio-mcleod
```

---

## Create Your Local Environment

Copy the example environment file.

```bash
cp .env.example .env
```

Edit `.env`.

For a simple local installation only the following values are required:

```text
SEED_USER_EMAIL=your@email.com
SEED_USER_PASSWORD=choose-a-password
SEED_USER_NAME=Your Name
```

If no MongoDB connection is configured the application automatically falls back to an in-memory repository suitable for local development.

If no S3 configuration is supplied uploaded files are stored privately under:

```text
storage/
```

These fallbacks exist purely for development and should never be used in production.

---

## Install Dependencies

```bash
pnpm install
```

---

## Run the Development Environment

```bash
pnpm dev
```

Open:

```text
http://localhost:5173
```

The backend API is started automatically alongside the Vite development server.

---

# Seed Administrator

When the following environment variables are supplied:

```text
SEED_USER_EMAIL
SEED_USER_PASSWORD
SEED_USER_NAME
```

Studio McLeod automatically creates an Administrator account during startup if it does not already exist.

Self-registration is intentionally disabled.

Administrators can:

* Create users
* Disable users
* Generate one-time magic login links
* Generate password reset links
* Manage future Studio McLeod modules

The administration interface is available at:

```text
/admin/users
```

---

# Environment Variables

## Required in Production

```text
NODE_ENV=production

PORT=8080

JWT_SECRET=<long random secret>
JWT_EXPIRES_IN=12h

APP_BASE_URL=<public application URL>

MONGODB_URI=<MongoDB Atlas connection string>
MONGODB_DB_NAME=miro_pdf_image_converter

S3_REGION=<AWS region>
S3_BUCKET=<private bucket>
S3_ACCESS_KEY_ID=<access key>
S3_SECRET_ACCESS_KEY=<secret key>
S3_ENDPOINT=<optional S3-compatible endpoint>

SEED_USER_EMAIL=<optional initial administrator>
SEED_USER_PASSWORD=<optional initial password>
SEED_USER_NAME=<optional display name>

MAX_UPLOAD_MB=50

TEMP_STORAGE_PATH=tmp
LOCAL_OBJECT_STORAGE_PATH=storage
```

All secrets should be supplied through Fly.io Secrets (or your hosting platform's secret management) and **must never be committed to source control**.

---

# Fly.io Deployment

Configure the required secrets.

```bash
fly secrets set \
  JWT_SECRET="..." \
  MONGODB_URI="..." \
  S3_REGION="..." \
  S3_BUCKET="..." \
  S3_ACCESS_KEY_ID="..." \
  S3_SECRET_ACCESS_KEY="..."
```

Deploy the application.

```bash
fly deploy
```

The Docker image automatically:

* Builds the React frontend
* Builds the TypeScript backend
* Installs Poppler
* Serves the production application
* Exposes a `/health` endpoint for Fly.io health monitoring

---

# Privacy & Security

* Uploaded PDFs are private.
* Generated JPEGs are private.
* ZIP downloads are served only through authenticated endpoints.
* Passwords are securely hashed.
* JWTs are used for authenticated sessions.
* Temporary rendering files are automatically deleted after conversion.
* S3 lifecycle policies are recommended to automatically remove generated files after an appropriate retention period.

---

# Troubleshooting

### `pnpm: command not found`

Install pnpm:

```bash
npm install -g pnpm
```

---

### `pdftoppm: command not found`

Install Poppler:

```bash
brew install poppler
```

---

### Node.js version is too old

Check your version:

```bash
node --version
```

Studio McLeod requires **Node.js 22 or later**.

---

### MongoDB connection errors

If `MONGODB_URI` is omitted, Studio McLeod automatically uses an in-memory repository suitable for development.

---

### S3 configuration missing

If no S3 credentials are supplied, uploaded files are stored privately under the local `storage/` directory.

---

# Roadmap

Studio McLeod has been designed as a modular platform rather than a single-purpose application.

The Miro PDF Converter is the first module. Future modules will share the same:

* authentication
* user management
* administration interface
* storage layer
* deployment pipeline
* infrastructure

This allows additional Studio McLeod applications to be introduced without duplicating the underlying platform.
