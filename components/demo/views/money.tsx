'use client';
// Finance: the product's own Finance view — what is owed, what came in, the time not yet billed.
import * as React from 'react';
import { MoneyView } from '@/components/money/money-view';
import { CLIENTS, financeData } from './money-data';

export default function MoneyDemo() {
  const d = React.useMemo(() => financeData(), []);
  return <MoneyView invoices={d.invoices} clients={CLIENTS} unbilled={d.unbilled} payments={d.payments} monthStart={d.monthStart} rate={150} />;
}
