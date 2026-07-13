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
    switchToHttp: () => ({}),
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

  it("debe llamar a setSessionTenant con el tenantId del contexto", (done) => {
    (getTenantContext as jest.Mock).mockReturnValue({
      tenantId: "tenant-123",
      userId: "u1",
      role: "admin",
      requestId: "r1",
    });
    const setSpy = jest.spyOn(rlsService, "setSessionTenant");
    const next = { handle: () => of("done") };

    interceptor.intercept(mockContext, next).subscribe({
      complete: () => {
        expect(setSpy).toHaveBeenCalledWith("tenant-123");
        done();
      },
    });
  });

  it("debe omitir RLS si no hay tenant context", (done) => {
    (getTenantContext as jest.Mock).mockReturnValue(undefined);
    const setSpy = jest.spyOn(rlsService, "setSessionTenant");
    const next = { handle: () => of("done") };

    interceptor.intercept(mockContext, next).subscribe({
      complete: () => {
        expect(setSpy).not.toHaveBeenCalled();
        done();
      },
    });
  });

  it("debe manejar errores al establecer RLS", (done) => {
    (getTenantContext as jest.Mock).mockReturnValue({ tenantId: "tenant-123" });
    jest.spyOn(rlsService, "setSessionTenant").mockRejectedValue(new Error("set error"));
    
    // Accedemos a logger usando cast a any
    const loggerSpy = jest.spyOn((interceptor as any).logger, "error");
    const next = { handle: () => of("done") };

    interceptor.intercept(mockContext, next).subscribe({
      complete: () => {
        // Necesitamos esperar a que la promesa rechazada se maneje
        setTimeout(() => {
          expect(loggerSpy).toHaveBeenCalledWith("Failed to set RLS context: set error");
          done();
        }, 10);
      },
    });
  });

  it("debe manejar errores al limpiar RLS", (done) => {
    (getTenantContext as jest.Mock).mockReturnValue({ tenantId: "tenant-123" });
    jest.spyOn(rlsService, "setSessionTenant").mockResolvedValue(undefined);
    jest.spyOn(rlsService, "clearSessionTenant").mockRejectedValue(new Error("clear error"));
    
    const loggerSpy = jest.spyOn((interceptor as any).logger, "error");
    const next = { handle: () => of("done") };

    interceptor.intercept(mockContext, next).subscribe({
      complete: () => {
        // La limpieza ocurre en finalize, también es asíncrono
        setTimeout(() => {
          expect(loggerSpy).toHaveBeenCalledWith("Failed to clear RLS context: clear error");
          done();
        }, 10);
      },
    });
  });
});
