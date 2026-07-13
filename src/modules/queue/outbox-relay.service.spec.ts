import { Test, TestingModule } from "@nestjs/testing";
import { OutboxRelayService } from "./outbox-relay.service";
import { getRepositoryToken } from "@nestjs/typeorm";
import { OutboxEvent } from "../../database/entities/outbox-event.entity";
import { DianOutboxService } from "../../services/dian-outbox.service";

describe("OutboxRelayService", () => {
  let service: OutboxRelayService;
  let repo: any;
  let dianOutbox: any;

  beforeEach(async () => {
    repo = {
      find: jest.fn(),
      save: jest.fn(),
    };
    dianOutbox = {
      processEvent: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OutboxRelayService,
        { provide: getRepositoryToken(OutboxEvent), useValue: repo },
        { provide: DianOutboxService, useValue: dianOutbox },
      ],
    }).compile();

    service = module.get<OutboxRelayService>(OutboxRelayService);
  });

  it("should be defined", () => {
    expect(service).toBeDefined();
  });

  describe("processOutbox", () => {
    it("should process pending events", async () => {
      const mockEvent = { id: "1", type: "INVOICE_SUBMIT", payload: {}, status: "PENDING", attempts: 0 };
      repo.find.mockResolvedValue([mockEvent]);
      dianOutbox.processEvent.mockResolvedValue(true);

      await service.processOutbox();

      expect(repo.find).toHaveBeenCalled();
      expect(dianOutbox.processEvent).toHaveBeenCalledWith(mockEvent);
      expect(mockEvent.status).toBe("PROCESSED");
      expect(repo.save).toHaveBeenCalledWith(mockEvent);
    });

    it("should handle processing errors and increment attempts", async () => {
      const mockEvent = { id: "1", type: "INVOICE_SUBMIT", payload: {}, status: "PENDING", attempts: 0 };
      repo.find.mockResolvedValue([mockEvent]);
      dianOutbox.processEvent.mockRejectedValue(new Error("Network Error"));

      await service.processOutbox();

      expect(mockEvent.status).toBe("FAILED");
      expect(mockEvent.attempts).toBe(1);
      expect(repo.save).toHaveBeenCalledWith(mockEvent);
    });

    it("should mark as DLQ if max attempts reached", async () => {
      const mockEvent = { id: "1", type: "INVOICE_SUBMIT", payload: {}, status: "PENDING", attempts: 4 };
      repo.find.mockResolvedValue([mockEvent]);
      dianOutbox.processEvent.mockRejectedValue(new Error("Network Error"));

      await service.processOutbox();

      expect(mockEvent.status).toBe("DLQ");
      expect(mockEvent.attempts).toBe(5);
      expect(repo.save).toHaveBeenCalledWith(mockEvent);
    });
  });

  describe("retryDlq", () => {
    it("should reset DLQ events to PENDING", async () => {
      const mockEvent = { id: "1", status: "DLQ" };
      repo.find.mockResolvedValue([mockEvent]);

      const result = await service.retryDlq();

      expect(result).toBe(1);
      expect(mockEvent.status).toBe("PENDING");
      expect(repo.save).toHaveBeenCalledWith(mockEvent);
    });
  });
});
