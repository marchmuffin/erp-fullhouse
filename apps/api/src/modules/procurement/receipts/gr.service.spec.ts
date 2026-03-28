import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, BadRequestException } from '@nestjs/common';

import { GoodsReceiptService } from './gr.service';
import { PrismaService } from '../../../common/prisma/prisma.service';

const mockTx = {
  goodsReceipt: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
  },
  purchaseOrder: {
    findFirst: jest.fn(),
    update: jest.fn(),
  },
  pOLine: {
    findMany: jest.fn(),
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
const PO_ID = 'po-1';

function makePO(status: string = 'approved', overrides: Partial<Record<string, any>> = {}) {
  return {
    id: PO_ID,
    poNo: 'PO-202603-0001',
    supplierId: 'sup-1',
    status,
    deletedAt: null,
    ...overrides,
  };
}

function makeGR(overrides: Partial<Record<string, any>> = {}) {
  return {
    id: 'gr-1',
    grNo: 'GR-202603-0001',
    poId: PO_ID,
    status: 'confirmed',
    receiveDate: new Date('2026-03-15'),
    notes: null,
    createdBy: USER_ID,
    createdAt: new Date('2026-03-15'),
    lines: [],
    ...overrides,
  };
}

function makePOLine(quantity: number, receivedQty: number, overrides: Partial<Record<string, any>> = {}) {
  return {
    id: 'pol-1',
    poId: PO_ID,
    lineNo: 1,
    itemCode: 'ITM-001',
    itemName: 'Widget A',
    unit: 'PCS',
    quantity,
    receivedQty,
    ...overrides,
  };
}

const grData = {
  grNo: 'GR-202603-0001',
  receiveDate: '2026-03-15',
  lines: [
    {
      poLineId: 'pol-1',
      lineNo: 1,
      itemCode: 'ITM-001',
      itemName: 'Widget A',
      unit: 'PCS',
      orderedQty: 10,
      receivedQty: 5,
    },
  ],
};

describe('GoodsReceiptService', () => {
  let service: GoodsReceiptService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GoodsReceiptService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<GoodsReceiptService>(GoodsReceiptService);
    jest.clearAllMocks();
  });

  describe('findByPO()', () => {
    it('should return all goods receipts for a given PO', async () => {
      const receipts = [makeGR(), makeGR({ id: 'gr-2', grNo: 'GR-202603-0002' })];
      mockTx.goodsReceipt.findMany.mockResolvedValue(receipts);

      const result = await service.findByPO(SCHEMA, PO_ID);

      expect(result).toHaveLength(2);
      expect(mockTx.goodsReceipt.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { poId: PO_ID } }),
      );
    });

    it('should return an empty array when no receipts exist for the PO', async () => {
      mockTx.goodsReceipt.findMany.mockResolvedValue([]);

      const result = await service.findByPO(SCHEMA, PO_ID);

      expect(result).toHaveLength(0);
    });
  });

  describe('create()', () => {
    it('should create a GR and increment PO line received quantities', async () => {
      mockTx.purchaseOrder.findFirst.mockResolvedValue(makePO('approved'));
      const createdGR = makeGR({ lines: [{ id: 'grl-1', grNo: 'GR-202603-0001', receivedQty: 5 }] });
      mockTx.goodsReceipt.create.mockResolvedValue(createdGR);
      mockTx.pOLine.update.mockResolvedValue({});
      mockTx.pOLine.findMany.mockResolvedValue([makePOLine(10, 5)]);
      mockTx.purchaseOrder.update.mockResolvedValue({});

      const result = await service.create(SCHEMA, PO_ID, grData, USER_ID);

      expect(mockTx.goodsReceipt.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            grNo: 'GR-202603-0001',
            poId: PO_ID,
            status: 'confirmed',
            createdBy: USER_ID,
          }),
        }),
      );
      expect(mockTx.pOLine.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'pol-1' },
          data: { receivedQty: { increment: 5 } },
        }),
      );
      expect(result.id).toBe('gr-1');
    });

    it('should set PO status to partial_received when some lines are not fully received', async () => {
      mockTx.purchaseOrder.findFirst.mockResolvedValue(makePO('approved'));
      mockTx.goodsReceipt.create.mockResolvedValue(makeGR());
      mockTx.pOLine.update.mockResolvedValue({});
      // quantity=10, receivedQty=5 — partially received
      mockTx.pOLine.findMany.mockResolvedValue([makePOLine(10, 5)]);
      mockTx.purchaseOrder.update.mockResolvedValue({});

      await service.create(SCHEMA, PO_ID, grData, USER_ID);

      expect(mockTx.purchaseOrder.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: PO_ID },
          data: { status: 'partial_received' },
        }),
      );
    });

    it('should set PO status to received when all lines are fully received', async () => {
      mockTx.purchaseOrder.findFirst.mockResolvedValue(makePO('approved'));
      mockTx.goodsReceipt.create.mockResolvedValue(makeGR());
      mockTx.pOLine.update.mockResolvedValue({});
      // quantity=10, receivedQty=10 — fully received
      mockTx.pOLine.findMany.mockResolvedValue([makePOLine(10, 10)]);
      mockTx.purchaseOrder.update.mockResolvedValue({});

      await service.create(SCHEMA, PO_ID, grData, USER_ID);

      expect(mockTx.purchaseOrder.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: PO_ID },
          data: { status: 'received' },
        }),
      );
    });

    it('should throw NotFoundException when PO does not exist', async () => {
      mockTx.purchaseOrder.findFirst.mockResolvedValue(null);

      await expect(service.create(SCHEMA, PO_ID, grData, USER_ID)).rejects.toThrow(
        NotFoundException,
      );
      expect(mockTx.goodsReceipt.create).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException when PO is not in approved or partial_received status', async () => {
      mockTx.purchaseOrder.findFirst.mockResolvedValue(makePO('draft'));

      await expect(service.create(SCHEMA, PO_ID, grData, USER_ID)).rejects.toThrow(
        BadRequestException,
      );
      expect(mockTx.goodsReceipt.create).not.toHaveBeenCalled();
    });

    it('should allow creating a GR for a partial_received PO', async () => {
      mockTx.purchaseOrder.findFirst.mockResolvedValue(makePO('partial_received'));
      mockTx.goodsReceipt.create.mockResolvedValue(makeGR());
      mockTx.pOLine.update.mockResolvedValue({});
      mockTx.pOLine.findMany.mockResolvedValue([makePOLine(10, 10)]);
      mockTx.purchaseOrder.update.mockResolvedValue({});

      const result = await service.create(SCHEMA, PO_ID, grData, USER_ID);

      expect(result.id).toBe('gr-1');
    });
  });
});
