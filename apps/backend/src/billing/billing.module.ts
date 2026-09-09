import { Module, Global } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaModule } from '../prisma/prisma.module';
import { BillingController } from './controllers/billing.controller';
import { AdminBillingController } from './controllers/admin-billing.controller';
import { BillingService } from './services/billing.service';
import { EntitlementService } from './services/entitlement.service';
import { MockPaymentProvider } from './providers/mock-payment.provider';
import { StripePaymentProvider } from './providers/stripe-payment.provider';

@Global()
@Module({
  imports: [PrismaModule],
  controllers: [BillingController, AdminBillingController],
  providers: [
    MockPaymentProvider,
    StripePaymentProvider,
    {
      provide: 'PAYMENT_PROVIDER',
      useFactory: (
        config: ConfigService,
        mockProvider: MockPaymentProvider,
        stripeProvider: StripePaymentProvider,
      ) => {
        const mode = (config.get<string>('PAYMENT_PROVIDER') || 'mock').toLowerCase().trim();
        if (mode === 'stripe') {
          return stripeProvider;
        }
        return mockProvider;
      },
      inject: [ConfigService, MockPaymentProvider, StripePaymentProvider],
    },
    EntitlementService,
    BillingService,
  ],
  exports: [EntitlementService, BillingService, 'PAYMENT_PROVIDER'],
})
export class BillingModule {}
