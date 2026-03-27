import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { CreatePayrollDto } from './dto/create-payroll.dto';

@Injectable()
export class PayrollService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(schemaName: string, query: {
    page?: number;
    perPage?: number;
    status?: string;
  }) {
    const { page = 1, perPage = 20, status } = query;
    const skip = (page - 1) * perPage;

    return this.prisma.withTenantSchema(schemaName, async (tx) => {
      const where: any = {};
      if (status) where.status = status;

      const [data, total] = await Promise.all([
        tx.payrollRun.findMany({
          where,
          skip,
          take: perPage,
          orderBy: { createdAt: 'desc' },
          include: {
            _count: { select: { items: true } },
          },
        }),
        tx.payrollRun.count({ where }),
      ]);

      return {
        data,
        meta: { page, perPage, total, totalPages: Math.ceil(total / perPage) },
      };
    });
  }

  async findById(schemaName: string, id: string) {
    return this.prisma.withTenantSchema(schemaName, async (tx) => {
      const run = await tx.payrollRun.findFirst({
        where: { id },
        include: { items: true },
      });
      if (!run) throw new NotFoundException('Payroll run not found');
      return run;
    });
  }

  async create(schemaName: string, dto: CreatePayrollDto, userId: string) {
    return this.prisma.withTenantSchema(schemaName, async (tx) => {
      // Generate run number
      const count = await tx.payrollRun.count();
      const runNo = `PR-${dto.period}-${String(count + 1).padStart(3, '0')}`;

      // Get all active employees
      const employees = await tx.employee.findMany({
        where: { status: 'active' },
        select: { id: true, empNo: true, firstName: true, lastName: true, salary: true },
      });

      if (employees.length === 0) {
        throw new BadRequestException('No active employees found');
      }

      // Build override map
      const overrideMap = new Map<string, { allowances?: number; deductions?: number }>();
      if (dto.items) {
        for (const item of dto.items) {
          overrideMap.set(item.employeeId, {
            allowances: item.allowances,
            deductions: item.deductions,
          });
        }
      }

      // Compute items
      const itemsData = employees.map((emp) => {
        const override = overrideMap.get(emp.id);
        const baseSalary = Number(emp.salary);
        const allowances = override?.allowances ?? 0;
        const deductions = override?.deductions ?? 0;
        const netPay = baseSalary + allowances - deductions;

        return {
          employeeId: emp.id,
          empNo: emp.empNo,
          empName: `${emp.lastName}${emp.firstName}`,
          baseSalary,
          allowances,
          deductions,
          netPay,
        };
      });

      const totalAmount = itemsData.reduce((sum, item) => sum + item.netPay, 0);

      return tx.payrollRun.create({
        data: {
          runNo,
          period: dto.period,
          totalAmount,
          createdBy: userId,
          items: {
            create: itemsData,
          },
        },
        include: { items: true },
      });
    });
  }

  async approve(schemaName: string, id: string, userId: string) {
    return this.prisma.withTenantSchema(schemaName, async (tx) => {
      const run = await tx.payrollRun.findFirst({ where: { id } });
      if (!run) throw new NotFoundException('Payroll run not found');
      if (run.status !== 'draft') {
        throw new BadRequestException(`Cannot approve payroll in status: ${run.status}`);
      }

      return tx.payrollRun.update({
        where: { id },
        data: { status: 'approved' },
      });
    });
  }

  async markPaid(schemaName: string, id: string, userId: string) {
    return this.prisma.withTenantSchema(schemaName, async (tx) => {
      const run = await tx.payrollRun.findFirst({ where: { id } });
      if (!run) throw new NotFoundException('Payroll run not found');
      if (run.status !== 'approved') {
        throw new BadRequestException(`Cannot mark paid payroll in status: ${run.status}`);
      }

      return tx.payrollRun.update({
        where: { id },
        data: { status: 'paid', paidAt: new Date() },
      });
    });
  }
}
