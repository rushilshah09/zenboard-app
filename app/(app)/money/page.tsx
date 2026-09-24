// Money hub overview — KPIs, filterable invoices, recent payments, new-invoice flow.
import { loadMoneyData } from '@/lib/money-data';
import { MoneyView } from '@/components/money/money-view';
import { PageStamp } from '@/components/shell/page-stamp';

export const dynamic = 'force-dynamic';

export default async function MoneyPage() {
  const { invoices, clients, unbilled, payments, monthStart, rate } = await loadMoneyData();
  return (
    <>
      <PageStamp />
      <MoneyView invoices={invoices} clients={clients} unbilled={unbilled} payments={payments} monthStart={monthStart} rate={rate} />
    </>
  );
}
