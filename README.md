# Studio McLeod

Studio McLeod is a modular web platform for delivering specialist applications and workflow tools.

The first module provides high-fidelity conversion of architectural PDF drawings into correctly scaled JPEG images for importing into Miro.

The hosted application is a full-stack TypeScript platform providing authentication, user management, cloud storage and a foundation for future Studio McLeod modules.

---

# Features

* React + Vite frontend with HMR
* Tailwind CSS user interface
* Node.js + Express TypeScript backend
* JWT authentication with securely hashed passwords
* Role-based access control (Administrator and User)
* Administrator-managed users
* One-time magic links for login (no self-registration)
* In-app password change
* MongoDB Atlas persistence for users and conversion history
* AWS S3 object storage for PDFs, JPEGs and ZIPs
* Poppler (`pdftoppm`) PDF rendering
* Sharp image processing
* ZIP download generation
* Click-to-expand image previews
* Job history with delete
* Fly.io deployment
* Automated CI/CD (GitHub Actions → Fly.io)

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

The image scaling rules are shared across the application in:

```text
src/shared/scaling.ts
```

Automated tests lock the scaling table to a known snapshot so future changes cannot accidentally alter image dimensions, and the conversion pipeline is covered by integration tests verifying the generated JPEG dimensions.

---

# Local Development

## Prerequisites
If your name is Duncan and you want to get started quickly follow [this link](README-DUNCAN-QUICKSTART.md), otherwise stay here and read through.

Install the following tools before attempting to run Studio McLeod.

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

For local development the following values must be set:

```text
SEED_USER_EMAIL=<your email address>
SEED_USER_PASSWORD=<choose a strong password>
SEED_USER_NAME=<your name>
MONGODB_URI=<MongoDB Atlas connection string>
S3_REGION=eu-west-1
S3_BUCKET=studio-mcleod-miro-images
S3_ACCESS_KEY_ID=<access key>
S3_SECRET_ACCESS_KEY=<secret key>
```

*MongoDB Atlas* — the team uses a shared cluster (`studiomcleod.hbyof8t.mongodb.net`). Ask an admin for the connection string.

*S3 credentials* — the team uses a shared S3 bucket (`studio-mcleod-miro-images`) in `eu-west-1`. Ask an admin for IAM access keys scoped to that bucket.

If MongoDB is omitted the app falls back to an in-memory repository (data lost on restart). If S3 is omitted it falls back to local disk storage under `storage/`. Neither fallback is suitable for real use — they exist only for initial experimentation.

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

Configure the required Fly runtime secrets.

```bash
fly secrets set \
  JWT_SECRET=<long-random-secret> \
  MONGODB_URI=<mongodb-atlas-connection-string> \
  S3_REGION=<aws-region> \
  S3_BUCKET=<private-bucket> \
  S3_ACCESS_KEY_ID=<access-key> \
  S3_SECRET_ACCESS_KEY=<secret-key>
```

The CI/CD workflow authenticates with Fly.io using email and password.

Configure these GitHub secrets:

```text
FLY_EMAIL=<Fly.io account email>
FLY_PASSWORD=<Fly.io account password>
```

The application runtime secrets still belong in Fly secrets (not GitHub):

```text
JWT_SECRET
MONGODB_URI
S3_REGION
S3_BUCKET
S3_ACCESS_KEY_ID
S3_SECRET_ACCESS_KEY
S3_ENDPOINT
SEED_USER_EMAIL
SEED_USER_PASSWORD
SEED_USER_NAME
```

Deploy the application manually when needed.

```bash
fly deploy
```

Pushing to `main` also runs the GitHub Actions workflow, which runs tests, builds the Docker image and redeploys the Fly application.

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

If no S3 credentials are supplied, uploaded files are stored privately under the local `storage/` directory. Switch to S3 for files that persist across restarts and are visible from any environment.

### `Invalid URL` during upload

Check that `S3_ENDPOINT` in your `.env` is not set to an empty string. This causes the AWS SDK to fail silently on upload. Either remove the line or set it to a real endpoint.

---

# Roadmap

Studio McLeod has been designed as a modular platform rather than a single-purpose application.

The Miro PDF Converter is the first module. Future modules will share the same:

* authentication & user management ([JSON Web Tokens (JWT)](https://jwt.io) holding the signed-in user's session in the browser)
* administration interface (the app itself)
* storage layer ([MongoDB](https://www.mongodb.com/atlas) / [Amazon S3](https://aws.amazon.com/s3/))
* deployment pipeline ([GitHub Actions](https://github.com/features/actions))
* infrastructure ([Fly.io](https://fly.io))

This allows additional Studio McLeod applications to be introduced without duplicating the underlying platform.
