import { Test, TestingModule } from "@nestjs/testing";
import { TenantRlsService } from "./tenant-rls.service";
import { getDataSourceToken } from "@nestjs/typeorm";
import { DataSource } from "typeorm";

describe("TenantRlsService", () => {
  let service: TenantRlsService;
  let mockQuery: jest.Mock;

  beforeEach(async () => {
    mockQuery = jest.fn().mockResolvedValue([]);
    const mockDataSource = { query: mockQuery } as unknown as DataSource;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TenantRlsService,
        { provide: getDataSourceToken(), useValue: mockDataSource },
      ],
    }).compile();

    service = module.get<TenantRlsService>(TenantRlsService);
  });

  it("debe ejecutar set_config con el tenantId", async () => {
    await service.setSessionTenant("abc-123");
    expect(mockQuery).toHaveBeenCalledWith(
      `SELECT set_config('app.tenant_id', $1, false)`,
      ["abc-123"],
    );
  });

  it("debe ejecutar set_config con string vacío para limpiar", async () => {
    await service.clearSessionTenant();
    expect(mockQuery).toHaveBeenCalledWith(
      `SELECT set_config('app.tenant_id', '', false)`,
    );
  });

  it("debe propagar el error si la consulta falla", async () => {
    const error = new Error("connection lost");
    mockQuery.mockRejectedValueOnce(error);
    await expect(service.setSessionTenant("abc-123")).rejects.toThrow(error);
  });
});
