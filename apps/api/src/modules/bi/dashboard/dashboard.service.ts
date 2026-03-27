import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../common/prisma/prisma.service';

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async getSalesSummary(schemaName: string) {
    return this.prisma.withTenantSchema(schemaName, async (tx) => {
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

      const [ordersThisMonth, revenueRows, totalCustomers, pendingOrders] = await Promise.all([
        tx.salesOrder.count({ where: { deletedAt: null, createdAt: { gte: startOfMonth } } }),
        tx.$queryRawUnsafe(`SELECT COALESCE(SUM(total), 0)::text AS revenue FROM "${schemaName}".sales_orders WHERE deleted_at IS NULL AND created_at >= $1`, startOfMonth) as Promise<any[]>,
        tx.customer.count({ where: { deletedAt: null } }),
        tx.salesOrder.count({ where: { deletedAt: null, status: { in: ['pending_approval', 'approved'] } } }),
      ]);

      return {
        totalOrdersThisMonth: ordersThisMonth,
        revenueThisMonth: parseFloat((revenueRows as any[])[0]?.revenue ?? '0'),
        totalCustomers,
        pendingOrders,
      };
    });
  }

  async getProcurementSummary(schemaName: string) {
    return this.prisma.withTenantSchema(schemaName, async (tx) => {
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

      const [posThisMonth, spendRows, totalSuppliers, pendingPRs] = await Promise.all([
        tx.purchaseOrder.count({ where: { deletedAt: null, createdAt: { gte: startOfMonth } } }),
        tx.$queryRawUnsafe(`SELECT COALESCE(SUM(total), 0)::text AS spend FROM "${schemaName}".purchase_orders WHERE deleted_at IS NULL AND created_at >= $1`, startOfMonth) as Promise<any[]>,
        tx.supplier.count({ where: { deletedAt: null } }),
        tx.purchaseRequisition.count({ where: { deletedAt: null, status: { in: ['draft', 'pending_approval'] } } }),
      ]);

      return {
        totalPOsThisMonth: posThisMonth,
        spendThisMonth: parseFloat((spendRows as any[])[0]?.spend ?? '0'),
        totalSuppliers,
        pendingPRs,
      };
    });
  }

  async getInventorySummary(schemaName: string) {
    return this.prisma.withTenantSchema(schemaName, async (tx) => {
      const [totalItems, totalWarehouses, lowStockRows, stockValueRows] = await Promise.all([
        tx.item.count({ where: { isActive: true } }),
        tx.warehouse.count({ where: { isActive: true } }),
        tx.$queryRawUnsafe(`SELECT COUNT(DISTINCT sl.item_id)::text AS count FROM "${schemaName}".stock_levels sl JOIN "${schemaName}".items i ON i.id = sl.item_id WHERE sl.quantity < i.safety_stock AND i.safety_stock > 0`) as Promise<any[]>,
        tx.$queryRawUnsafe(`SELECT COALESCE(SUM(sl.quantity * i.unit_cost), 0)::text AS value FROM "${schemaName}".stock_levels sl JOIN "${schemaName}".items i ON i.id = sl.item_id`) as Promise<any[]>,
      ]);

      return {
        totalItems,
        totalWarehouses,
        lowStockCount: parseInt((lowStockRows as any[])[0]?.count ?? '0', 10),
        totalStockValue: parseFloat((stockValueRows as any[])[0]?.value ?? '0'),
      };
    });
  }

  async getFinanceSummary(schemaName: string) {
    return this.prisma.withTenantSchema(schemaName, async (tx) => {
      const [arRows, apRows, draftJEs, totalAccounts] = await Promise.all([
        tx.$queryRawUnsafe(`SELECT COALESCE(SUM(total_amount - paid_amount), 0)::text AS total FROM "${schemaName}".invoices WHERE type = 'ar' AND status NOT IN ('paid', 'cancelled')`) as Promise<any[]>,
        tx.$queryRawUnsafe(`SELECT COALESCE(SUM(total_amount - paid_amount), 0)::text AS total FROM "${schemaName}".invoices WHERE type = 'ap' AND status NOT IN ('paid', 'cancelled')`) as Promise<any[]>,
        tx.journalEntry.count({ where: { status: 'draft' } }),
        tx.account.count({ where: { isActive: true } }),
      ]);

      return {
        totalAR: parseFloat((arRows as any[])[0]?.total ?? '0'),
        totalAP: parseFloat((apRows as any[])[0]?.total ?? '0'),
        draftJournalEntries: draftJEs,
        totalAccounts,
      };
    });
  }

  async getHrSummary(schemaName: string) {
    return this.prisma.withTenantSchema(schemaName, async (tx) => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      const [totalEmployees, activeEmployees, pendingLeaves, onLeaveToday] = await Promise.all([
        tx.employee.count(),
        tx.employee.count({ where: { status: 'active' } }),
        tx.leaveRequest.count({ where: { status: 'pending' } }),
        tx.leaveRequest.count({ where: { status: 'approved', startDate: { lte: today }, endDate: { gte: today } } }),
      ]);

      return { totalEmployees, activeEmployees, pendingLeaves, onLeaveToday };
    });
  }

  async getMonthlySalesTrend(schemaName: string) {
    return this.prisma.withTenantSchema(schemaName, async (tx) => {
      const rows = await tx.$queryRawUnsafe(`
        SELECT to_char(created_at, 'YYYY-MM') AS month, COALESCE(SUM(total), 0)::text AS revenue
        FROM "${schemaName}".sales_orders
        WHERE status NOT IN ('cancelled') AND deleted_at IS NULL AND created_at >= NOW() - INTERVAL '6 months'
        GROUP BY month ORDER BY month
      `) as any[];

      return rows.map((r: any) => ({ month: r.month, revenue: parseFloat(r.revenue) }));
    });
  }

  async getTopCustomers(schemaName: string, limit = 5) {
    return this.prisma.withTenantSchema(schemaName, async (tx) => {
      const rows = await tx.$queryRawUnsafe(`
        SELECT c.id, c.name, COUNT(so.id)::text AS order_count, COALESCE(SUM(so.total), 0)::text AS total_amount
        FROM "${schemaName}".customers c
        LEFT JOIN "${schemaName}".sales_orders so ON so.customer_id = c.id
          AND so.status NOT IN ('cancelled') AND so.deleted_at IS NULL
          AND EXTRACT(YEAR FROM so.created_at) = EXTRACT(YEAR FROM NOW())
        WHERE c.deleted_at IS NULL
        GROUP BY c.id, c.name ORDER BY total_amount DESC LIMIT $1
      `, limit) as any[];

      return rows.map((r: any) => ({ id: r.id, name: r.name, orderCount: parseInt(r.order_count, 10), totalAmount: parseFloat(r.total_amount) }));
    });
  }

  async getOrdersByStatus(schemaName: string) {
    return this.prisma.withTenantSchema(schemaName, async (tx) => {
      const rows = await tx.$queryRawUnsafe(`
        SELECT status, COUNT(*)::text AS count FROM "${schemaName}".sales_orders WHERE deleted_at IS NULL GROUP BY status ORDER BY count DESC
      `) as any[];

      return rows.map((r: any) => ({ status: r.status, count: parseInt(r.count, 10) }));
    });
  }
}
