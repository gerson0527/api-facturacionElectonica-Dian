import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, LessThan, MoreThanOrEqual } from 'typeorm';
import { Invoice } from '@/database/entities/invoice.entity';
import { Customer } from '@/database/entities/customer.entity';

@Injectable()
export class DashboardService {
  constructor(
    @InjectRepository(Invoice)
    private readonly invoiceRepo: Repository<Invoice>,
    @InjectRepository(Customer)
    private readonly customerRepo: Repository<Customer>,
  ) {}

  async getDashboardStats(tenantId: string) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    
    // 7 days ago
    const sevenDaysAgo = new Date(today);
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);

    // 1. Ventas de hoy
    const todaySalesResult = await this.invoiceRepo
      .createQueryBuilder('invoice')
      .where('invoice.tenant_id = :tenantId', { tenantId })
      .andWhere('invoice.issue_date >= :today', { today })
      .andWhere("invoice.status != 'Rechazada'")
      .select('SUM(invoice.total_amount)', 'total')
      .getRawOne();
    
    const todaysSales = Number(todaySalesResult?.total || 0);

    // 2. Facturas del mes
    const monthlyInvoices = await this.invoiceRepo.count({
      where: {
        tenant: { id: tenantId },
        issueDate: MoreThanOrEqual(firstDayOfMonth)
      }
    });

    // 3. Clientes activos
    const totalCustomers = await this.customerRepo.count({
      where: { tenant: { id: tenantId } }
    });

    // 4. Pendientes por cobrar (facturas que no son draft y no están pagadas, simplificaremos asumiendo pendientes = draft o sent sin recibo)
    // Para simplificar, sumamos status = 'Pendiente' o 'draft' o 'Enviada'
    const pendingResult = await this.invoiceRepo
      .createQueryBuilder('invoice')
      .where('invoice.tenant_id = :tenantId', { tenantId })
      .andWhere('invoice.status IN (:...statuses)', { statuses: ['draft', 'Pendiente', 'Enviada'] })
      .select('SUM(invoice.total_amount)', 'total')
      .getRawOne();
    
    const pendingAmount = Number(pendingResult?.total || 0);

    // 5. Gráfico de ingresos últimos 7 días
    const last7DaysData = await this.invoiceRepo
      .createQueryBuilder('invoice')
      .where('invoice.tenant_id = :tenantId', { tenantId })
      .andWhere('invoice.issue_date >= :sevenDaysAgo', { sevenDaysAgo })
      .andWhere("invoice.status != 'Rechazada'")
      .select('invoice.issue_date', 'date')
      .addSelect('SUM(invoice.total_amount)', 'amount')
      .groupBy('invoice.issue_date')
      .orderBy('invoice.issue_date', 'ASC')
      .getRawMany();

    // Fill missing days with 0
    const revenueData = [];
    for (let i = 0; i <= 6; i++) {
      const d = new Date(sevenDaysAgo);
      d.setDate(d.getDate() + i);
      const dateStr = d.toISOString().split('T')[0];
      
      const found = last7DaysData.find(x => {
        const foundDate = new Date(x.date);
        return foundDate.toISOString().split('T')[0] === dateStr;
      });

      revenueData.push({
        name: d.toLocaleDateString('es-CO', { day: '2-digit', month: 'short' }),
        amount: found ? Number(found.amount) : 0
      });
    }

    // 6. Estado DIAN (Docs aceptados, rechazados)
    const statusCounts = await this.invoiceRepo
      .createQueryBuilder('invoice')
      .where('invoice.tenant_id = :tenantId', { tenantId })
      .select('invoice.status', 'status')
      .addSelect('COUNT(*)', 'count')
      .groupBy('invoice.status')
      .getRawMany();
    
    let rejectedDocs = 0;
    statusCounts.forEach(s => {
      if (s.status === 'Rechazada') rejectedDocs += Number(s.count);
    });

    // 7. Últimas facturas (Top 5)
    const recentInvoices = await this.invoiceRepo.find({
      where: { tenant: { id: tenantId } },
      order: { createdAt: 'DESC' },
      take: 5
    });

    return {
      kpi: {
        todaysSales,
        monthlyInvoices,
        totalCustomers,
        pendingAmount
      },
      dian: {
        rejectedDocs,
        connected: true,
        environment: 'Producción',
        lastSync: new Date().toISOString()
      },
      charts: {
        revenueData
      },
      recentInvoices: recentInvoices.map(inv => ({
        id: `${inv.prefix}-${inv.number}`,
        client: inv.customerName || 'Consumidor Final',
        date: new Date(inv.issueDate).toLocaleDateString('es-CO'),
        total: Number(inv.totalAmount),
        status: inv.status
      }))
    };
  }
}
