import { PricingPlans } from '@/components/billing/pricing-plans';
import { BILLING_CONFIG, PLAN_FEATURES, PLAN_PRICING } from '@/lib/billing/plans';

export const dynamic = 'force-dynamic';

export default function PricingPage() {
  return <PricingPlans plans={PLAN_PRICING} features={PLAN_FEATURES} paymentsConfigured={BILLING_CONFIG.paymentConfigured} />;
}
