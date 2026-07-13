import { NotFoundException } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import { getRepositoryToken } from "@nestjs/typeorm";
import { Customer } from "@/database/entities/customer.entity";
import { CustomersService } from "./customers.service";

describe("CustomersService", () => {
  let service: CustomersService;

  const customerRepo = {
    create: jest.fn(),
    save: jest.fn(),
    find: jest.fn(),
    findOne: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CustomersService,
        { provide: getRepositoryToken(Customer), useValue: customerRepo },
      ],
    }).compile();

    service = module.get<CustomersService>(CustomersService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("create asigna responsabilidad fiscal por defecto cuando no viene en payload", async () => {
    customerRepo.create.mockImplementation(
      (payload: Partial<Customer>) => payload,
    );
    customerRepo.save.mockImplementation(
      async (payload: Partial<Customer>) => payload,
    );

    const result = await service.create("tenant-1", {
      documentType: "31",
      documentNumber: "900123123",
      name: "Cliente Uno",
    });

    expect(customerRepo.create).toHaveBeenCalledWith({
      tenantId: "tenant-1",
      documentType: "31",
      documentNumber: "900123123",
      name: "Cliente Uno",
      fiscalResponsibilities: ["O-99"],
    });
    expect(result.fiscalResponsibilities).toEqual(["O-99"]);
  });

  it("findByTenant consulta ordenado por nombre ascendente", async () => {
    customerRepo.find.mockResolvedValue([{ id: "c-1" }]);

    const result = await service.findByTenant("tenant-1");

    expect(customerRepo.find).toHaveBeenCalledWith({
      where: { tenantId: "tenant-1" },
      order: { name: "ASC" },
    });
    expect(result).toEqual([{ id: "c-1" }]);
  });

  it("findOne lanza not found si el cliente no existe", async () => {
    customerRepo.findOne.mockResolvedValue(null);

    await expect(service.findOne("missing", "tenant-1")).rejects.toThrow(
      new NotFoundException("Cliente no encontrado"),
    );
  });
});
