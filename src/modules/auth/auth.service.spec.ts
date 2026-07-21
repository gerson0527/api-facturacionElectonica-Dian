import { UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtModule, JwtService } from "@nestjs/jwt";
import { getRepositoryToken } from "@nestjs/typeorm";
import { Test, TestingModule } from "@nestjs/testing";
import * as bcrypt from "bcrypt";
import { Tenant } from "@/database/entities/tenant.entity";
import { User } from "@/database/entities/user.entity";
import { RefreshToken } from "@/database/entities/refresh-token.entity";
import { AuthService } from "./auth.service";
import { RefreshTokenService } from "./refresh-token.service";
import { JwtStrategy } from "./jwt.strategy";

describe("AuthService", () => {
  let authService: AuthService;
  let jwtService: JwtService;

  const mockUserRepo = {
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
  };

  const mockTenantRepo = {
    findOne: jest.fn(),
  };

  const buildQueryBuilder = (affected: number) => ({
    update: () => ({
      set: () => ({
        where: () => ({
          returning: () => ({
            execute: () => Promise.resolve({ affected, raw: [] }),
          }),
        }),
      }),
    }),
  });

  const mockRefreshTokenRepo = {
    findOne: jest.fn(),
    create: jest.fn(),
    upsert: jest.fn(),
    update: jest.fn(),
    save: jest.fn(),
    find: jest.fn(),
    delete: jest.fn(),
    createQueryBuilder: jest.fn(),
  };

  const buildUser = async (overrides: Partial<User> = {}): Promise<User> =>
    ({
      id: "user-1",
      tenantId: "tenant-1",
      email: "test@test.com",
      hashedPassword: await bcrypt.hash("correctpass", 10),
      fullName: "Test User",
      role: "tenant_admin",
      isActive: true,
      failedAttempts: 0,
      lockedUntil: null,
      ...overrides,
    }) as User;

  beforeEach(async () => {
    process.env.JWT_REFRESH_SECRET =
      "test-refresh-secret-key-for-testing-purposes!";
    process.env.JWT_REFRESH_EXPIRATION = "7d";

    const module: TestingModule = await Test.createTestingModule({
      imports: [
        JwtModule.registerAsync({
          useFactory: () => ({
            secret: "test-secret-key-for-jwt-testing-purposes-only!",
            signOptions: { expiresIn: "60m" },
          }),
        }),
      ],
      providers: [
        AuthService,
        RefreshTokenService,
        JwtStrategy,
        {
          provide: ConfigService,
          useValue: {
            get: (key: string) => {
              if (key === "JWT_ACCESS_SECRET")
                return "test-secret-key-for-jwt-testing-purposes-only!";
              if (key === "JWT_REFRESH_SECRET")
                return process.env.JWT_REFRESH_SECRET;
              if (key === "JWT_ACCESS_EXPIRATION") return "15m";
              if (key === "JWT_REFRESH_EXPIRATION")
                return process.env.JWT_REFRESH_EXPIRATION;
              return undefined;
            },
            getOrThrow: (key: string) => {
              if (key === "JWT_ACCESS_SECRET")
                return "test-secret-key-for-jwt-testing-purposes-only!";
              throw new Error(`Missing key: ${key}`);
            },
          },
        },
        { provide: getRepositoryToken(User), useValue: mockUserRepo },
        { provide: getRepositoryToken(Tenant), useValue: mockTenantRepo },
        {
          provide: getRepositoryToken(RefreshToken),
          useValue: mockRefreshTokenRepo,
        },
      ],
    }).compile();

    authService = module.get<AuthService>(AuthService);
    jwtService = module.get<JwtService>(JwtService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("rechaza login si el usuario no existe", async () => {
    mockUserRepo.findOne.mockResolvedValue(null);

    await expect(
      authService.login("test@test.com", "wrongpass"),
    ).rejects.toThrow(new UnauthorizedException("Credenciales inválidas"));

    expect(mockUserRepo.findOne).toHaveBeenCalledWith({
      where: { email: "test@test.com", isActive: true },
      relations: ["tenant"],
    });
  });

  it("rechaza login con contraseña incorrecta", async () => {
    mockUserRepo.findOne.mockResolvedValue(await buildUser());

    await expect(
      authService.login("test@test.com", "wrongpass"),
    ).rejects.toThrow(new UnauthorizedException("Credenciales inválidas"));
  });

  it("retorna access y refresh tokens válidos en login exitoso", async () => {
    const user = await buildUser();
    mockUserRepo.findOne.mockResolvedValue(user);
    mockRefreshTokenRepo.upsert.mockResolvedValue({});

    const tokens = await authService.login(user.email, "correctpass");

    expect(tokens.accessToken).toBeTruthy();
    expect(tokens.refreshToken).toBeTruthy();

    const accessPayload = jwtService.verify(tokens.accessToken, {
      secret: "test-secret-key-for-jwt-testing-purposes-only!",
    });
    const refreshPayload = jwtService.verify(tokens.refreshToken, {
      secret: process.env.JWT_REFRESH_SECRET,
    });

    expect(accessPayload).toMatchObject({
      sub: user.id,
      tenant_id: user.tenantId,
      role: user.role,
      email: user.email,
      type: "access",
    });
    expect(refreshPayload).toMatchObject({
      sub: user.id,
      tenant_id: user.tenantId,
      type: "refresh",
    });
    expect(refreshPayload.jti).toBeTruthy();
  });

  it("rechaza refresh con token inválido", async () => {
    await expect(authService.refresh("invalid-token")).rejects.toThrow(
      new UnauthorizedException("Invalid refresh token"),
    );
    expect(mockUserRepo.findOne).not.toHaveBeenCalled();
  });

  it("rechaza refresh si el token no es de tipo refresh", async () => {
    const accessToken = jwtService.sign(
      {
        sub: "user-1",
        tenant_id: "tenant-1",
        role: "tenant_admin",
        email: "test@test.com",
        type: "access",
      },
      { secret: process.env.JWT_REFRESH_SECRET },
    );

    await expect(authService.refresh(accessToken)).rejects.toThrow(
      new UnauthorizedException("Token type mismatch"),
    );
  });

  it("rechaza refresh si el token fue consumido (atomic)", async () => {
    const refreshToken = jwtService.sign(
      {
        sub: "user-1",
        tenant_id: "tenant-1",
        type: "refresh",
        jti: "test-jti-consumed",
      },
      { secret: process.env.JWT_REFRESH_SECRET },
    );
    mockRefreshTokenRepo.createQueryBuilder.mockReturnValue(
      buildQueryBuilder(0),
    );
    mockRefreshTokenRepo.findOne.mockResolvedValue({
      jti: "test-jti-consumed",
      userId: "user-1",
      tenantId: "tenant-1",
      consumedAt: new Date(),
      revokedAt: null,
      expiresAt: new Date(Date.now() + 100000),
    });
    mockRefreshTokenRepo.find.mockResolvedValue([]);

    await expect(authService.refresh(refreshToken)).rejects.toThrow(
      new UnauthorizedException("Refresh token revoked or expired"),
    );
  });

  it("rechaza refresh si el usuario del token no existe", async () => {
    const refreshToken = jwtService.sign(
      {
        sub: "missing-user",
        tenant_id: "tenant-1",
        role: "tenant_admin",
        email: "missing@test.com",
        type: "refresh",
        jti: "test-jti-001",
      },
      {
        secret: process.env.JWT_REFRESH_SECRET,
      },
    );
    mockRefreshTokenRepo.createQueryBuilder.mockReturnValue(
      buildQueryBuilder(1),
    );
    mockRefreshTokenRepo.findOne.mockResolvedValue({
      jti: "test-jti-001",
      userId: "missing-user",
      tenantId: "tenant-1",
      consumedAt: new Date(),
      revokedAt: null,
      expiresAt: new Date(Date.now() + 100000),
    });
    mockRefreshTokenRepo.upsert.mockResolvedValue({});
    mockUserRepo.findOne.mockResolvedValue(null);

    await expect(authService.refresh(refreshToken)).rejects.toThrow(
      new UnauthorizedException("Usuario no encontrado"),
    );
  });

  it("genera nuevos tokens en refresh válido", async () => {
    const user = await buildUser();
    const refreshToken = jwtService.sign(
      {
        sub: user.id,
        tenant_id: user.tenantId,
        role: user.role,
        email: user.email,
        type: "refresh",
        jti: "test-jti-002",
      },
      {
        secret: process.env.JWT_REFRESH_SECRET,
      },
    );
    mockRefreshTokenRepo.createQueryBuilder.mockReturnValue(
      buildQueryBuilder(1),
    );
    mockRefreshTokenRepo.findOne.mockResolvedValue({
      jti: "test-jti-002",
      userId: user.id,
      tenantId: user.tenantId,
      consumedAt: new Date(),
      revokedAt: null,
      expiresAt: new Date(Date.now() + 100000),
    });
    mockRefreshTokenRepo.upsert.mockResolvedValue({});
    mockUserRepo.findOne.mockResolvedValue(user);

    const tokens = await authService.refresh(refreshToken);
    const accessPayload = jwtService.verify(tokens.accessToken, {
      secret: "test-secret-key-for-jwt-testing-purposes-only!",
    });
    const refreshedPayload = jwtService.verify(tokens.refreshToken, {
      secret: process.env.JWT_REFRESH_SECRET,
    });

    expect(accessPayload.type).toBe("access");
    expect(refreshedPayload.type).toBe("refresh");
    expect(accessPayload.sub).toBe(user.id);
    expect(refreshedPayload.sub).toBe(user.id);
    expect(refreshedPayload.jti).toBeTruthy();
  });

  it("createUser guarda contraseña hasheada y no en claro", async () => {
    mockUserRepo.create.mockImplementation((payload) => ({
      id: "new-user-id",
      ...payload,
    }));
    mockUserRepo.save.mockImplementation(async (payload) => payload);

    const user = await authService.createUser(
      "tenant-1",
      "new@user.com",
      "password123",
      "New User",
      "tenant_user",
    );

    expect(mockUserRepo.save).toHaveBeenCalled();
    expect(user.hashedPassword).not.toBe("password123");
    await expect(
      bcrypt.compare("password123", user.hashedPassword),
    ).resolves.toBe(true);
  });
});
