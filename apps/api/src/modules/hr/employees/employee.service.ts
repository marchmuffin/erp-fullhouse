import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { CreateEmployeeDto } from './dto/create-employee.dto';
import { UpdateEmployeeDto } from './dto/update-employee.dto';

@Injectable()
export class EmployeeService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(schemaName: string, query: {
    page?: number;
    perPage?: number;
    search?: string;
    status?: string;
    department?: string;
  }) {
    const { page = 1, perPage = 20, search, status, department } = query;
    const skip = (page - 1) * perPage;

    return this.prisma.withTenantSchema(schemaName, async (tx) => {
      const where: any = {};
      if (search) {
        where.OR = [
          { empNo: { contains: search, mode: 'insensitive' } },
          { firstName: { contains: search, mode: 'insensitive' } },
          { lastName: { contains: search, mode: 'insensitive' } },
          { email: { contains: search, mode: 'insensitive' } },
        ];
      }
      if (status) where.status = status;
      if (department) where.department = { contains: department, mode: 'insensitive' };

      const [data, total] = await Promise.all([
        tx.employee.findMany({
          where,
          skip,
          take: perPage,
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            empNo: true,
            firstName: true,
            lastName: true,
            email: true,
            phone: true,
            department: true,
            position: true,
            hireDate: true,
            terminateDate: true,
            salary: true,
            salaryType: true,
            status: true,
            createdAt: true,
          },
        }),
        tx.employee.count({ where }),
      ]);

      return {
        data,
        meta: { page, perPage, total, totalPages: Math.ceil(total / perPage) },
      };
    });
  }

  async findById(schemaName: string, id: string) {
    return this.prisma.withTenantSchema(schemaName, async (tx) => {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const employee = await tx.employee.findFirst({
        where: { id },
        include: {
          leaveRequests: {
            orderBy: { createdAt: 'desc' },
            take: 10,
          },
          attendances: {
            where: { date: { gte: thirtyDaysAgo } },
            orderBy: { date: 'desc' },
          },
        },
      });
      if (!employee) throw new NotFoundException('Employee not found');
      return employee;
    });
  }

  async create(schemaName: string, dto: CreateEmployeeDto, userId: string) {
    return this.prisma.withTenantSchema(schemaName, async (tx) => {
      const existing = await tx.employee.findUnique({ where: { empNo: dto.empNo } });
      if (existing) throw new ConflictException(`Employee number ${dto.empNo} already exists`);

      return tx.employee.create({
        data: {
          empNo: dto.empNo,
          firstName: dto.firstName,
          lastName: dto.lastName,
          email: dto.email,
          phone: dto.phone,
          department: dto.department,
          position: dto.position,
          hireDate: new Date(dto.hireDate),
          salary: dto.salary ?? 0,
          salaryType: dto.salaryType ?? 'monthly',
          notes: dto.notes,
        },
      });
    });
  }

  async update(schemaName: string, id: string, dto: UpdateEmployeeDto) {
    return this.prisma.withTenantSchema(schemaName, async (tx) => {
      const employee = await tx.employee.findFirst({ where: { id } });
      if (!employee) throw new NotFoundException('Employee not found');

      return tx.employee.update({
        where: { id },
        data: {
          firstName: dto.firstName,
          lastName: dto.lastName,
          email: dto.email,
          phone: dto.phone,
          department: dto.department,
          position: dto.position,
          hireDate: dto.hireDate ? new Date(dto.hireDate) : undefined,
          terminateDate: dto.terminateDate ? new Date(dto.terminateDate) : undefined,
          salary: dto.salary,
          salaryType: dto.salaryType,
          status: dto.status,
          notes: dto.notes,
        },
      });
    });
  }

  async remove(schemaName: string, id: string) {
    return this.prisma.withTenantSchema(schemaName, async (tx) => {
      const employee = await tx.employee.findFirst({ where: { id } });
      if (!employee) throw new NotFoundException('Employee not found');

      return tx.employee.update({
        where: { id },
        data: { status: 'terminated', terminateDate: new Date() },
      });
    });
  }
}
