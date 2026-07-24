import { Test, TestingModule } from "@nestjs/testing";
import { OutboxRelayService } from "./outbox-relay.service";
import { getRepositoryToken } from "@nestjs/typeorm";
import { OutboxEvent } from "../../database/entities/outbox-event.entity";
import { DianSubmission } from "../../database/entities/dian-submission.entity";
import { getQueueToken } from "@nestjs/bullmq";
import { ConfigService } from "@nestjs/config";

describe("OutboxRelayService", () => {
  let service: OutboxRelayService;
  let outboxRepo: any;
  let submissionRepo: any;
  let submissionQueue: any;
  let configService: any;

  beforeEach(async () => {
    outboxRepo = {
      find: jest.fn(),
      update: jest.fn(),
    };
    submissionRepo = {
      findOne: jest.fn(),
    };
    submissionQueue = {
      add: jest.fn(),
    };
    configService = {
      get: jest.fn().mockReturnValue(5),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OutboxRelayService,
        { provide: getRepositoryToken(OutboxEvent), useValue: outboxRepo },
        { provide: getRepositoryToken(DianSubmission), useValue: submissionRepo },
        { provide: getQueueToken("dian-submission"), useValue: submissionQueue },
        { provide: ConfigService, useValue: configService },
      ],
    }).compile();

    service = module.get<OutboxRelayService>(OutboxRelayService);
  });

  it("should be defined", () => {
    expect(service).toBeDefined();
  });

  describe("processOutbox", () => {
    it("should process pending events and enqueue them", async () => {
      const mockEvent = { id: "1", eventType: "INVOICE_CREATED", aggregateId: "inv-1", tenantId: "t-1" };
      const mockSubmission = { id: "sub-1", requestZipPath: "path/to.zip" };
      
      outboxRepo.find.mockResolvedValue([mockEvent]);
      submissionRepo.findOne.mockResolvedValue(mockSubmission);
      submissionQueue.add.mockResolvedValue({});

      await service.processOutbox();

      expect(outboxRepo.find).toHaveBeenCalled();
      expect(submissionRepo.findOne).toHaveBeenCalledWith({
        where: { invoiceId: "inv-1", attemptNumber: 1 },
      });
      expect(submissionQueue.add).toHaveBeenCalledWith(
        "dian-submission",
        expect.objectContaining({
          submissionId: "sub-1",
          invoiceId: "inv-1",
        }),
        expect.any(Object)
      );
      expect(outboxRepo.update).toHaveBeenCalledWith("1", expect.objectContaining({ status: "processed" }));
    });

    it("should handle unknown event types and mark as failed", async () => {
      const mockEvent = { id: "1", eventType: "UNKNOWN" };
      outboxRepo.find.mockResolvedValue([mockEvent]);

      await service.processOutbox();

      expect(outboxRepo.update).toHaveBeenCalledWith("1", expect.objectContaining({ status: "failed" }));
    });
  });

  describe("retryDlq", () => {
    it("should reset failed events to pending", async () => {
      const mockEvent = { id: "1", status: "failed" };
      outboxRepo.find.mockResolvedValue([mockEvent]);

      const result = await service.retryDlq();

      expect(result).toEqual({ retried: 1 });
      expect(outboxRepo.update).toHaveBeenCalledWith("1", expect.objectContaining({ status: "pending" }));
    });
  });
});
