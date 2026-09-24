'use client';
// Stamps <html data-input> with the hand that drove the last interaction (see
// lib/input-modality.ts). Mounted once in the root layout beside AppearanceBoot, so
// the app, the client portal, public forms and dev previews all read the same fact.
// Renders nothing.
import { useEffect } from 'react';
import { installInputModality } from '@/lib/input-modality';

export function InputModalityBoot() {
  useEffect(() => installInputModality(), []);
  return null;
}
