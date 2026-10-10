# LavaLust API Backend

This repository contains the PHP/LavaLust backend only. The full React product management application is maintained separately in the `LavaLust-Frontend-kevs` workspace and connects to this service over the `/api` routes. The Docker image does not build or serve frontend files.

## Run locally

1. Copy `.env.example` to `.env` and configure the database values: `DB_DRIVER=mysql`, `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`, and `DB_CHARSET=utf8mb4`.
2. For Aiven, set `DB_SSL_CA` to the certificate path. The bundled `runtime/aiven-ca.pem` is used when no explicit certificate path is available.
3. Generate `JWT_SECRET` and `REFRESH_TOKEN_KEY` as separate random values at least 32 characters long. Set a random `APP_KEY` as well. Keep all secrets in `.env` or the host's private environment settings.
4. Set `CORS_ALLOWED_ORIGIN=http://127.0.0.1:5173` while developing with the frontend Vite server.
5. Start the API with `php lava serve` (default local URL: `http://127.0.0.1:3000`).

The root URL returns a small JSON service status. The frontend should use the API URL ending in `/api`.

## Deploy the API on Render

Create or keep a Render **Web Service** connected to this API repository, with branch `main` and Docker as the runtime. The Dockerfile builds only PHP, Apache, and the LavaLust backend. Set these values in Render's **Environment** settings:

- `APP_ENV=production`
- `APP_KEY` (random secret)
- `DB_DRIVER=mysql`, `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`, and `DB_CHARSET=utf8mb4`
- `JWT_SECRET` and `REFRESH_TOKEN_KEY` (different random secrets)
- `CORS_ALLOWED_ORIGIN` (the exact public origin of the separately deployed React frontend, with no trailing slash)

The Aiven CA certificate is bundled at `runtime/aiven-ca.pem`. Render may instead mount a Secret File at `/etc/secrets/aiven-ca.pem`; the database config uses it when present. Do not put database credentials or signing keys in this repository or in frontend build variables.

The API endpoints are:

| Method | Route | Access |
| --- | --- | --- |
| POST | `/api/auth/register` | Public |
| POST | `/api/auth/login` | Public |
| POST | `/api/auth/refresh` | Refresh token |
| POST | `/api/auth/logout` | Bearer token |
| GET | `/api/products` | Bearer token |
| POST | `/api/products` | Bearer token |
| PUT/PATCH | `/api/products/{id}` | Bearer token |
| DELETE | `/api/products/{id}` | Bearer token |

## Deploy the React frontend separately

Use the `LavaLust-Frontend-kevs` repository as a Render **Static Site**. Its build command is `npm ci && npm run build -- --mode standalone`; its publish directory is `dist`. Set the frontend's build environment variable `VITE_API_BASE_URL` to this backend's public URL ending in `/api`. Set the API service's `CORS_ALLOWED_ORIGIN` to the frontend's exact public origin. The frontend makes browser requests to this API; it never connects directly to MySQL.

## Database tables

The migrations create the `migrations`, `users`, `refresh_tokens`, and `products` tables. Apply migrations before using registration and product routes. Migration commands are intentionally disabled by default. Temporarily enable migrations in `app/config/migration.php`, run `php lava migration run`, then disable them again. Alternatively execute `products.sql` for the product table; the existing migrations are still required for users and refresh tokens.
