import { Test, TestingModule } from "@nestjs/testing";
import { IdempotencyService } from "./idempotency.service";
import { ConflictException } from "@nestjs/common";

describe("IdempotencyService", () => {
  let service: IdempotencyService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [IdempotencyService],
    }).compile();

    service = module.get<IdempotencyService>(IdempotencyService);
  });

  describe("generateHash & canonicalize", () => {
    it("should generate same hash for same payload regardless of key order", () => {
      const payload1 = { a: 1, b: 2 };
      const payload2 = { b: 2, a: 1 };
      expect(service.generateHash(payload1)).toBe(service.generateHash(payload2));
    });

    it("should handle nulls, arrays and primitives", () => {
      const payload = { arr: [1, null, "test"], num: 42, bool: true, undef: undefined };
      const hash = service.generateHash(payload);
      expect(hash).toBeDefined();
      expect(typeof hash).toBe("string");
    });
  });

  describe("executeWithIdempotency", () => {
    let mockRepo: any;
    const tenantId = "tenant-1";
    const idempotencyKey = "key-123";
    const payload = { test: true };
    const hash = "1bfba349e59ed183eb42323f4da376a928baeb09d2efed9b1ee2cd4f38719c81";

    beforeEach(() => {
      mockRepo = {
        findOne: jest.fn(),
        manager: {
          transaction: jest.fn(),
        },
      };
      jest.spyOn(service, "generateHash").mockReturnValue(hash);
    });

    it("should return existing result if found initially and hash matches", async () => {
      mockRepo.findOne.mockResolvedValue({
        idempotencyKey,
        requestPayloadHash: hash,
        responseSnapshot: { id: "inv-1" },
        responseStatusCode: 201,
      });

      const action = jest.fn();
      const result = await service.executeWithIdempotency(tenantId, idempotencyKey, payload, mockRepo, action);

      expect(mockRepo.findOne).toHaveBeenCalledWith(expect.objectContaining({ where: { tenant: { id: tenantId }, idempotencyKey } }));
      expect(action).not.toHaveBeenCalled();
      expect(result).toEqual({ snapshot: { id: "inv-1" }, statusCode: 201 });
    });

    it("should throw ConflictException if found initially but hash differs", async () => {
      mockRepo.findOne.mockResolvedValue({
        idempotencyKey,
        requestPayloadHash: "different-hash",
        responseSnapshot: { id: "inv-1" },
        responseStatusCode: 201,
      });

      await expect(service.executeWithIdempotency(tenantId, idempotencyKey, payload, mockRepo, jest.fn()))
        .rejects.toThrow(ConflictException);
    });

    it("should execute action if not found", async () => {
      mockRepo.findOne.mockResolvedValue(null);
      mockRepo.manager.transaction.mockImplementation(async (cb: any) => cb("fake_manager"));
      
      const action = jest.fn().mockResolvedValue({ snapshot: { id: "new-inv" }, statusCode: 201 });

      const result = await service.executeWithIdempotency(tenantId, idempotencyKey, payload, mockRepo, action);

      expect(action).toHaveBeenCalledWith(hash, "fake_manager");
      expect(result).toEqual({ snapshot: { id: "new-inv" }, statusCode: 201 });
    });

    it("should handle 23505 unique violation and re-read", async () => {
      mockRepo.findOne.mockResolvedValueOnce(null);
      
      mockRepo.manager.transaction.mockImplementation(async () => {
        const error: any = new Error("Duplicate key");
        error.code = "23505";
        error.constraint = "uq_invoices_tenant_idempotency";
        throw error;
      });

      mockRepo.findOne.mockResolvedValueOnce({
        idempotencyKey,
        requestPayloadHash: hash,
        responseSnapshot: { id: "inv-2" },
        responseStatusCode: 200,
      });

      const action = jest.fn();
      const result = await service.executeWithIdempotency(tenantId, idempotencyKey, payload, mockRepo, action);

      expect(mockRepo.findOne).toHaveBeenCalledTimes(2);
      expect(result).toEqual({ snapshot: { id: "inv-2" }, statusCode: 200 });
    });

    it("should throw the 23505 error if re-read still yields null", async () => {
      mockRepo.findOne.mockResolvedValue(null);
      mockRepo.manager.transaction.mockImplementation(async () => {
        const error: any = new Error("Duplicate key");
        error.code = "23505";
        error.constraint = "uq_invoices_tenant_idempotency";
        throw error;
      });

      await expect(service.executeWithIdempotency(tenantId, idempotencyKey, payload, mockRepo, jest.fn()))
        .rejects.toThrow("Duplicate key");
    });

    it("should re-throw non-23505 errors", async () => {
      mockRepo.findOne.mockResolvedValue(null);
      mockRepo.manager.transaction.mockImplementation(async () => {
        throw new Error("Generic DB error");
      });

      await expect(service.executeWithIdempotency(tenantId, idempotencyKey, payload, mockRepo, jest.fn()))
        .rejects.toThrow("Generic DB error");
    });
  });
});
