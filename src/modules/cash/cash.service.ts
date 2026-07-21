import { Injectable, BadRequestException, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { CashRegister } from '../../database/entities/cash-register.entity';
import { CashSession } from '../../database/entities/cash-session.entity';
import { CashMovement } from '../../database/entities/cash-movement.entity';

@Injectable()
export class CashService {
  constructor(
    @InjectRepository(CashRegister) private registerRepo: Repository<CashRegister>,
    @InjectRepository(CashSession) private sessionRepo: Repository<CashSession>,
    @InjectRepository(CashMovement) private movementRepo: Repository<CashMovement>,
    private dataSource: DataSource,
  ) {}

  async listRegisters(tenantId: string): Promise<CashRegister[]> {
    return this.registerRepo.find({ where: { tenantId, active: true }, order: { name: 'ASC' } });
  }

  async createRegister(tenantId: string, data: Partial<CashRegister>): Promise<CashRegister> {
    const reg = this.registerRepo.create({ ...data, tenantId });
    return this.registerRepo.save(reg);
  }

  async listSessions(tenantId: string, status?: string): Promise<CashSession[]> {
    const where: any = { tenantId };
    if (status) where.status = status;
    return this.sessionRepo.find({ where, order: { openedAt: 'DESC' } });
  }

  async getOpenSession(userId: string, tenantId: string): Promise<CashSession | null> {
    return this.sessionRepo.findOne({
      where: { tenantId, openedBy: userId, status: 'open' },
      order: { openedAt: 'DESC' },
    });
  }

  async openSession(
    tenantId: string,
    userId: string,
    cashRegisterId: string,
    openingAmount: number,
    branchId: string,
  ): Promise<CashSession> {
    return this.dataSource.transaction(async manager => {
      const existing = await manager.findOne(CashSession, {
        where: { tenantId, openedBy: userId, status: 'open' },
        lock: { mode: 'pessimistic_write' },
      });
      if (existing) {
        throw new ConflictException('User already has an open cash session');
      }

      const session = manager.create(CashSession, {
        tenantId,
        cashRegisterId,
        branchId,
        openedBy: userId,
        openingAmount: String(openingAmount),
        status: 'open',
        openedAt: new Date(),
      });
      return manager.save(session);
    });
  }

  async closeSession(
    tenantId: string,
    sessionId: string,
    userId: string,
    closingAmount: number,
    notes?: string,
  ): Promise<CashSession> {
    return this.dataSource.transaction(async manager => {
      const session = await manager.findOne(CashSession, {
        where: { id: sessionId, tenantId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!session) throw new NotFoundException('Session not found');
      if (session.status !== 'open') throw new ConflictException('Session already closed');

      const movements = await manager.find(CashMovement, {
        where: { tenantId, cashSessionId: sessionId },
      });

      const expected =
        Number(session.openingAmount) +
        movements
          .filter(m => m.type === 'SALE' || m.type === 'INCOME')
          .reduce((s, m) => s + Number(m.amount), 0) -
        movements
          .filter(m => m.type === 'EXPENSE' || m.type === 'REFUND' || m.type === 'WITHDRAWAL')
          .reduce((s, m) => s + Number(m.amount), 0);

      session.expectedAmount = String(expected);
      session.closingAmount = String(closingAmount);
      session.difference = String(closingAmount - expected);
      session.status = 'closed';
      session.closedAt = new Date();
      session.closedBy = userId;
      session.closeNotes = notes ?? '';

      return manager.save(session);
    });
  }

  async appendMovement(
    manager: EntityManager,
    data: {
      tenantId: string;
      cashSessionId: string;
      type: 'SALE' | 'INCOME' | 'EXPENSE' | 'REFUND' | 'WITHDRAWAL';
      paymentMethod: string;
      amount: number;
      referenceId?: string;
      referenceType?: string;
      userId: string;
      notes?: string;
    },
  ): Promise<CashMovement> {
    const movement = manager.create(CashMovement, {
      ...data,
      amount: String(data.amount),
      notes: data.notes ?? '',
    });
    return manager.save(movement);
  }

  async listMovements(tenantId: string, sessionId: string): Promise<CashMovement[]> {
    return this.movementRepo.find({
      where: { tenantId, cashSessionId: sessionId },
      order: { createdAt: 'ASC' },
    });
  }
}