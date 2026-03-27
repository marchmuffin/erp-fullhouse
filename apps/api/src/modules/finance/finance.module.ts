import { Module } from '@nestjs/common';
import { AccountController } from './accounts/account.controller';
import { AccountService } from './accounts/account.service';
import { JournalController } from './journal/journal.controller';
import { JournalService } from './journal/journal.service';
import { InvoiceController } from './invoices/invoice.controller';
import { InvoiceService } from './invoices/invoice.service';

@Module({
  controllers: [
    AccountController,
    JournalController,
    InvoiceController,
  ],
  providers: [
    AccountService,
    JournalService,
    InvoiceService,
  ],
  exports: [AccountService, JournalService, InvoiceService],
})
export class FinanceModule {}
