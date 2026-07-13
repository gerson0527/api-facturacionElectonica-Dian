# API Facturación Electrónica DIAN — SaaS Multiempresa (100% Producción)

API SaaS multiempresa de grado de producción para la facturación electrónica colombiana. Cumple de forma estricta con el **Anexo Técnico 1.9 de la DIAN**, garantizando precisión fiscal, concurrencia masiva y alta tolerancia a fallos.

Desarrollada con **NestJS 11**, **TypeScript 5.9** y **PostgreSQL 16**, implementa un ciclo completo y resiliente: generación XML UBL 2.1 estricta, cálculo exacto de CUFE/CUDE, firmas digitales XAdES-EPES nativas, WS-Security SOAP para transmisión asíncrona a la DIAN, manejo idempotente, parseo de ApplicationResponse, y representación gráfica en PDF.

---

## 🚀 Características Clave y Cumplimiento Normativo

*   **SaaS Multiempresa Nativo (Tenant-aware):** Arquitectura 100% particionada. Todas las operaciones y transacciones están aisladas a nivel de base de datos usando **PostgreSQL Row-Level Security (RLS)**.
*   **Idempotencia Robusta:** Algoritmo de idempotencia con hash estricto del payload y constraints en la base de datos que evita absolutamente la doble emisión en escenarios de alta concurrencia o *network retries*.
*   **Resiliencia y Consistencia (Transactional Outbox):** Uso del patrón Outbox transaccional para evitar facturas "fantasma". La emisión del documento y la programación de la transmisión ocurren de manera atómica, coordinado por **BullMQ** y **Redis**.
*   **Precisión Fiscal Absoluta:** Cálculos tributarios implementados mediante el *Value Object* `Money` (`decimal.js`), eliminando por completo los errores de punto flotante de JavaScript (IEEE 754) e implementando políticas de redondeo DIAN (`HALF_EVEN`).
*   **Firma y WS-Security Estricto:** 
    *   Firma de documentos XML con estándar **XAdES-EPES** evitando conflictos de canonicalización (`xml-exc-c14n#`).
    *   Cifrado y firma de cabeceras SOAP (**WS-Security OASIS**) con `Timestamp` válido por 5 minutos, garantizando rechazo nulo por seguridad.
*   **Parseo de Respuestas Oficiales:** Recepción asíncrona, extracción de adjuntos (`AttachedDocument`) y parseo detallado del XML `ApplicationResponse` mapeando las reglas de rechazo precisas (ej. `FAD09`, `FAD15`).
*   **DevSecOps y Seguridad AppSec:** 
    *   **Cifrado en Reposo (AES-256-GCM):** Los certificados digitales (`.p12` / `.pfx`), sus contraseñas y PINs de software DIAN están totalmente encriptados en base de datos.
    *   **Auditoría Inmutable:** Registro de trazabilidad de los flujos críticos.
    *   **Hardening Docker:** Imágenes minimalistas non-root sin PM2 innecesario.

---

## 🏗️ Arquitectura y Stack Tecnológico

| Componente | Tecnología Principal |
|---|---|
| **Framework** | NestJS 11, TypeScript 5.9 (Strict Mode) |
| **Persistencia** | PostgreSQL 16 con TypeORM 0.3 + RLS (Row Level Security) |
| **Colas Asíncronas** | BullMQ 5 + Redis 7 |
| **Motor UBL y XML** | `xmlbuilder2` (Construcción pura), `libxmljs2` (Validación XSD) |
| **Criptografía Fiscal** | `node-forge` + `crypto` nativo de Node.js (RSA-SHA256, XAdES-EPES) |
| **Cliente SOAP** | Axios interceptado para envelopes estandarizados SOAP 1.2 + WS-Security |
| **Generación PDF** | PDFKit + QRCode (Catálogo DIAN VPFE) |
| **Autenticación** | Passport-JWT (access 60min, refresh 7d) |
| **Contenedores** | Docker Compose optimizado para producción |

---

## 🗄️ Esquema Multi-Tenant (13 Entidades RLS)

Todas las entidades heredan de `TenantEntity` y están segregadas por `tenantId`.

*   **Administración:** `tenants`, `users` (RBAC: `super_admin`, `tenant_admin`, etc.).
*   **Configuración DIAN:** `dian_software_credentials`, `digital_certificates`, `numbering_ranges` (Bloqueo Pesimista).
*   **Catálogos:** `customers`.
*   **Documentos:** `invoices`, `invoice_lines`, `tax_totals`, `credit_notes`, `debit_notes`.
*   **Trazabilidad:** `dian_submissions` (Dead-letter Queue y reintentos), `audit_events`.

---

## ⚙️ Flujo Asíncrono de Emisión (Worker Background)

```text
[CLIENTE API] → (1. Payload Idempotente) → [API INVOICES]
                                               │
(2. RLS + DB Transaction) ←────────────────────┘
│ → Genera CUFE/XML
│ → Guarda Factura (DRAFT)
│ → Emite OutboxEvent 
└──────────────────────────→ [OUTBOX RELAY] → (3. Despacha Job) → [BULLMQ: dian-submission]
                                                                     │
[WORKER NODE] ←──────────────────────────────────────────────────────┘
│ → 4. Firma XAdES-EPES del XML
│ → 5. Empaqueta en ZIP
│ → 6. Firma WS-Security del Envelope SOAP
│ → 7. SendBillAsync (DIAN WCF)
│ → 8. Guarda TrackId
└──────────────────────────→ [BULLMQ: dian-status] (Retries exponenciales)
                                   │
[WORKER STATUS] ←──────────────────┘
│ → 9. GetStatusZip a la DIAN
│ → 10. Parsea UBL ApplicationResponse
│ → 11. Valida reglas FAD (Aceptado/Rechazado)
│ → 12. Actualiza Status Factura (ACCEPTED)
```

---

## 📡 Endpoints Destacados

*   **Invoices:**
    *   `POST /v1/invoices` → Crea factura de manera idempotente (`idempotencyKey`).
    *   `GET /v1/invoices/:id/status` → Verifica trazabilidad en la DIAN.
    *   `POST /v1/invoices/:id/retry` → Reintenta transmisión para rechazos de red.
    *   `GET /v1/invoices/:id/xml` y `/pdf` → Obtiene representaciones oficiales.
*   **Configuración Segura:**
    *   `POST /v1/tenants/:id/certificates` → Sube un P12 que el servidor cifra inmediatamente a AES-256-GCM.
    *   `POST /v1/tenants/:id/software-credentials` → Define entorno y TestSetId.
*   **Maestros Fiscales:**
    *   `POST /v1/catalog/...` → Administración de ítems y listas maestras.

---

## 🚀 Despliegue Rápido (Local / Desarrollo)

### 1. Requisitos
*   Node.js 22.18.0+
*   PostgreSQL 16+
*   Redis 7+
*   Docker & Docker Compose

### 2. Configuración
Clona y configura las variables de entorno.

```bash
git clone https://github.com/gerson0527/api-facturacionElectonica-Dian.git
cd api-facturacionElectonica-Dian
npm install
cp .env.example .env # (Asegúrate de llenar ENCRYPTION_KEY 64 hex chars y URLs DIAN)
```

### 3. Migraciones y Seeders
```bash
npm run build
npm run typeorm:migration:run
npm run seed:run
```

### 4. Ejecución (Modo Independiente o Docker)
```bash
# Desarrollo: API Core
npm run start:dev

# En otra terminal: BullMQ Worker (Para firmar y enviar asíncronamente a DIAN)
npm run start:worker

# O usa Docker Compose
docker compose up -d --build
```

### 5. Documentación OpenAPI
Ingresa a `http://localhost:3000/docs` para ver Swagger con todos los modelos y flujos detallados.

---

## 🧪 Pruebas y Fixtures (Testing)
El repositorio cuenta con validación profunda y automatizada que garantiza el 100% de cumplimiento con las fórmulas DIAN y algoritmos criptográficos:
```bash
npm run test:dian-fixtures  # Prueba CUFE, Firmas y Cálculo Exacto
npm run test:e2e            # E2E multiempresa y RLS
npm test                    # Pruebas unitarias de dominio
```

---

## 📄 Licencia y Autores

**Autor:** Repositorio mantenido y evolucionado para entornos fiscales multiempresa colombianos.
**Licencia:** MIT.
