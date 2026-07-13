# Registro de Remediación y Auditoría DIAN

Este documento registra el progreso del plan de remediación conforme al archivo de falencias.

## Fase 1: Reproducibilidad, Dependencias y CI
**Estado:** COMPLETADA

### Falencias corregidas y riesgo que mitigaban
- **Riesgo Operativo:** Versiones de Node.js inconsistentes provocaban que la aplicación se comportara diferente en CI, local y producción.
- **Riesgo de Seguridad:** Ausencia de SAST/CodeQL y pruebas limitadas dejaban la facturación expuesta.
- **Riesgo de Regresión:** Falta de pruebas formales por dominio (integración, firmas, seguridad, concurrencia, vectores DIAN).

### Archivos creados/modificados
- `package.json` / `package-lock.json`: Se fijó el engine a `22.18.0`, se agregaron scripts `test:*` (integration, security, concurrency, signature, dian-fixtures) y se estableció `coverageThreshold` mínimo de 80% (y 90% para lógica crítica DIAN). Se incluyó `jest-junit`.
- `.nvmrc`: Actualizado estrictamente a `22.18.0`.
- `Dockerfile`: Actualizado a usar base `node:22.18.0-slim` en sus fases de builder y runner.
- `test/jest-*.json`: Se crearon perfiles específicos de jest para diferentes capas de pruebas.
- `.github/workflows/ci.yml`: Pipeline ampliado significativamente (formateo, validación lint, pruebas completas, generación SBOM, Docker build y escaneo de imágenes con Trivy, publicación de artefactos JUnit y cobertura).
- `.github/workflows/codeql-analysis.yml`: Nuevo pipeline para SAST.
- `CHANGELOG_REMEDIATION.md`: Creado para trazabilidad.

### Migraciones y compatibilidad de datos
- N/A. Solo ajustes de infraestructura y CI.

### Funcionalidades implementadas
- Determinismo de ejecución mediante Node.js 22.18.0.
- Ejecución robusta de pruebas y escaneos de código estático (CodeQL) / Dependencias y Docker (Trivy).
- Preparación del esqueleto para pruebas específicas de firma XML y DIAN.

### Tests añadidos y escenarios cubiertos
- Umbrales de cobertura definidos para que ningún merge pase si el código crítico (cufe, firma, numeracion) cae del 90%.
- Perfiles dedicados por suite para simplificar la ejecución.

### Comandos ejecutados y resultado real
- Se ejecutó `npm ci` corrigiendo cualquier conflicto sin requerir `--legacy-peer-deps`.
- `npm run format:check`, `npm run lint`, `npm run build` corrieron exitosamente.

### Riesgos pendientes y dependencias de DIAN
- Dependemos de implementar correctamente los mocks y validaciones funcionales a partir de la Fase 2, dado que de momento los scripts de test solo corren con lo existente.

### Actualización de matriz de cumplimiento
- *(Pendiente crear matriz en Fase 13, pero la infraestructura y reproducibilidad base están listas)*.

---
## Fase 2: Configuración, HTTP y Red
**Estado:** COMPLETADA

### Falencias corregidas y riesgo que mitigaban
- **Riesgo Operativo / Secuestro de Petición:** Bloqueo explícito del origen `*` en entornos de habilitación y producción, previniendo fuga de credenciales o secuestros de CORS.
- **Riesgo de Disponibilidad:** Se previene ataques de conexión colgada (Slowloris/exhaustion) implementando un interceptor de Timeout global.
- **Riesgo de Escalada/Acceso No Autorizado:** Las configuraciones SSL de base de datos ahora exigen de forma determinista la validación de CA en producción.

### Archivos creados/modificados
- `src/config/env.validation.ts`: `DB_CA_CERT` y `TRUST_PROXY` agregados; el primero se condicionó para ser requerido en producción.
- `src/common/filters/all-exceptions.filter.ts`: Se estandarizó la respuesta API y se eliminó la exposición de errores, añadiendo el `requestId`.
- `src/common/interceptors/timeout.interceptor.ts`: Nuevo interceptor RXJS que finaliza llamadas de más de 30 segundos.
- `src/app.module.ts`: Inyección de limitadores de peticiones por categoría (Throttlers para login, refresh, certificados, facturas, etc.) y configuración del TimeoutInterceptor.
- `src/main.ts`: Configuración rígida para Proxy y denegación dura de comodines (*) de CORS.
- `src/config/database.config.ts`: Integración de regla SSL (rejectUnauthorized: true).

### Comandos ejecutados y resultado real
- Se ejecutó el pipeline de pruebas completo (`format`, `lint`, `build`, `test`), superando todo con éxito.

---
*(La Fase 3 deberá integrar IAM, validaciones restrictivas por Tenant y RLS extremo a extremo en la aplicación).*

