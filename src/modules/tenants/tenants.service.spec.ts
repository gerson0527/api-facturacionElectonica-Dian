import { ConflictException, NotFoundException } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import { getRepositoryToken } from "@nestjs/typeorm";
import * as bcrypt from "bcrypt";
import { Tenant } from "@/database/entities/tenant.entity";
import { User } from "@/database/entities/user.entity";
import { TenantsService } from "./tenants.service";

describe("TenantsService", () => {
  let service: TenantsService;

  const tenantRepo = {
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    find: jest.fn(),
  };

  const userRepo = {
    create: jest.fn(),
    save: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TenantsService,
        { provide: getRepositoryToken(Tenant), useValue: tenantRepo },
        { provide: getRepositoryToken(User), useValue: userRepo },
      ],
    }).compile();

    service = module.get<TenantsService>(TenantsService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("lanza conflicto si ya existe tenant con el mismo NIT", async () => {
    tenantRepo.findOne.mockResolvedValue({ id: "t-1", nit: "900123123" });

    await expect(
      service.create({ name: "ACME", nit: "900123123" }),
    ).rejects.toThrow(new ConflictException("Ya existe un tenant con ese NIT"));
  });

  it("crea tenant y usuario admin con valores por defecto", async () => {
    tenantRepo.findOne.mockResolvedValue(null);
    tenantRepo.create.mockImplementation((payload: Partial<Tenant>) => payload);
    tenantRepo.save.mockResolvedValue({
      id: "tenant-1",
      name: "ACME",
      nit: "900123123",
      dv: "0",
      enabled: true,
      environment: "habilitacion",
    });
    userRepo.create.mockImplementation((payload: Partial<User>) => payload);
    userRepo.save.mockResolvedValue({ id: "user-1" });

    const tenant = await service.create({
      name: "ACME",
      nit: "900123123",
    });

    expect(tenant.id).toBe("tenant-1");
    expect(tenantRepo.create).toHaveBeenCalledWith({
      name: "ACME",
      nit: "900123123",
      dv: "0",
      address: undefined,
      phone: undefined,
      email: undefined,
      enabled: true,
      environment: "habilitacion",
    });

    expect(userRepo.create).toHaveBeenCalledTimes(1);
    const createdAdmin = userRepo.create.mock.calls[0][0] as Partial<User>;
    expect(createdAdmin.tenantId).toBe("tenant-1");
    expect(createdAdmin.email).toBe("admin@900123123.com");
    expect(createdAdmin.fullName).toBe("Admin ACME");
    expect(createdAdmin.role).toBe("tenant_admin");
    expect(createdAdmin.isActive).toBe(true);
    expect(
      await bcrypt.compare("admin123", createdAdmin.hashedPassword as string),
    ).toBe(true);
  });

  it("findById lanza not found cuando el tenant no existe", async () => {
    tenantRepo.findOne.mockResolvedValue(null);

    await expect(service.findById("missing")).rejects.toThrow(
      new NotFoundException("Tenant no encontrado"),
    );
  });

  it("findAll solo consulta tenants habilitados", async () => {
    tenantRepo.find.mockResolvedValue([{ id: "t-1" }]);

    const result = await service.findAll();

    expect(tenantRepo.find).toHaveBeenCalledWith({ where: { enabled: true } });
    expect(result).toEqual([{ id: "t-1" }]);
  });
});
