import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Test, TestingModule } from '@nestjs/testing';
import * as bcrypt from 'bcrypt';
import { Repository } from 'typeorm';
import { Tenant } from '@/database/entities/tenant.entity';
import { User } from '@/database/entities/user.entity';
import { AuthService } from './auth.service';
import { JwtStrategy } from './jwt.strategy';

describe('AuthService', () => {
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

  const buildUser = async (overrides: Partial<User> = {}): Promise<User> => ({
    id: 'user-1',
    tenantId: 'tenant-1',
    email: 'test@test.com',
    hashedPassword: await bcrypt.hash('correctpass', 10),
    fullName: 'Test User',
    role: 'tenant_admin',
    isActive: true,
    ...overrides,
  } as User);

  beforeEach(async () => {
    process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-key-for-testing-purposes!';
    process.env.JWT_REFRESH_EXPIRATION = '7d';

    const module: TestingModule = await Test.createTestingModule({
      imports: [
        JwtModule.registerAsync({
          useFactory: () => ({
            secret: 'test-secret-key-for-jwt-testing-purposes-only!',
            signOptions: { expiresIn: '60m' },
          }),
        }),
      ],
      providers: [
        AuthService,
        JwtStrategy,
        {
          provide: ConfigService,
          useValue: {
            get: (key: string) => {
              if (key === 'JWT_ACCESS_SECRET') return 'test-secret-key-for-jwt-testing-purposes-only!';
              if (key === 'JWT_REFRESH_SECRET') return process.env.JWT_REFRESH_SECRET;
              if (key === 'JWT_ACCESS_EXPIRATION') return '60m';
              if (key === 'JWT_REFRESH_EXPIRATION') return process.env.JWT_REFRESH_EXPIRATION;
              return undefined;
            },
            getOrThrow: (key: string) => {
              if (key === 'JWT_ACCESS_SECRET') return 'test-secret-key-for-jwt-testing-purposes-only!';
              throw new Error(`Missing key: ${key}`);
            },
          },
        },
        { provide: getRepositoryToken(User), useValue: mockUserRepo },
        { provide: getRepositoryToken(Tenant), useValue: mockTenantRepo },
      ],
    }).compile();

    authService = module.get<AuthService>(AuthService);
    jwtService = module.get<JwtService>(JwtService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('rechaza login si el usuario no existe', async () => {
    mockUserRepo.findOne.mockResolvedValue(null);

    await expect(authService.login('test@test.com', 'wrongpass')).rejects.toThrow(
      new UnauthorizedException('Credenciales inválidas'),
    );

    expect(mockUserRepo.findOne).toHaveBeenCalledWith({
      where: { email: 'test@test.com', isActive: true },
      relations: ['tenant'],
    });
  });

  it('rechaza login con contraseña incorrecta', async () => {
    mockUserRepo.findOne.mockResolvedValue(await buildUser());

    await expect(authService.login('test@test.com', 'wrongpass')).rejects.toThrow(
      new UnauthorizedException('Credenciales inválidas'),
    );
  });

  it('retorna access y refresh tokens válidos en login exitoso', async () => {
    const user = await buildUser();
    mockUserRepo.findOne.mockResolvedValue(user);

    const tokens = await authService.login(user.email, 'correctpass');

    expect(tokens.accessToken).toBeTruthy();
    expect(tokens.refreshToken).toBeTruthy();

    const accessPayload = jwtService.verify(tokens.accessToken);
    const refreshPayload = jwtService.verify(tokens.refreshToken, {
      secret: process.env.JWT_REFRESH_SECRET,
    });

    expect(accessPayload).toMatchObject({
      sub: user.id,
      tenant_id: user.tenantId,
      role: user.role,
      email: user.email,
      type: 'access',
    });
    expect(refreshPayload).toMatchObject({
      sub: user.id,
      tenant_id: user.tenantId,
      role: user.role,
      email: user.email,
      type: 'refresh',
    });
  });

  it('rechaza refresh con token inválido', async () => {
    await expect(authService.refresh('invalid-token')).rejects.toThrow(
      new UnauthorizedException('Refresh token inválido o expirado'),
    );
    expect(mockUserRepo.findOne).not.toHaveBeenCalled();
  });

  it('rechaza refresh si el usuario del token no existe', async () => {
    const refreshToken = jwtService.sign(
      {
        sub: 'missing-user',
        tenant_id: 'tenant-1',
        role: 'tenant_admin',
        email: 'missing@test.com',
        type: 'refresh',
      },
      {
        secret: process.env.JWT_REFRESH_SECRET,
      },
    );
    mockUserRepo.findOne.mockResolvedValue(null);

    await expect(authService.refresh(refreshToken)).rejects.toThrow(
      new UnauthorizedException('Refresh token inválido o expirado'),
    );

    expect(mockUserRepo.findOne).toHaveBeenCalledWith({
      where: { id: 'missing-user', isActive: true },
      relations: ['tenant'],
    });
  });

  it('genera nuevos tokens en refresh válido', async () => {
    const user = await buildUser();
    const refreshToken = jwtService.sign(
      {
        sub: user.id,
        tenant_id: user.tenantId,
        role: user.role,
        email: user.email,
        type: 'refresh',
      },
      {
        secret: process.env.JWT_REFRESH_SECRET,
      },
    );
    mockUserRepo.findOne.mockResolvedValue(user);

    const tokens = await authService.refresh(refreshToken);
    const accessPayload = jwtService.verify(tokens.accessToken);
    const refreshedPayload = jwtService.verify(tokens.refreshToken, {
      secret: process.env.JWT_REFRESH_SECRET,
    });

    expect(accessPayload.type).toBe('access');
    expect(refreshedPayload.type).toBe('refresh');
    expect(accessPayload.sub).toBe(user.id);
    expect(refreshedPayload.sub).toBe(user.id);
  });

  it('createUser guarda contraseña hasheada y no en claro', async () => {
    mockUserRepo.create.mockImplementation((payload) => ({ id: 'new-user-id', ...payload }));
    mockUserRepo.save.mockImplementation(async (payload) => payload);

    const user = await authService.createUser(
      'tenant-1',
      'new@user.com',
      'password123',
      'New User',
      'tenant_user',
    );

    expect(mockUserRepo.save).toHaveBeenCalled();
    expect(user.hashedPassword).not.toBe('password123');
    await expect(bcrypt.compare('password123', user.hashedPassword)).resolves.toBe(true);
  });
});
