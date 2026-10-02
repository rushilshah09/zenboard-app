// /demo — Zenboard itself, on a sample studio's data, for the product demo on the home page (it is
// framed there in an app window: components/site/app-window.tsx). Public, and never indexed: it is a
// part of the home page, not a page of its own. Everything it does stays in the visitor's browser
// (components/demo/sandbox.ts).
import type { Metadata } from 'next';
import { DemoEntry } from '@/components/demo/demo-entry';

export const metadata: Metadata = {
  title: 'Zenboard, with sample data',
  robots: { index: false, follow: false },
};

export default function DemoPage() {
  return <DemoEntry />;
}
