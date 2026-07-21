# API Facturación Electrónica DIAN — SaaS Multiempresa

API SaaS multiempresa de grado de producción para la facturación electrónica colombiana. Cumple con el **Anexo Técnico de la DIAN**, garantizando precisión fiscal, concurrencia masiva, aislamiento estricto entre tenants y alta tolerancia a fallos.

Desarrollada con **NestJS 11**, **TypeScript 5.9** y **PostgreSQL 16**, implementa un ciclo completo y resiliente: generación XML UBL 2.1, cálculo exacto de CUFE/CUDE, firmas digitales XAdES, SOAP WS-Security para transmisión asíncrona a la DIAN, manejo idempotente, parseo de ApplicationResponse, y representación gráfica en PDF.

---

## 🚀 Características Clave

### Cumplimiento Fiscal DIAN
- **SaaS Multiempresa Nativo (Tenant-aware):** Todas las operaciones y transacciones están aisladas usando **PostgreSQL Row-Level Security (RLS)**.
- **Idempotencia Robusta:** Hash SHA-256 del payload y constraints UNIQUE en BD que evitan la doble emisión en concurrencia o reintentos de red.
- **Resiliencia y Consistencia (Transactional Outbox):** Patrón Outbox transaccional coordinado por **BullMQ** y **Redis**, con **DLQ** (`dian_dlq`) para fallos permanentes.
- **Precisión Fiscal Absoluta:** Cálculos tributarios con `decimal.js` (Value Object `Money`), redondeo `HALF_EVEN` DIAN.
- **Firma XAdES + WS-Security:** RSA-SHA256 sobre XML canonicalizado + SOAP 1.2 con Timestamp válido.
- **Parseo de ApplicationResponse:** Extracción de adjuntos y mapeo de reglas de rechazo (`FAD09`, `FAD15`, etc.).
- **CUFE/CUDE:** SHA-384, decimales con coma, fecha/hora Colombia `YYYY-MM-DDTHH:MM:SS-05:00`.
- **Validación XSD antes de envío** con `libxmljs2`; aborta si el XML no es conforme.

### Seguridad y DevSecOps
- **Cifrado en Reposo (AES-256-GCM):** Certificados `.p12`, contraseñas y PINs DIAN encriptados.
- **JWT en cookies `HttpOnly` + `Secure` + `SameSite=Lax`** con prefijo `__Host-` en producción.
- **Refresh tokens atómicos** (`UPDATE … WHERE consumed_at IS NULL RETURNING`) con detección de reuse y revocación de familia.
- **Password hashing** con **bcrypt** cost 10; PIN de usuarios con **Argon2id**, lockout 3/15 min.
- **Throttling granular** por `@Throttle` (login, refresh, certificados, facturas, etc.) con `ThrottlerGuard` global.
- **Helmet + CSP + HSTS** en producción; **CORS** con allowlist por env.
- **Sentry** integrado con redacción automática de `password`, `pin`, `refreshToken` y cookies de auth.
- **Rate-limit** en `POST /v1/auth/pin/verify` (3/min) y `POST /v1/auth/pin/set` (5/min).

### Multitenancy
- **Postgres RLS** activo en 18+ tablas con `current_setting('app.tenant_id', true)::uuid`.
- **`tenantId` desde JWT, nunca del cliente**: `TenantGuard` endurecido rechaza `x-tenant-id` salvo `super_admin`.
- **`Membership`** con UNIQUE(user, tenant) — un usuario puede pertenecer a varios tenants con rol distinto.
- **CHECK constraint** en `products.stock >= 0` (no inventario negativo).
- **Tests E2E de aislamiento** en `test/tenant-isolation.e2e-spec.ts`.

### POS / Caja / Inventario
- **`POST /v1/pos/sales`** transaccional: descuenta stock, crea factura, registra movimiento de caja, kardex — todo en una sola transacción SQL.
- **Lock pesimista** en productos (`FOR UPDATE`) y sesiones de caja.
- **`CashRegister` / `CashSession` / `CashMovement`** modeladas; arqueo calcula `expectedAmount` vs `closingAmount` con `difference`.

### Suscripciones SaaS
- **Módulo `billing`**: `Plan`, `Subscription`, `BillingEvent`.
- **4 planes sembrados**: `free` (10 fac/mes, 1 caja), `basic` (100, 1 caja), `pro` (1000, 3 cajas), `enterprise` (ilimitado).
- **`POST /v1/billing/webhooks/mercadopago`** con verificación de firma `x-signature` + idempotencia por `mpPaymentId`.
- **Cron `BillingSuspensionService`**: cancela trials expirados, suspende `past_due` > 7 días.
- **Multi-sucursal**: `Branch`, `Warehouse`, `ProductStock` con UNIQUE(product, branch, warehouse).

---

## 🏗️ Arquitectura y Stack

| Componente | Tecnología |
|---|---|
| **Framework** | NestJS 11 + TypeScript 5.9 (Strict) |
| **Persistencia** | PostgreSQL 16 + TypeORM 0.3 + RLS |
| **Colas** | BullMQ 5 + Redis 7 |
| **Motor XML** | `xmlbuilder2` + `libxmljs2` (validación XSD) |
| **Criptografía** | `node-forge` (XAdES), `crypto` nativo, `argon2` (PINs) |
| **Cliente SOAP** | `axios` + WS-Security OASIS |
| **PDF** | PDFKit + QRCode (DIAN VPFE) |
| **Auth** | Passport-JWT + cookies HttpOnly |
| **Pagos** | MercadoPago SDK (REST) |
| **Observabilidad** | Sentry (`@sentry/node`) + cron `@nestjs/schedule` |
| **Contenedores** | Docker multi-stage non-root |

---

## 🗄️ Modelo de Datos

### Multi-Tenant (`tenant_id` en todas las entidades operativas)
- **Administración:** `tenants`, `users`, `memberships`
- **Auth:** `refresh_tokens`
- **Configuración DIAN:** `dian_software_credentials`, `digital_certificates`, `numbering_ranges` (con `valid_from`/`valid_to`)
- **Catálogos:** `customers`
- **Documentos:** `invoices`, `invoice_lines`, `tax_totals`, `credit_notes`, `debit_notes`
- **POS:** `cash_registers`, `cash_sessions`, `cash_movements`, `inventory_movements`
- **Sucursales:** `branches`, `warehouses`, `product_stocks`
- **Trazabilidad:** `dian_submissions`, `dian_dlq`, `audit_events`, `radian_events`
- **Webhooks:** `webhook_endpoints`, `webhook_deliveries`
- **SaaS Billing:** `plans`, `subscriptions`, `billing_events`
- **Seguridad:** `user_pins`

Todas las entidades con `tenant_id` tienen **RLS** activo.

---

## ⚙️ Flujo Asíncrono de Emisión

```text
[CLIENTE API] → (1. Payload Idempotente) → [API INVOICES]
                                               │
(2. RLS + DB Transaction) ←────────────────────┘
│ → Genera CUFE/XML
│ → Guarda Factura (DRAFT)
│ → Emite OutboxEvent
└──────────────────────────→ [OUTBOX RELAY] → (3. Despacha Job) → [BULLMQ: dian-submission]
                                                                   │
[WORKER NODE] ←───────────────────────────────────────────────────┘
│ → 4. Firma XAdES del XML
│ → 5. Empaqueta en ZIP
│ → 6. WS-Security del Envelope SOAP
│ → 7. SendBillAsync (DIAN)
│ → 8. Guarda TrackId
└──────────────────────────→ [BULLMQ: dian-status] (Retries exponenciales)
                                   │
[WORKER STATUS] ←──────────────────┘
│ → 9. GetStatusZip
│ → 10. Parsea UBL ApplicationResponse
│ → 11. Valida reglas FAD
│ → 12. Actualiza Status Factura (ACCEPTED / REJECTED)
```

---

## 📡 Endpoints

### Auth
- `POST /v1/auth/login` — Login con `email` + `password`
- `POST /v1/auth/refresh` — Refresca access token (rotación atómica)
- `POST /v1/auth/logout` — Revoca refresh token en BD
- `GET  /v1/auth/me` — Datos del usuario actual
- `POST /v1/auth/pin/set` — Configura PIN (Argon2id, throttled 5/min)
- `POST /v1/auth/pin/verify` — Verifica PIN (throttled 3/min, audit log)

### Invoices
- `POST /v1/invoices` — Crea factura (idempotente vía `idempotencyKey`)
- `GET  /v1/invoices/:id/status` — Trazabilidad DIAN
- `POST /v1/invoices/:id/retry` — Reintenta transmisión
- `GET  /v1/invoices/:id/xml` / `/pdf`

### POS
- `POST /v1/pos/sales` — Venta transaccional (Invoice + InventoryMovement + CashMovement)
- `GET  /v1/pos/sales/by-session/:sessionId`

### Cash
- `GET  /v1/cash-registers`
- `POST /v1/cash-registers`
- `GET  /v1/cash-sessions` / `GET /v1/cash-sessions/current`
- `POST /v1/cash-sessions` (abrir) / `:id/close` (cerrar)
- `GET  /v1/cash-sessions/:id/movements`

### Maestros
- `GET  /v1/customers` / `POST` / `GET :id`
- `GET  /v1/products` / `POST`
- `GET  /v1/suppliers` / `POST`
- `GET  /v1/inventory/movements`

### Sucursales
- `GET  /v1/branches` / `POST`
- `GET  /v1/branches/:id/warehouses` / `POST`

### Billing (SaaS)
- `GET  /v1/billing/plans`
- `GET  /v1/billing/subscription`
- `POST /v1/billing/subscription/start-trial`
- `POST /v1/billing/subscription/change-plan`
- `POST /v1/billing/subscription/cancel`
- `POST /v1/billing/checkout` (crea Preference MercadoPago)
- `POST /v1/billing/webhooks/mercadopago` (webhook firmado)

### Configuración DIAN
- `POST /v1/tenants/:id/certificates` — Sube `.p12` (cifrado AES-256-GCM)
- `POST /v1/tenants/:id/software-credentials`
- `POST /v1/numbering-ranges` — Crear resolución

### Salud
- `GET  /health` — Health check general
- `GET  /health/live` — Liveness probe
- `GET  /health/ready` — Readiness probe (Postgres)

---

## ⚙️ Configuración

### Variables de entorno (`.env`)
```bash
NODE_ENV=production
PORT=8000

DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=postgres
DB_PASSWORD=         # 32+ caracteres
DB_DATABASE=api_facturacion
DB_CA_CERT=          # requerido en producción

JWT_ACCESS_SECRET=   # 32+ caracteres
JWT_REFRESH_SECRET=  # 32+ caracteres
JWT_ACCESS_EXPIRATION=15m
JWT_REFRESH_EXPIRATION=7d

ENCRYPTION_KEY=      # 64 hex chars (32 bytes)

REDIS_HOST=localhost
REDIS_PORT=6379

CORS_ALLOWED_ORIGINS=https://app.sas-colombia.com

MP_ACCESS_TOKEN=
MP_WEBHOOK_SECRET=

PUBLIC_BACKEND_URL=https://api.sas-colombia.com

SENTRY_DSN=
```

---

## 🚀 Despliegue

### Requisitos
- Node.js 22.18.0+
- PostgreSQL 16+
- Redis 7+
- Docker & Docker Compose

### Local
```bash
npm install
cp .env.example .env
npm run build
npm run typeorm:migration:run
npm run seed:run
npm run start:dev          # API
npm run start:worker       # BullMQ worker (otra terminal)
```

### Docker
```bash
docker compose up -d --build
```

### Documentación OpenAPI
- Swagger UI: `http://localhost:8000/docs`

---

## 🧪 Pruebas

```bash
npm test                    # Unit tests (dominio, servicios)
npm run test:e2e            # E2E completos
npm run test:integration    # Integración con DB
npm run test:security       # Tests de seguridad (auth, JWT, RLS)
npm run test:concurrency    # Concurrencia (overselling, idempotencia)
npm run test:dian-fixtures  # CUFE/CUDE/XAdES contra fixtures
npm run test:signature      # Firma digital
npm test -- tenant-isolation # Aislamiento multi-tenant (BOLA/BFLA)
```

---

## 📁 Estructura

```
api-Dian/
├── src/
│   ├── main.ts                          # Bootstrap con Helmet/CSP/HSTS
│   ├── app.module.ts                    # Configuración global (Throttler, RLS, Schedule)
│   ├── config/                          # env.validation.ts (Joi)
│   ├── common/
│   │   ├── decorators/                  # @Roles, @TenantId, @CurrentUser
│   │   ├── guards/                      # JwtAuth, Tenant, Roles
│   │   ├── middleware/                  # tenant, context, request-logging
│   │   ├── interceptors/                # TenantRls
│   │   ├── database/                    # TenantRlsService
│   │   ├── sentry/                      # SentryService con redacción
│   │   ├── cookie.factory.ts            # Cookies __Host-* endurecidas
│   │   └── ttl.util.ts
│   ├── database/
│   │   ├── entities/                    # 23+ entidades con RLS
│   │   └── migrations/                  # Migraciones TypeORM
│   ├── modules/
│   │   ├── auth/                        # JWT + refresh atómico
│   │   ├── pins/                        # PIN Argon2
│   │   ├── billing/                     # SaaS + MercadoPago + cron
│   │   ├── customers/
│   │   ├── products/
│   │   ├── suppliers/
│   │   ├── invoices/
│   │   ├── credit-notes/                # Validación de factura accepted
│   │   ├── debit-notes/                 # Validación de factura accepted
│   │   ├── inventory/
│   │   ├── pos/                         # Venta transaccional
│   │   ├── cash/                        # CashRegister/Session/Movement
│   │   ├── branches/                    # Multi-sucursal
│   │   ├── catalogs/                    # Catálogos DIAN + cache
│   │   ├── certificates/                # Cifrado AES-256-GCM
│   │   ├── software-credentials/
│   │   ├── numbering-ranges/            # Lock pesimista + vigencia
│   │   ├── tenants/
│   │   ├── dian-submissions/
│   │   ├── dlq/
│   │   ├── queue/                       # BullMQ workers
│   │   ├── webhooks/                    # Webhooks salientes
│   │   ├── radian/
│   │   ├── audit/
│   │   ├── mailer/
│   │   ├── onboarding/
│   │   ├── dashboard/
│   │   ├── payments/
│   │   ├── quotations/
│   │   └── health/
│   └── services/                        # CUFE/CUDE/XAdES/XML/PDF/Crypto
├── test/
│   ├── tenant-isolation.e2e-spec.ts     # BOLA/BFLA
│   ├── app.e2e-spec.ts
│   ├── app.security-spec.ts
│   └── ...
└── docker-compose.yml
```

---

## 📄 Licencia

**Autor:** Repositorio mantenido para SaaS multiempresa colombiano.
**Licencia:** MIT.