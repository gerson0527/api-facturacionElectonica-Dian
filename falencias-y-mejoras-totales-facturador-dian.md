# FALENCIAS Y MEJORAS TOTALES — PROMPT DE AUDITORÍA Y REMEDIACIÓN PARA FACTURADOR DIAN

## Rol

Actúa como un equipo senior interdisciplinario formado por:

- Arquitecto de software NestJS/TypeScript.
- Especialista PostgreSQL, transacciones y Row-Level Security.
- Ingeniero DevSecOps y seguridad de aplicaciones.
- Experto en PKI, XMLDSig y XAdES-EPES.
- Especialista en UBL 2.1, CUFE/CUDE y facturación electrónica DIAN Colombia.
- Ingeniero SRE/observabilidad y QA automatizado.

Debes revisar, corregir, completar, probar y documentar este repositorio:

```text
https://github.com/gerson0527/api-facturacionElectonica-Dian
```

No reconstruyas el sistema desde cero. Conserva la arquitectura NestJS modular cuando sea correcta, pero corrige de raíz cualquier decisión insegura, no testeable, no escalable o incompatible con DIAN.

El resultado esperado es un **facturador electrónico propio SaaS multiempresa**, con aislamiento fuerte, trazabilidad fiscal, firma interoperable, validación previa DIAN, tolerancia a fallos, evidencia de habilitación y preparación real para producción.

---

# FUENTES DE VERDAD

Usa exclusivamente los artefactos oficiales vigentes de DIAN para todo elemento fiscal o de interoperabilidad:

- Anexo Técnico Factura Electrónica de Venta versión 1.9.
- Caja de herramientas DIAN de la versión correspondiente.
- XSD, WSDL, catálogos y ejemplos oficiales.
- Instructivo de registro y habilitación.
- Ambiente de habilitación y sus respuestas reales.

No inventes valores de namespaces, `CustomizationID`, `ProfileExecutionID`, catálogos, política de firma, CUFE, CUDE, QR, SOAP envelopes o códigos de respuesta. Si existe incertidumbre normativa, documentarla como bloqueo y no implementar una suposición.

---

# DICTAMEN ACTUAL QUE DEBES CERRAR

El proyecto ha progresado: declara Node 22.18.0, CI con Postgres/Redis, limitación básica de body, CORS mejorado, RLS, refresh tokens, CUFE, firma XAdES-EPES y XML de notas.

Pero aún presenta falencias críticas que deben cerrarse antes de declarar compatibilidad DIAN:

1. No existe evidencia ejecutada de CI verde bajo Node 22.18.0.
2. No existe matriz de cumplimiento del Anexo 1.9 ni evidencia de habilitación.
3. La conformidad real de CUFE, CUDE, UBL, XSD y XAdES-EPES no está demostrada contra vectores/fixtures oficiales y DIAN.
4. RLS existe a nivel de código/migración, pero debe demostrarse con PostgreSQL real para HTTP y workers.
5. No hay evidencia de transactional outbox, DLQ y protección integral frente a duplicación/pérdida de jobs.
6. No hay evidencia de auditoría realmente append-only a nivel PostgreSQL con hash encadenado.
7. No hay evidencia de storage de producción con KMS/Vault y envelope encryption.
8. No hay documentación operativa, matriz DIAN, modelo de amenazas, runbook de habilitación ni evidencia de pruebas.
9. No hay pruebas demostradas de concurrencia de numeración, recuperación de fallos o entrega condicionada por aceptación DIAN.

---

# REGLAS DE TRABAJO NO NEGOCIABLES

1. Trabaja por fases y pull requests pequeños. No avances si no se cumplen los criterios de aceptación de la fase actual.
2. No uses `npm install --force`, `--legacy-peer-deps`, `synchronize: true`, TLS inseguro ni bypass de pruebas.
3. No declares “producción” o “compatible DIAN” sin evidencia automatizada y casos aceptados en habilitación.
4. Nunca registrar secretos, P12/PFX, PIN DIAN, claves privadas, JWT, refresh tokens o XML fiscal completo en logs.
5. Todo secreto debe estar cifrado y separado por tenant.
6. El `tenantId` debe provenir del JWT/contexto autenticado; un header no puede ser fuente de autoridad.
7. Ningún endpoint, worker, servicio, query ni descarga puede cruzar tenants.
8. Todo valor monetario se calcula con decimal seguro/numeric, nunca con `float`.
9. Un consecutivo reservado nunca vuelve al rango, incluso si la firma o DIAN falla después.
10. XML/PDF se entregan al adquirente únicamente tras aceptación DIAN cuando aplique validación previa.
11. Todo cambio de estado, reintento, firma, envío y descarga debe dejar trazabilidad.
12. Toda modificación de base de datos debe incluir migración, rollback razonado y pruebas.

---

# FASE 1 — REPRODUCIBILIDAD, DEPENDENCIAS Y CI

## Falencias

- Debe probarse que NestJS 11 y `@nestjs/throttler@6.5.0` instalan sin conflictos con Node 22.18.0.
- La CI existe, pero no hay prueba de ejecución exitosa ni protección de rama.
- Falta construcción y escaneo de Docker; faltan cobertura y artefactos de pruebas.

## Cambios

1. Usar Node 22.18.0 en `.nvmrc`, `package.json.engines`, Dockerfile, Docker Compose y GitHub Actions.
2. Ejecutar desde un clone limpio:

```bash
npm ci
npm run format:check
npm run lint
npm run build
npm test -- --runInBand
npm run test:e2e -- --runInBand
```

3. Corregir lockfile/peer dependencies sin flags inseguros.
4. Fijar versiones críticas y revisar dependencias nativas, especialmente `libxmljs2`.
5. Crear scripts `test:integration`, `test:security`, `test:concurrency`, `test:signature`, `test:dian-fixtures`.
6. Definir cobertura mínima por categoría: 80% servicios críticos, 90% CUFE/CUDE/firma/numeración/cifrado.
7. Mejorar CI:

```text
npm ci → format check → lint → build → migrations → unit → integration → e2e → security → concurrency → audit → SBOM → Docker build → image scan
```

8. Agregar Dependabot/Renovate, secret scanning, CodeQL/SAST y protección de ramas.
9. Publicar como artefactos: cobertura, SBOM, resultados JUnit, logs de integración sanitizados.

## Aceptación

- CI verde en una rama limpia con Node 22.18.0.
- Ningún merge sin pipeline verde.
- Docker image construida, no-root y escaneada.

---

# FASE 2 — CONFIGURACIÓN, HTTP Y RED

## Falencias

- `BODY_SIZE_LIMIT` fue agregado, pero falta límite específico multipart/P12.
- CORS mejoró, pero se deben probar sus combinaciones.
- Falta gestión centralizada de request IDs, timeouts y errores API normalizados.

## Cambios

1. Validar estrictamente configuración por `development`, `test`, `habilitacion`, `production` con Joi/Zod.
2. Falla segura si faltan JWT secrets, encryption keys, endpoints DIAN, CA DB o configuración de storage.
3. CORS: lista explícita; si hay credenciales, prohibir `*` en cualquier entorno público.
4. Aplicar límites para JSON, urlencoded y multipart; certificado máximo configurable y un archivo por carga.
5. Agregar request ID/correlation ID propagado a HTTP, DB, BullMQ y logs.
6. Definir timeouts globales y abort signals en endpoints y DIAN SOAP.
7. Usar `trust proxy` sólo con infraestructura validada y documentada.
8. Configurar TLS PostgreSQL con CA y `rejectUnauthorized: true` en producción.
9. Añadir rate limit en Redis: login, refresh, certificados, facturas, retry, descarga XML/PDF y auditoría.
10. Crear formato único de error API: `code`, `message`, `details`, `requestId`, sin filtrar stack trace o secretos.

## Aceptación

- Tests de 413, 429, origen denegado, config inválida, timeout y sanitización de errores.

---

# FASE 3 — IAM, JWT, RBAC Y AISLAMIENTO MULTIEMPRESA

## Falencias

- RLS y TenantContext deben probarse de extremo a extremo.
- Refresh token requiere rotación, hash, revocación y detección de reutilización.
- Roles sin permisos granulares hacen difícil aplicar mínimo privilegio.

## Cambios

1. El JWT debe incluir `sub`, `tenantId`, roles, permisos/version de autorización y `jti` cuando aplique.
2. `X-Tenant-Id` es solo comprobación opcional: diferencias con JWT responden 403.
3. Implementar `TenantContext` con AsyncLocalStorage para API y contexto explícito para workers.
4. Prohibir repositorios tenant-bound sin `tenantId`; crear `TenantBaseRepository` auditado.
5. Definir permisos explícitos:

```text
invoice:create, invoice:read, invoice:retry, invoice:download,
customer:manage, certificate:manage, numbering:manage,
software:manage, audit:read, tenant:manage, user:manage
```

6. Aplicar permiso por endpoint y servicio, no solo en controller.
7. Refresh tokens:
   - valor opaco aleatorio o JWT con `jti`;
   - persistir hash, expiración, familia, usuario, tenant y estado;
   - rotar en cada refresh;
   - revocar familia ante reutilización;
   - logout, revocación de sesión y revocación por password reset/desactivación.
8. Añadir password policy, anti-bruteforce, reset seguro y MFA/SSO para roles administrativos de producción.

## RLS obligatorio

1. Habilitar RLS para toda tabla tenant-bound, incluyendo submissions, certificados metadata, tokens, outbox, auditoría y archivos.
2. Implementar `USING` y `WITH CHECK` sobre `current_setting('app.tenant_id', true)`.
3. Cada transacción HTTP/worker debe ejecutar `SET LOCAL app.tenant_id`.
4. El rol DB de aplicación no puede usar `BYPASSRLS`.
5. Usar una cuenta separada para migraciones administrativas.

## Aceptación

- Tests E2E y SQL directo prueban que tenant A no accede a tenant B.
- Pruebas cubren API, workers, downloads, búsqueda y operaciones administrativas.

---

# FASE 4 — SECRETOS, P12/PFX, CIFRADO Y STORAGE

## Falencias

- Falta evidencia de Vault/KMS, envelope encryption y rotación real.
- Debe endurecerse procesamiento de certificados y archivos fiscales.

## Cambios

1. Crear `SecretsProvider`: env local/test y Vault/KMS producción.
2. AES-256-GCM con IV único, AAD `tenantId:type:recordId`, authTag, `keyVersion` y rotación de claves.
3. Nunca reutilizar IV para una misma clave.
4. Guardar sólo secretos cifrados; no devolverlos por DTO/Swagger/log.
5. P12/PFX:
   - validar tamaño, extensión, parseo PKCS#12 y password;
   - exigir certificado y llave privada;
   - extraer subject, issuer, serial, fingerprint SHA-256, vigencia;
   - rechazar vencidos/no vigentes;
   - comprobar relación con emisor cuando sea posible;
   - alertas 60/30/15 días antes de vencimiento.
6. Implementar `DocumentStorage` con local cifrado para desarrollo y S3/Blob + KMS para producción.
7. Aplicar envelope encryption y guardar SHA-256, MIME, tamaño, tipo, key version, IV y tag.
8. Verificar integridad al persistir y recuperar; usar URLs temporales o streaming autorizado.
9. Definir retención, borrado seguro, backup cifrado y recuperación de archivos.

## Aceptación

- Tests de alteración de ciphertext/AAD/tag fallan.
- Certificado inválido/vencido/sin key privada se rechaza.
- No hay secretos en responses, logs, fixtures ni repositorio.

---

# FASE 5 — MODELO DE DATOS, DINERO, MIGRACIONES E IDEMPOTENCIA

## Falencias

- Se deben verificar constraints reales, precisión fiscal y comportamientos de carrera.

## Cambios

1. `synchronize: false` fuera de desarrollo desechable.
2. Migraciones versionadas y testeadas en BD vacía y actualización desde esquema anterior.
3. Montos en `numeric` PostgreSQL y decimal seguro en TypeScript; documentar precisión y reglas de redondeo.
4. Fechas: guardar UTC (`timestamptz`) y generar emisión fiscal con `America/Bogota` según anexo.
5. Constraints e índices:

```sql
UNIQUE (tenant_id, idempotency_key)
UNIQUE (tenant_id, document_type, prefix, number)
CHECK (quantity > 0)
CHECK (amount >= 0)
CHECK (from_number <= to_number)
```

6. Añadir índices por tenant/status/fecha, tenant/customer, tenant/rango activo, tenant/submission y tenant/audit sequence.
7. Implementar idempotencia con hash canónico del request:
   - misma llave + mismo hash: devolver resultado original;
   - misma llave + distinto hash: 409;
   - resolver carreras por constraint DB.
8. Incluir versionado optimista en documentos y submissions.

## Aceptación

- Tests de migraciones, precisión decimal, duplicados, carreras e idempotencia.

---

# FASE 6 — NUMERACIÓN, TRANSACCIONES Y MÁQUINA DE ESTADOS

## Falencias

- Falta prueba de reserva bajo carga y recuperación de fallos.
- Los estados deben evitar modificaciones fiscales ilegales.

## Cambios

1. Validar antes de reservar: tenant, ambiente, software, tipo documental, prefijo, vigencia, rango activo y disponibilidad.
2. Reservar consecutivo con transacción corta y `SELECT ... FOR UPDATE`/update atómico `RETURNING`.
3. En la misma transacción crear documento, líneas, impuestos, idempotencia y evento outbox.
4. Número reservado nunca se reutiliza.
5. Crear alertas por rango bajo/vencido/agostado.
6. Centralizar estados:

```text
Invoice:
draft -> queued -> signing -> signed -> submitted -> pending_dian
pending_dian -> accepted | rejected | transmission_failed
transmission_failed -> queued

Submission:
created -> sending -> sent -> pending -> accepted | rejected | failed
```

7. Aplicar validación central de transiciones, lock optimista, razón de cambio y auditoría.
8. Factura aceptada es inmutable: correcciones sólo por notas.

## Aceptación

- 100-500 emisiones concurrentes sin duplicados ni fugas.
- Caída antes/después de reserva conserva trazabilidad sin liberar número.

---

# FASE 7 — DOMINIO FISCAL, IMPUESTOS Y VALIDACIONES

## Cambios

1. Construir los totales desde líneas; no confiar en totales enviados por cliente.
2. Validar emisor, adquirente, identificaciones, responsabilidades y tipo de operación.
3. Implementar contado/crédito, fecha vencimiento, forma/medio de pago.
4. Implementar IVA, INC y retenciones aplicables, bases gravables y redondeos reproducibles.
5. Validar descuentos/cargos, cantidad, unidad de medida, moneda, tasa de cambio si aplica.
6. Diferenciar operaciones gravadas, exentas, excluidas/no gravadas conforme a reglas oficiales.
7. Mantener catálogos DIAN versionados; no aceptar strings libres donde haya catálogo.
8. Agregar validaciones de negocio anteriores a XML y respuestas de error por campo/regla.

## Aceptación

- Matriz de escenarios fiscales y tests con montos/decimales/tasas complejas.

---

# FASE 8 — UBL 2.1, XSD, REGLAS SEMÁNTICAS Y CUFE/CUDE

## Falencias

- XML/XSD no prueban por sí solos aceptación DIAN.
- CUFE de 15 campos y CUDE necesitan vectores oficiales demostrables.

## Cambios

1. Versionar artefactos oficiales en `resources/dian/anexo-1.9/<version>/` con URL, fecha, licencia aplicable y SHA-256.
2. Construir Invoice, CreditNote y DebitNote como documentos UBL independientes.
3. Incluir namespaces, UBLExtensions, DianExtensions, ProfileID, CustomizationID, ProfileExecutionID, identificación, pagos, impuestos, totales y referencias exactas.
4. Validar contra XSD oficiales; mostrar `xpath`, código y mensaje por error.
5. Implementar reglas semánticas DIAN independientes del XSD: catálogos, condicionales, bases, sumas, perfil, ambiente y referencias.
6. Separar `CufeService` y `CudeService`; no compartir fórmulas incorrectamente.
7. Usar vectores oficiales/fixtures de caja de herramientas para IVA, INC, retenciones, contado, crédito, habilitación, producción, notas y decimales.
8. Crear fixtures aceptados/rechazados sin información privada.

## Aceptación

- Todos los fixtures oficiales validan o rechazan según expectativa.
- Cada CUFE/CUDE coincide byte a byte con vector esperado.

---

# FASE 9 — XAdES-EPES, PKI Y VALIDACIÓN DE FIRMA

## Falencias

- Este es el riesgo técnico principal: generar `ds:Signature` no prueba cumplimiento DIAN.

## Cambios

1. Evaluar biblioteca mantenida; si se mantiene node-forge, cubrir todos los elementos mediante tests independientes.
2. Firmar dentro de la extensión UBL correcta.
3. Implementar:

```text
ds:SignedInfo
ds:Reference al documento
ds:Reference a xades:SignedProperties
canonicalización/transforms correctos
DigestValue y SignatureValue
KeyInfo/X509Data
xades:QualifyingProperties
xades:SignedProperties
SigningTime
SigningCertificate
política de firma DIAN: identificador y hash exactos
```

4. Verificar localmente con validador independiente antes de comprimir.
5. Validar cadena, vigencia y fingerprint del certificado según capacidades disponibles.
6. Implementar tests negativos: byte modificado, digest alterado, referencia rota, certificado vencido, password incorrecto, política errónea y firma inválida.

## Aceptación

- Firma localmente verificable y documentos aceptados en habilitación DIAN.

---

# FASE 10 — SOAP DIAN, OUTBOX, BULLMQ Y RECUPERACIÓN

## Falencias

- Falta evidencia de transactional outbox, DLQ, incertidumbre de red y protección de duplicados.

## Cambios

1. Versionar WSDL/contratos y endpoints de habilitación/producción.
2. Implementar operaciones aplicables: `SendBillAsync`, `GetStatus`, `GetStatusZip`, `GetNumberingRange`.
3. Construir SOAP 1.2 correcto, namespaces/headers/base64/timeout/TLS.
4. Parsear `ApplicationResponse`, SOAP Fault, status, descripción, errores y trackId.
5. Crear `outbox_events` en la transacción del documento; dispatcher idempotente publica BullMQ.
6. Job ID determinista: `dian-submission:<invoiceId>:<version>`.
7. Reintentos exponenciales con jitter sólo en fallos transitorios.
8. Antes de reenviar por duda de red, consultar estado DIAN con trackId/documento.
9. Crear DLQ, dashboard/métrica y reproceso administrativo protegido.
10. Persistir evidencia cifrada por intento: XML, ZIP, hash, endpoint, ambiente, trackId, response, código, timestamps y transición.

## Aceptación

- Simulación de timeout después de transmisión no causa doble envío.
- Redis caído no pierde factura gracias a outbox.
- Rechazo fiscal no se reintenta automáticamente.

---

# FASE 11 — NOTAS, PDF, QR, ENTREGA Y VALIDACIÓN PREVIA

## Cambios

1. CreditNote y DebitNote con UBL propio, CUDE, motivo/código permitido, referencia a CUFE origen y numeración separada.
2. Aplicar firma, ZIP, SOAP, status y evidencia igual que factura.
3. PDF sólo al estado `accepted`; mostrar emisor, adquirente, rango/resolución, líneas, impuestos, totales, CUFE/CUDE, QR y estado de validación.
4. QR exacto según Anexo/documentación; prueba que lo decodifique y compare contenido.
5. Módulo de delivery por email/webhook/portal autenticado.
6. XML/PDF al adquirente sólo cuando DIAN acepte; registrar destinatario, hash, timestamp y resultado.
7. Reintentos de entrega independientes de DIAN.

---

# FASE 12 — AUDITORÍA INMUTABLE, OBSERVABILIDAD Y OPERACIÓN

## Cambios

1. Auditoría append-only real en PostgreSQL:
   - permisos que niegan UPDATE/DELETE;
   - trigger que rechaza cambios;
   - sequence, previous_hash, event_hash, requestId, correlationId, actor, occurredAt;
   - comando de verificación de cadena.
2. Logs JSON sanitizados con requestId, correlationId, tenantId, invoiceId, trackId, jobId y latencia.
3. Endpoints `/health/live`, `/health/ready`, `/metrics` protegidos.
4. Métricas: facturas, aceptaciones, rechazos, fallos, firma, XML, latencia DIAN, queue depth, DLQ, certificados/rangos próximos a vencer.
5. Alertas y runbooks para: DIAN caída, certificados vencidos, rango agotado, jobs muertos, RLS fallido, backup fallido y alto rechazo.
6. Backup PostgreSQL cifrado, retención, restore periódico probado, RPO/RTO definidos.
7. Docker non-root, multi-stage, healthcheck, image scan.
8. Helm/Kubernetes opcional: migration job único, API/worker escalado independiente, NetworkPolicies, secrets externos, PDB/HPA.

---

# FASE 13 — HABILITACIÓN DIAN, EVIDENCIA Y GOBERNANZA

## Cambios

1. Crear estado de habilitación por tenant, software y tipo documental.
2. Preflight obligatorio: software/PIN, certificado vigente, rango, XSD, validación semántica, firma local y endpoint correcto.
3. Ejecutar el set de pruebas oficial requerido en habilitación.
4. Guardar evidencia cifrada: JSON normalizado, XML, ZIP, hash, trackId, ApplicationResponse, resultado, timestamp, commit SHA y versión de artefactos DIAN.
5. Bloquear producción sin habilitación aceptada, certificado vigente, software y rango asociados.
6. Crear matriz de cumplimiento por requisito DIAN, implementación, test y evidencia.

---

# DOCUMENTOS OBLIGATORIOS

Crear y mantener:

```text
CHANGELOG_REMEDIATION.md
docs/DIAN_COMPLIANCE_MATRIX.md
docs/SECURITY_MODEL.md
docs/STATE_MACHINES.md
docs/RUNBOOK_HABILITACION_DIAN.md
docs/RUNBOOK_PRODUCCION.md
docs/TEST_EVIDENCE.md
docs/DEPENDENCY_AND_RUNTIME.md
docs/THREAT_MODEL.md
docs/DISASTER_RECOVERY.md
```

---

# FORMA DE ENTREGA POR FASE

Para cada fase, responde con:

1. Falencias corregidas y riesgo que mitigaban.
2. Archivos creados/modificados.
3. Migraciones y compatibilidad de datos.
4. Funcionalidades implementadas.
5. Tests añadidos y escenarios cubiertos.
6. Comandos ejecutados y resultado real.
7. Riesgos pendientes y dependencias de DIAN.
8. Actualización de matriz de cumplimiento.

Empieza por **Fase 1: reproducibilidad, dependencias y CI**. No avances hasta mostrar resultados reales de `npm ci`, formato, lint, build y tests bajo Node 22.18.0.

---

# REFERENCIAS

- Anexo Técnico v1.9: https://www.dian.gov.co/impuestos/factura-electronica/Documents/Anexo-Tecnico-Factura-Electronica-de-Venta-vr-1-9.pdf
- Documentación técnica/caja de herramientas: https://www.dian.gov.co/impuestos/factura-electronica/documentacion/Paginas/documentacion-tecnica.aspx
- Micrositio técnico: https://micrositios.dian.gov.co/sistema-de-facturacion-electronica/documentacion-tecnica/
- Registro y habilitación: https://micrositios.dian.gov.co/sistema-de-facturacion-electronica/instructivo-de-registro-y-habilitacion-en-factura-electronica/
- WSDL habilitación: https://vpfe-hab.dian.gov.co/WcfDianCustomerServices.svc?wsdl
- WSDL producción: https://vpfe.dian.gov.co/WcfDianCustomerServices.svc?wsdl
