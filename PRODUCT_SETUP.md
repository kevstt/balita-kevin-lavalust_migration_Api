# Product Inventory Setup

This workspace now contains the LavaLust API and a separate React frontend in `product-frontend/`.

## Configure LavaLust

1. Copy `.env.example` to `.env`. Set `DB_DRIVER=mysql`, `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`, and `DB_CHARSET=utf8mb4` using your database values.
2. For Aiven, download the service CA certificate and set `DB_SSL_CA` to its absolute file path. Keep the certificate and `.env` out of source control.
3. Generate API signing keys with `php lava jwt:generate`. The generated values are written to `.env`; do not publish them.
4. Set `CORS_ALLOWED_ORIGIN=http://localhost:5173` for local development. In production, set it to the exact deployed frontend origin.

## Configure Render

The `.env` file is intentionally excluded from Git and Docker images. Add the production values in the Render service's **Environment** settings: `APP_ENV=production`, `APP_KEY`, `DB_DRIVER`, `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`, `DB_CHARSET=utf8mb4`, `JWT_SECRET`, and `REFRESH_TOKEN_KEY`. Use the current values from the database provider, and rotate any credentials that have been exposed.

For Aiven, upload its CA certificate under **Environment → Secret Files** with the filename `aiven-ca.pem`. Render mounts it at `/etc/secrets/aiven-ca.pem`; the app uses that file automatically if `DB_SSL_CA` is unset or points to a path that does not exist in the container. Do not use a local Windows path for the Render service. Save the environment changes and redeploy the service.

If the API still reports a database connection error after deployment, check the Render service logs for the server-side `Product API database connection failed` entry. It contains the connection error but never returns it to the browser.

## Create the Tables

The migrations create the `migrations`, `users`, `refresh_tokens`, and `products` tables. Migration commands are intentionally disabled by default. Temporarily set `$config['migration_enabled'] = TRUE` in `app/config/migration.php`, then run:

```sh
php lava migration run
php lava migration status
```

Set migration support back to `FALSE` after applying changes. Do not use `rollback-all` or `refresh` against a database containing data you need.

Alternatively, select your LavaLust database and execute the SQL in `products.sql`. The users and refresh-token tables must still be created by their existing migrations for authentication to work.

## Run the Product App Locally

From `product-frontend/`, run:

```sh
npm install
npm run build
```

At the LavaLust root, run `php lava serve` and open `http://127.0.0.1:3000/`. The root redirects to the built React app at `/product/`, which uses the same-origin LavaLust API. For frontend-only hot reload, run `npm run dev` inside `product-frontend/`; its API URL defaults to `http://127.0.0.1:3000/api` and can be changed with `VITE_API_BASE_URL`.

## API Routes

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

Database credentials and API secrets belong in environment variables, never in the React bundle or a committed `.env` file. Set these values in Render's environment settings for deployment, and configure its CA-file path and frontend origin for the deployed services.