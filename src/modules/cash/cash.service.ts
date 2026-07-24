import { Injectable, BadRequestException, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { CashRegister } from '../../database/entities/cash-register.entity';
import { CashSession } from '../../database/entities/cash-session.entity';
import { CashMovement } from '../../database/entities/cash-movement.entity';
import { User } from '../../database/entities/user.entity';

import { Branch } from '../../database/entities/branch.entity';

@Injectable()
export class CashService {
  constructor(
    @InjectRepository(CashRegister) private registerRepo: Repository<CashRegister>,
    @InjectRepository(CashSession) private sessionRepo: Repository<CashSession>,
    @InjectRepository(CashMovement) private movementRepo: Repository<CashMovement>,
    @InjectRepository(User) private userRepo: Repository<User>,
    private dataSource: DataSource,
  ) {}

  async listRegisters(tenantId: string): Promise<CashRegister[]> {
    const list = await this.registerRepo.find({ where: { tenantId, active: true }, order: { name: 'ASC' } });
    if (list.length === 0) {
      const defaultReg = await this.createRegister(tenantId, { name: 'Caja Principal', location: 'Principal' });
      return [defaultReg];
    }
    return list;
  }

  async createRegister(tenantId: string, data: Partial<CashRegister>): Promise<CashRegister> {
    let branchId = data.branchId;
    if (!branchId) {
      const branchRepo = this.dataSource.getRepository(Branch);
      const existingBranch = await branchRepo.findOne({ where: { tenantId, isActive: true } });
      if (existingBranch) {
        branchId = existingBranch.id;
      } else {
        const newBranch = await branchRepo.save(branchRepo.create({ tenantId, name: 'Sucursal Principal', isMain: true }));
        branchId = newBranch.id;
      }
    }
    const reg = this.registerRepo.create({ ...data, branchId, tenantId, active: data.active ?? true });
    return this.registerRepo.save(reg);
  }

  async updateRegister(tenantId: string, id: string, data: Partial<CashRegister>): Promise<CashRegister> {
    await this.registerRepo.update({ id, tenantId }, data);
    return this.registerRepo.findOneOrFail({ where: { id, tenantId } });
  }

  async deleteRegister(tenantId: string, id: string): Promise<{ deleted: boolean; message: string }> {
    const sessionCount = await this.sessionRepo.count({ where: { tenantId, cashRegisterId: id } });
    if (sessionCount > 0) {
      await this.registerRepo.update({ id, tenantId }, { active: false });
      return { deleted: false, message: 'La caja tiene transacciones registradas; fue marcada como inactiva.' };
    }
    await this.registerRepo.delete({ id, tenantId });
    return { deleted: true, message: 'Caja eliminada correctamente de la base de datos.' };
  }

  async listSessions(tenantId: string, status?: string): Promise<any[]> {
    const where: any = { tenantId };
    if (status) where.status = status;
    const sessions = await this.sessionRepo.find({ where, order: { openedAt: 'DESC' } });
    
    // Manual mapping for user names to avoid TypeORM relation conflicts
    const userIds = [...new Set(sessions.flatMap(s => [s.openedBy, s.closedBy]).filter(Boolean))];
    let users: User[] = [];
    if (userIds.length > 0) {
      users = await this.userRepo.createQueryBuilder('user')
        .where('user.id IN (:...userIds)', { userIds })
        .getMany();
    }
    
    return sessions.map((s: any) => {
      const openedUser = users.find(u => u.id === s.openedBy);
      const closedUser = users.find(u => u.id === s.closedBy);
      return {
        ...s,
        openedByUser: openedUser ? { id: openedUser.id, fullName: openedUser.fullName } : null,
        closedByUser: closedUser ? { id: closedUser.id, fullName: closedUser.fullName } : null,
      };
    });
  }

  async getOpenSession(userId: string, tenantId: string): Promise<any | null> {
    const s = await this.sessionRepo.findOne({
      where: { tenantId, openedBy: userId, status: 'open' },
      order: { openedAt: 'DESC' },
    });
    if (!s) return null;
    const user = await this.userRepo.findOne({ where: { id: s.openedBy } });
    return {
      ...s,
      openedByUser: user ? { id: user.id, fullName: user.fullName } : null,
    };
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
    const validUserId = (data.userId && data.userId.length === 36 && data.userId.includes('-')) 
      ? data.userId 
      : '00000000-0000-0000-0000-000000000000';

    const movement = manager.create(CashMovement, {
      ...data,
      userId: validUserId,
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