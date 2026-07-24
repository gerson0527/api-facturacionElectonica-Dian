import { Test, TestingModule } from "@nestjs/testing";
import { TenantRlsInterceptor } from "./tenant-rls.interceptor";
import { TenantRlsService } from "../database/tenant-rls.service";
import { getDataSourceToken } from "@nestjs/typeorm";
import { DataSource } from "typeorm";
import { of } from "rxjs";

jest.mock("../context/tenant-context", () => ({
  tenantContext: { run: jest.fn(), getStore: jest.fn() },
  getTenantContext: jest.fn(),
  TenantContextData: {},
}));

const { getTenantContext } = jest.requireMock("../context/tenant-context") as {
  getTenantContext: jest.Mock;
};

describe("TenantRlsInterceptor", () => {
  let interceptor: TenantRlsInterceptor;
  let rlsService: TenantRlsService;

  const mockContext = {
    switchToHttp: () => ({ getRequest: () => ({ tenantId: "tenant-123" }) }),
    getHandler: () => ({}),
    getClass: () => ({}),
  } as any;

  beforeEach(async () => {
    const mockQuery = jest.fn().mockResolvedValue([]);
    const mockDataSource = { query: mockQuery } as unknown as DataSource;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TenantRlsInterceptor,
        TenantRlsService,
        { provide: getDataSourceToken(), useValue: mockDataSource },
      ],
    }).compile();

    interceptor = module.get<TenantRlsInterceptor>(TenantRlsInterceptor);
    rlsService = module.get<TenantRlsService>(TenantRlsService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("debe limpiar RLS tras terminar request", (done) => {
    const clearSpy = jest.spyOn(rlsService, "clearSessionTenant").mockResolvedValue(undefined);
    const next = { handle: () => of("done") };

    interceptor.intercept(mockContext, next).subscribe({
      complete: () => {
        setTimeout(() => {
          expect(clearSpy).toHaveBeenCalled();
          done();
        }, 0);
      },
    });
  });

  it("debe omitir RLS si no hay tenant context", (done) => {
    const ctx = {
      switchToHttp: () => ({ getRequest: () => ({ tenantId: null }) }),
    } as any;
    const clearSpy = jest.spyOn(rlsService, "clearSessionTenant");
    const next = { handle: () => of("done") };

    interceptor.intercept(ctx, next).subscribe({
      complete: () => {
        setTimeout(() => {
          expect(clearSpy).not.toHaveBeenCalled();
          done();
        }, 0);
      },
    });
  });

  it("debe manejar errores silenciados al limpiar RLS", (done) => {
    const clearSpy = jest.spyOn(rlsService, "clearSessionTenant").mockRejectedValue(new Error("clear error"));
    const next = { handle: () => of("done") };

    interceptor.intercept(mockContext, next).subscribe({
      complete: () => {
        setTimeout(() => {
          expect(clearSpy).toHaveBeenCalled();
          done();
        }, 0);
      },
    });
  });
});
