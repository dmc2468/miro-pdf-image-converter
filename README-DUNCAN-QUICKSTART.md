# Getting Studio McLeod running when you've already dabbled a bit

These instructions assume you've already cloned the repository.

## 1. Install Homebrew (if you don't already have it)

``` bash
brew --version
```

If you see `command not found`:

``` bash
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
```

## 2. Install Node.js

``` bash
node -v
```

If it's not installed:

``` bash
brew install node
```

## 3. Install pnpm

``` bash
pnpm -v
```

If it's missing:

``` bash
brew install pnpm
```

## 4. Install Poppler

``` bash
pdftoppm -v
```

If it's missing:

``` bash
brew install poppler
```

## 5. Install project dependencies

From the project folder:

``` bash
pnpm install
```

## 6. Create the environment file

Create:

``` text
.env
```

Paste in:

``` dotenv
NODE_ENV=development
PORT=8080

JWT_SECRET=<generate a local JWT secret>
JWT_EXPIRES_IN=12h

APP_BASE_URL=http://localhost:8080
FRONTEND_BASE_URL=http://localhost:5173

# MongoDB
MONGODB_URI=<ask Nick for the MongoDB Atlas connection string>
MONGODB_DB_NAME=miro_pdf_image_converter

# AWS S3 (fill these in when you have them)
S3_REGION=
S3_BUCKET=
S3_ACCESS_KEY_ID=
S3_SECRET_ACCESS_KEY=
S3_ENDPOINT=

# Initial admin account
SEED_USER_EMAIL=duncan@example.com
SEED_USER_PASSWORD=<choose a temporary password>
SEED_USER_NAME=Duncan Mcleod

MAX_UPLOAD_MB=50
TEMP_STORAGE_PATH=tmp
LOCAL_OBJECT_STORAGE_PATH=storage
```

## 7. Start the application

``` bash
pnpm dev
```

## 8. Open the application

-   Frontend: http://localhost:5173
-   Backend API: http://localhost:8080

The application supports live reloading, so changes you make will
automatically appear in your browser.

> **Note:** You can leave the S3 settings blank until object storage has
> been configured.

------------------------------------------------------------------------

# Troubleshooting

### `brew: command not found`

Install Homebrew using the command in Step 1, then restart your
terminal.

### `pnpm: command not found`

Install pnpm:

``` bash
brew install pnpm
```

### `pdftoppm: command not found`

Install Poppler:

``` bash
brew install poppler
```

### `pnpm install` fails

Try:

``` bash
pnpm store prune
pnpm install
```

If it still fails, delete `node_modules` and the lock file, then
reinstall:

``` bash
rm -rf node_modules pnpm-lock.yaml
pnpm install
```

### Port already in use

If port 5173 or 8080 is already in use, stop the other application
that's using it, then run:

``` bash
pnpm dev
```

### Still stuck?

Copy the complete error message from the terminal and send it to Nick.
The first 20--30 lines are usually enough to identify the problem.
