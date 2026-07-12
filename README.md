# API Facturación Electrónica DIAN

API SaaS multiempresa para facturación electrónica colombiana basada en el **Anexo Técnico 1.9 de la DIAN**. Desarrollada con **NestJS 11**, **TypeScript 5.9** y **PostgreSQL 16**, implementa el ciclo completo de emisión de factura electrónica: generación XML UBL 2.1, cálculo de CUFE (SHA-384), firma XAdES-EPES, transmisión SOAP DIAN, seguimiento de estado, representación gráfica PDF con QR, notas crédito/débito y auditoría inmutable.

---

## Arquitectura

```
api-facturacion/
├── src/
│   ├── main.ts                     # Bootstrap + Swagger /docs
│   ├── app.module.ts               # Módulo raíz
│   ├── common/                     # Decorators, Guards, Interceptors, Middleware, Filters
│   ├── config/                     # Validación Joi, DB, Redis
│   ├── database/
│   │   ├── entities/               # 13 entidades TypeORM + TenantEntity abstracto
│   │   ├── migrations/             # Migración inicial
│   │   └── seeds/                  # Seed de super admin
│   ├── modules/                    # 12 módulos funcionales
│   │   ├── auth/                   # JWT (access+refresh), Passport-JWT, RBAC
│   │   ├── tenants/                # Gestión multiempresa
│   │   ├── software-credentials/   # Registro software DIAN
│   │   ├── certificates/           # .p12 + AES-256-GCM
│   │   ├── numbering-ranges/       # Rangos de numeración
│   │   ├── customers/              # Clientes/adquirentes
│   │   ├── invoices/               # Core: creación + envío DIAN + XML + PDF
│   │   ├── credit-notes/           # Notas crédito
│   │   ├── debit-notes/            # Notas débito
│   │   ├── dian-submissions/       # Historial de envíos
│   │   ├── audit/                  # Consulta de auditoría
│   │   └── queue/                  # BullMQ processors + worker
│   └── services/                   # Servicios de dominio
└── test/                           # Tests E2E
```

---

## Stack Tecnológico

| Componente | Tecnología |
|---|---|
| **Framework** | NestJS 11, TypeScript 5.9 (strict mode) |
| **Base de datos** | PostgreSQL 16 con TypeORM 0.3 |
| **Colas** | BullMQ 5 + Redis 7 |
| **XML** | xmlbuilder2 (UBL 2.1), libxmljs2 (validación XSD) |
| **Firma digital** | XAdES-EPES con node-forge + crypto nativo |
| **SOAP DIAN** | Axios con envelopes SOAP 1.2 |
| **PDF** | PDFKit + QRCode (URL catálogo DIAN vpfe) |
| **Cifrado** | AES-256-GCM (certificados .p12, PINs) |
| **Autenticación** | Passport-JWT (access 60min, refresh 7d) |
| **Autorización** | RBAC con jerarquía: super_admin > tenant_admin > tenant_user > tenant_viewer |
| **Multi-tenant** | Middleware X-Tenant-Id + tenant_id en todas las entidades |
| **API Docs** | Swagger OpenAPI en `/docs` |
| **Contenerización** | Docker Compose (api, worker, db, redis) |

---

## Entidades (13 con tenant_id)

| Entidad | Descripción |
|---|---|
| `tenants` | Empresas multi-tenant |
| `users` | Usuarios con roles RBAC |
| `dian_software_credentials` | Credenciales de software DIAN (PIN cifrado AES-256-GCM) |
| `digital_certificates` | Certificados .p12 (almacenados cifrados en disco) |
| `numbering_ranges` | Rangos de numeración con bloqueo pesimista |
| `customers` | Adquirentes/clientes |
| `invoices` | Facturas electrónicas |
| `invoice_lines` | Líneas de detalle de factura |
| `tax_totals` | Totales de impuestos (IVA, INC) |
| `credit_notes` | Notas crédito |
| `debit_notes` | Notas débito |
| `dian_submissions` | Historial de envíos DIAN |
| `audit_events` | Auditoría inmutable |

Todas heredan de `TenantEntity` (`id` UUID, `tenantId`, `createdAt`, `updatedAt`).

---

## Endpoints

### Auth
| Método | Ruta | Descripción |
|---|---|---|
| `POST` | `/v1/auth/login` | Login (email + password → access + refresh tokens) |
| `POST` | `/v1/auth/refresh` | Refrescar access token |
| `POST` | `/v1/auth/users` | Crear usuario |

### Tenants
| Método | Ruta | Descripción |
|---|---|---|
| `POST` | `/v1/tenants` | Crear empresa (genera admin automáticamente) |
| `GET` | `/v1/tenants/:id` | Consultar empresa |

### Configuración
| Método | Ruta | Descripción |
|---|---|---|
| `POST` | `/v1/tenants/:id/software-credentials` | Registrar software DIAN |
| `POST` | `/v1/tenants/:id/certificates` | Subir .p12 (FileInterceptor + AES-256-GCM) |
| `POST` | `/v1/tenants/:id/numbering-ranges` | Registrar rango de numeración |
| `GET` | `/v1/tenants/:id/numbering-ranges` | Listar rangos |
| `POST` | `/v1/tenants/:id/customers` | Crear cliente |
| `GET` | `/v1/tenants/:id/customers` | Listar clientes |
| `GET` | `/v1/tenants/:id/customers/:customerId` | Consultar cliente |

### Facturación
| Método | Ruta | Descripción |
|---|---|---|
| `POST` | `/v1/invoices` | Crear factura (genera XML, firma, encola BullMQ) |
| `GET` | `/v1/invoices` | Listar facturas (paginado + filtro por status) |
| `GET` | `/v1/invoices/:id` | Consultar factura |
| `GET` | `/v1/invoices/:id/status` | Estado DIAN + submissions |
| `GET` | `/v1/invoices/:id/xml` | Descargar XML firmado |
| `GET` | `/v1/invoices/:id/pdf` | Descargar PDF con QR |
| `POST` | `/v1/invoices/:id/retry` | Reintentar transmisión DIAN |
| `POST` | `/v1/invoices/:id/credit-notes` | Crear nota crédito |
| `POST` | `/v1/invoices/:id/debit-notes` | Crear nota débito |

### Auditoría
| Método | Ruta | Descripción |
|---|---|---|
| `GET` | `/v1/audit` | Consultar eventos de auditoría |

---

## Flujo de Emisión (16 pasos)

```
1. Recibir JSON → 2. Validar idempotencia → 3. Validar datos
   → 4. Reservar consecutivo (pessimistic_write) → 5. Calcular totales
   → 6. Calcular CUFE (SHA-384) → 7. Generar XML UBL 2.1 (xmlbuilder2)
   → 8. Validar XSD (libxmljs2) → 9. Firmar XAdES-EPES (node-forge)
   → 10. Crear ZIP (archiver) → 11. Enviar SendBillAsync (SOAP)
   → 12. Procesar ApplicationResponse → 13. Generar PDF + QR
   → 14. Actualizar estado (accepted/rejected) → 15. Auditar
   → 16. Retornar factura
```

### CUFE (SHA-384)

Concatena 13 campos y aplica SHA-384:
```
num_fac + fec_fac + hor_fac + val_bruto + val_iva + val_adicional
+ val_total + nit_emisor + tipo_doc_emisor + tipo_doc_adquirente
+ num_doc_adquirente + software_pin + ambiente
```

### XAdES-EPES

1. Carga .p12 con node-forge
2. Extrae certificado X509 y llave privada
3. Canonicaliza SignedInfo (C14N)
4. Firma RSA-SHA256 con `crypto.createSign()`
5. Digest SHA-256 del documento
6. Inserta `<ds:Signature>` en segundo UBLExtension

---

## Seguridad

### Autenticación y Autorización
- **JWT**: Access token (60min) + Refresh token (7d) vía Passport-JWT
- **RBAC**: Jerarquía de roles: `super_admin` > `tenant_admin` > `tenant_user` > `tenant_viewer`
- **Multi-tenant**: Middleware valida `X-Tenant-Id` header contra `tenant_id` del JWT (403 si mismatch)

### Cifrado
- **AES-256-GCM** para cifrar certificados .p12, contraseñas y PINs de software DIAN
- IV aleatorio + AuthTag por cada operación
- Clave de 256 bits desde variable de entorno `ENCRYPTION_KEY`

### Idempotencia
- Toda creación de factura requiere `idempotencyKey` (UUID)
- Si ya existe, retorna la factura existente sin duplicar

---

## Procesamiento Asíncrono (BullMQ)

| Cola | Propósito | Reintentos | Backoff |
|---|---|---|---|
| `dian-submission` | Enviar XML firmado a DIAN via SendBillAsync | 5 | Exponencial 30s |
| `dian-status` | Consultar GetStatus periódicamente | 5 | Exponencial 60s |

Worker se ejecuta como proceso independiente: `node dist/modules/queue/queue.worker`

---

## Tests

```bash
npm test          # 64 tests, 16 suites
npm run test:e2e  # Tests end-to-end
```

### Cobertura por módulo

| Módulo | Tests | Casos |
|---|---|---|
| CUFE | 8 | Algoritmo, sensibilidad campos, determinismo |
| AES-256-GCM | 7 | Cifrado/descifrado, IV único, authTag, objetos JSON |
| XML Builder | 8 | Estructura UBL 2.1, CUFE, QR, emisor/adquirente, totales |
| Auth | 7 | Login, tokens, refresh, creación usuarios |
| Tenants | 4 | Creación con admin, NIT duplicado, not found |
| Software Credentials | 4 | Cifrado PIN, not found |
| Numbering Ranges | 5 | Reserva pesimista, rango agotado, not found |
| Certificates | 4 | Carga .p12, descifrado, not found |
| Customers | 3 | Default fiscalResponsibilities, orden ASC |
| Dian Submissions | 3 | FindOne, findByInvoice, not found |
| Guards | 10 | RBAC jerarquía, tenantId validación |

---

## Variables de Entorno

```env
PORT=3000
NODE_ENV=development

DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=postgres
DB_PASSWORD=postgres
DB_DATABASE=api_facturacion

REDIS_HOST=localhost
REDIS_PORT=6379

JWT_ACCESS_SECRET=your-access-secret-min-64-chars!!!
JWT_REFRESH_SECRET=your-refresh-secret-min-64-chars!!!
JWT_ACCESS_EXPIRATION=60m
JWT_REFRESH_EXPIRATION=7d

ENCRYPTION_KEY=0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef

DIAN_ENVIRONMENT=habilitacion
DIAN_HABILITACION_URL=https://vpfe-hab.dian.gov.co/WcfDianCustomerServices.svc
DIAN_PRODUCCION_URL=https://vpfe.dian.gov.co/WcfDianCustomerServices.svc

STORAGE_PATH=./storage
XSD_PATH=./xsd

QUEUE_SUBMISSION_MAX_ATTEMPTS=5
QUEUE_STATUS_MAX_ATTEMPTS=5
```

---

## Inicio Rápido

### Requisitos
- Node.js 22+
- PostgreSQL 16+
- Redis 7+

### Instalación

```bash
git clone https://github.com/gerson0527/api-facturacionElectonica-Dian.git
cd api-facturacionElectonica-Dian
npm install
```

### Base de datos

```bash
# Crear base de datos
createdb api_facturacion

# Ejecutar migraciones
npm run migration:run

# (Opcional) Ejecutar seed para super admin
npm run seed
```

### Iniciar

```bash
# Desarrollo
npm run start:dev      # API en http://localhost:3000
npm run start:worker   # Worker BullMQ

# Producción con Docker
docker compose up -d
```

### Documentación

```bash
# Swagger UI
http://localhost:3000/docs
```

---

## Docker Compose

```yaml
servicios:
  api:       NestJS en :3000
  worker:    Procesador BullMQ
  db:        PostgreSQL 16
  redis:     Redis 7
```

```bash
docker compose up -d --build
```

---

## Servicios Web DIAN

### SOAP Endpoints
- **Habilitación**: `https://vpfe-hab.dian.gov.co/WcfDianCustomerServices.svc`
- **Producción**: `https://vpfe.dian.gov.co/WcfDianCustomerServices.svc`

### Operaciones implementadas
| Operación | Propósito |
|---|---|
| `SendBillAsync` | Enviar factura (ZIP con XML firmado) |
| `GetStatus` | Consultar estado por TrackId |
| `GetStatusZip` | Consultar estado desde ZIP de respuesta |
| `GetNumberingRange` | Obtener rangos autorizados |

---

## Licencia

MIT
