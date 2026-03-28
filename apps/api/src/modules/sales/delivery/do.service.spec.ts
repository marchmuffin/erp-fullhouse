import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, BadRequestException } from '@nestjs/common';

import { DeliveryOrderService } from './do.service';
import { PrismaService } from '../../../common/prisma/prisma.service';

const mockTx = {
  deliveryOrder: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  salesOrder: {
    findFirst: jest.fn(),
    update: jest.fn(),
  },
};

const mockPrisma = {
  withTenantSchema: jest.fn().mockImplementation((_schema: string, fn: (tx: any) => any) =>
    fn(mockTx),
  ),
};

const SCHEMA = 'tenant_test';
const USER_ID = 'user-1';
const SO_ID = 'so-1';

function makeSalesOrder(status: string = 'approved', overrides: Partial<Record<string, any>> = {}) {
  return {
    id: SO_ID,
    orderNo: 'SO-202603-0001',
    customerId: 'cust-1',
    status,
    deletedAt: null,
    ...overrides,
  };
}

function makeDeliveryOrder(overrides: Partial<Record<string, any>> = {}) {
  return {
    id: 'do-1',
    doNo: 'DO-202603-0001',
    soId: SO_ID,
    status: 'draft',
    shipDate: null,
    carrier: null,
    trackingNo: null,
    notes: null,
    createdBy: USER_ID,
    createdAt: new Date('2026-03-15'),
    ...overrides,
  };
}

const createData = {
  doNo: 'DO-202603-0001',
  carrier: 'DHL',
  trackingNo: 'DHL12345',
};

describe('DeliveryOrderService', () => {
  let service: DeliveryOrderService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DeliveryOrderService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<DeliveryOrderService>(DeliveryOrderService);
    jest.clearAllMocks();
  });

  describe('findBySalesOrder()', () => {
    it('should return all delivery orders for a given sales order', async () => {
      const deliveries = [
        makeDeliveryOrder(),
        makeDeliveryOrder({ id: 'do-2', doNo: 'DO-202603-0002' }),
      ];
      mockTx.deliveryOrder.findMany.mockResolvedValue(deliveries);

      const result = await service.findBySalesOrder(SCHEMA, SO_ID);

      expect(result).toHaveLength(2);
      expect(mockTx.deliveryOrder.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { soId: SO_ID } }),
      );
    });

    it('should return an empty array when no delivery orders exist for the SO', async () => {
      mockTx.deliveryOrder.findMany.mockResolvedValue([]);

      const result = await service.findBySalesOrder(SCHEMA, SO_ID);

      expect(result).toHaveLength(0);
    });
  });

  describe('create()', () => {
    it('should create a delivery order in draft status', async () => {
      mockTx.salesOrder.findFirst.mockResolvedValue(makeSalesOrder('approved'));
      mockTx.deliveryOrder.findUnique.mockResolvedValue(null);
      const created = makeDeliveryOrder({ carrier: 'DHL', trackingNo: 'DHL12345' });
      mockTx.deliveryOrder.create.mockResolvedValue(created);

      const result = await service.create(SCHEMA, SO_ID, createData, USER_ID);

      expect(mockTx.deliveryOrder.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            doNo: 'DO-202603-0001',
            soId: SO_ID,
            status: 'draft',
            createdBy: USER_ID,
          }),
        }),
      );
      expect(result.status).toBe('draft');
    });

    it('should throw NotFoundException when sales order does not exist', async () => {
      mockTx.salesOrder.findFirst.mockResolvedValue(null);

      await expect(service.create(SCHEMA, SO_ID, createData, USER_ID)).rejects.toThrow(
        NotFoundException,
      );
      expect(mockTx.deliveryOrder.create).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException when SO is not in an approved or processing status', async () => {
      mockTx.salesOrder.findFirst.mockResolvedValue(makeSalesOrder('draft'));

      await expect(service.create(SCHEMA, SO_ID, createData, USER_ID)).rejects.toThrow(
        BadRequestException,
      );
      expect(mockTx.deliveryOrder.create).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException when delivery order number already exists', async () => {
      mockTx.salesOrder.findFirst.mockResolvedValue(makeSalesOrder('approved'));
      mockTx.deliveryOrder.findUnique.mockResolvedValue(makeDeliveryOrder());

      await expect(service.create(SCHEMA, SO_ID, createData, USER_ID)).rejects.toThrow(
        BadRequestException,
      );
      expect(mockTx.deliveryOrder.create).not.toHaveBeenCalled();
    });

    it('should allow creating a DO for a partial_shipped SO', async () => {
      mockTx.salesOrder.findFirst.mockResolvedValue(makeSalesOrder('partial_shipped'));
      mockTx.deliveryOrder.findUnique.mockResolvedValue(null);
      mockTx.deliveryOrder.create.mockResolvedValue(makeDeliveryOrder());

      const result = await service.create(SCHEMA, SO_ID, createData, USER_ID);

      expect(result.id).toBe('do-1');
    });
  });

  describe('ship()', () => {
    it('should transition a draft delivery order to shipped and update the SO status', async () => {
      const draftDO = makeDeliveryOrder({ status: 'draft', shipDate: null });
      const shippedDO = makeDeliveryOrder({ status: 'shipped', shipDate: new Date() });
      mockTx.deliveryOrder.findUnique.mockResolvedValue(draftDO);
      mockTx.deliveryOrder.update.mockResolvedValue(shippedDO);
      mockTx.salesOrder.update.mockResolvedValue({});

      const result = await service.ship(SCHEMA, 'do-1');

      expect(mockTx.deliveryOrder.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'do-1' },
          data: expect.objectContaining({ status: 'shipped' }),
        }),
      );
      expect(mockTx.salesOrder.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: SO_ID },
          data: { status: 'shipped' },
        }),
      );
      expect(result.status).toBe('shipped');
    });

    it('should throw BadRequestException when delivery order is already shipped', async () => {
      mockTx.deliveryOrder.findUnique.mockResolvedValue(makeDeliveryOrder({ status: 'shipped' }));

      await expect(service.ship(SCHEMA, 'do-1')).rejects.toThrow(BadRequestException);
      expect(mockTx.deliveryOrder.update).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException when delivery order does not exist', async () => {
      mockTx.deliveryOrder.findUnique.mockResolvedValue(null);

      await expect(service.ship(SCHEMA, 'nonexistent')).rejects.toThrow(NotFoundException);
    });

    it('should use the existing shipDate when already set on the delivery order', async () => {
      const existingShipDate = new Date('2026-03-20');
      const draftDO = makeDeliveryOrder({ status: 'draft', shipDate: existingShipDate });
      mockTx.deliveryOrder.findUnique.mockResolvedValue(draftDO);
      mockTx.deliveryOrder.update.mockResolvedValue(makeDeliveryOrder({ status: 'shipped', shipDate: existingShipDate }));
      mockTx.salesOrder.update.mockResolvedValue({});

      await service.ship(SCHEMA, 'do-1');

      expect(mockTx.deliveryOrder.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ shipDate: existingShipDate }),
        }),
      );
    });
  });
});
