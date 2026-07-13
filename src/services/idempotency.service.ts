import { Injectable, ConflictException, Logger } from "@nestjs/common";
import { Repository, ObjectLiteral } from "typeorm";
import * as crypto from "crypto";

@Injectable()
export class IdempotencyService {
  private readonly logger = new Logger(IdempotencyService.name);

  /**
   * Genera un SHA-256 canónico del payload
   */
  generateHash(payload: any): string {
    const canonicalString = this.canonicalize(payload);
    return crypto.createHash("sha256").update(canonicalString).digest("hex");
  }

  /**
   * Verifica el hash contra un registro existente
   */
  verifyExisting(
    existing: any,
    payloadHash: string,
  ): { snapshot: any; statusCode: number } {
    if (existing.requestPayloadHash !== payloadHash) {
      this.logger.warn(
        `Idempotency conflict for key ${existing.idempotencyKey}`,
      );
      throw new ConflictException(
        "Ya existe una petición procesada con esta llave de idempotencia pero con un payload diferente.",
      );
    }
    return {
      snapshot: existing.responseSnapshot,
      statusCode: existing.responseStatusCode,
    };
  }

  /**
   * Wrapper principal para ejecutar lógica segura con idempotencia multi-tenant
   */
  async executeWithIdempotency<T extends ObjectLiteral>(
    tenantId: string,
    idempotencyKey: string,
    payload: any,
    repo: Repository<T>,
    action: (payloadHash: string, manager: import("typeorm").EntityManager) => Promise<{ snapshot: any; statusCode: number }>,
  ): Promise<{ snapshot: any; statusCode: number }> {
    const payloadHash = this.generateHash(payload);

    // 1. Lectura inicial optimista
    let existing = await repo.findOne({
      where: {
        tenant: { id: tenantId },
        idempotencyKey,
      } as any,
    });

    if (existing) {
      return this.verifyExisting(existing, payloadHash);
    }

    // 2. Ejecutar la acción que inserta el registro transaccionalmente
    try {
      return await repo.manager.transaction(async (manager) => {
        return await action(payloadHash, manager);
      });
    } catch (error: any) {
      // 3. Manejo de error de llave duplicada (solicitudes simultáneas)
      // Postgres error code 23505 = unique_violation
      if (
        error.code === "23505" &&
        error.constraint &&
        error.constraint.includes("tenant_idempotency")
      ) {
        this.logger.debug(
          `Idempotency collision detected for key ${idempotencyKey}. Re-reading...`,
        );
        // Volver a leer transaccionalmente
        existing = await repo.findOne({
          where: {
            tenant: { id: tenantId },
            idempotencyKey,
          } as any,
        });

        if (existing) {
          return this.verifyExisting(existing, payloadHash);
        }
      }
      throw error;
    }
  }

  private canonicalize(obj: any): string {
    if (obj === null || obj === undefined) return "";
    if (typeof obj !== "object") return String(obj);
    if (Array.isArray(obj)) {
      return "[" + obj.map((i) => this.canonicalize(i)).join(",") + "]";
    }
    const keys = Object.keys(obj).sort();
    let result = "{";
    for (let i = 0; i < keys.length; i++) {
      const key = keys[i];
      result += `"${key}":${this.canonicalize(obj[key])}`;
      if (i < keys.length - 1) result += ",";
    }
    result += "}";
    return result;
  }
}
