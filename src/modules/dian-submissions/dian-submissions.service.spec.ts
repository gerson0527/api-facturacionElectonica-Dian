import { NotFoundException } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import { getRepositoryToken } from "@nestjs/typeorm";
import { DianSubmission } from "@/database/entities/dian-submission.entity";
import { Invoice } from "@/database/entities/invoice.entity";
import { DianSubmissionsService } from "./dian-submissions.service";

describe("DianSubmissionsService", () => {
  let service: DianSubmissionsService;

  const submissionRepo = {
    findOne: jest.fn(),
    find: jest.fn(),
  };

  const invoiceRepo = {
    findOne: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DianSubmissionsService,
        {
          provide: getRepositoryToken(DianSubmission),
          useValue: submissionRepo,
        },
        { provide: getRepositoryToken(Invoice), useValue: invoiceRepo },
      ],
    }).compile();

    service = module.get<DianSubmissionsService>(DianSubmissionsService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("findOne retorna el envío cuando existe", async () => {
    submissionRepo.findOne.mockResolvedValue({ id: "sub-1" });

    const result = await service.findOne("sub-1");

    expect(submissionRepo.findOne).toHaveBeenCalledWith({
      where: { id: "sub-1" },
    });
    expect(result).toEqual({ id: "sub-1" });
  });

  it("findOne lanza not found cuando el envío no existe", async () => {
    submissionRepo.findOne.mockResolvedValue(null);

    await expect(service.findOne("missing")).rejects.toThrow(
      new NotFoundException("Envío no encontrado"),
    );
  });

  it("findByInvoice consulta en orden descendente por intento", async () => {
    submissionRepo.find.mockResolvedValue([{ id: "sub-2" }, { id: "sub-1" }]);

    const result = await service.findByInvoice("inv-1");

    expect(submissionRepo.find).toHaveBeenCalledWith({
      where: { invoiceId: "inv-1" },
      order: { attemptNumber: "DESC" },
    });
    expect(result).toEqual([{ id: "sub-2" }, { id: "sub-1" }]);
  });
});
