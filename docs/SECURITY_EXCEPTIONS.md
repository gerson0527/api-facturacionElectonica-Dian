# Excepciones de Seguridad Aceptadas (Security Exceptions)

Este documento registra todas las vulnerabilidades de dependencias reportadas por `npm audit` que no cuentan con parche o que representan un riesgo aceptado sin impacto directo en la aplicación productiva.

Todas las vulnerabilidades **CRITICAL** y **HIGH** son rechazadas en integración continua. Las siguientes entradas corresponden a nivel **MODERATE**:

### 1. js-yaml (vía xmlbuilder2)
- **CVE / Referencia:** [GHSA-h67p-54hq-rp68](https://github.com/advisories/GHSA-h67p-54hq-rp68)
- **Impacto y Descripción:** Posible denegación de servicio (DoS) por complejidad cuadrática al manejar claves y alias en archivos YAML.
- **Mitigación Activa:** La librería `xmlbuilder2` y el parseo asociado sólo se emplean internamente para construir los XML que van hacia la DIAN. En ningún punto de la arquitectura se exponen endpoints públicos que acepten cargas YAML generadas por usuarios, eliminando el vector de ataque por completo.
- **Responsable:** Equipo de Arquitectura.
- **Fecha de Revisión:** Julio de 2026.

### 2. uuid < 11.1.1
- **CVE / Referencia:** [GHSA-w5hq-g745-h8pq](https://github.com/advisories/GHSA-w5hq-g745-h8pq)
- **Impacto y Descripción:** Fallo de comprobación de límites (buffer bounds check) al procesar buffers malformados para las variantes v3, v5 y v6.
- **Mitigación Activa:** La aplicación genera UUIDs `v4` estándar a través de librerías seguras de base de datos y memoria. No consumimos ni parseamos versiones v3, v5 o v6 mediante esta librería desde fuentes no confiables. La mitigación consiste en no invocar dichos métodos.
- **Responsable:** Equipo de Arquitectura.
- **Fecha de Revisión:** Julio de 2026.
