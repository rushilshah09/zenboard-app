import { describe, it, expect } from 'vitest';
import { isSafeWebhookUrl, buildWebhookAnswers } from './webhook';
import type { FormBlock } from './form-schema';

describe('isSafeWebhookUrl', () => {
  it('accepts a normal https URL', () => {
    expect(isSafeWebhookUrl('https://hooks.example.com/abc')).toBe(true);
    expect(isSafeWebhookUrl('https://api.zapier.com/hooks/catch/123/xyz')).toBe(true);
  });
  it('rejects non-https', () => {
    expect(isSafeWebhookUrl('http://hooks.example.com')).toBe(false);
    expect(isSafeWebhookUrl('ftp://x')).toBe(false);
  });
  it('rejects loopback and private/link-local hosts (SSRF)', () => {
    for (const u of [
      'https://localhost/x', 'https://127.0.0.1/x', 'https://0.0.0.0',
      'https://10.0.0.5/x', 'https://192.168.1.1', 'https://169.254.169.254/latest/meta-data',
      'https://172.16.0.1', 'https://172.31.255.255',
    ]) expect(isSafeWebhookUrl(u)).toBe(false);
  });
  it('allows public IPs outside the private ranges', () => {
    expect(isSafeWebhookUrl('https://172.15.0.1')).toBe(true); // just below the private block
    expect(isSafeWebhookUrl('https://8.8.8.8/hook')).toBe(true);
  });
  it('rejects empty / malformed', () => {
    expect(isSafeWebhookUrl('')).toBe(false);
    expect(isSafeWebhookUrl(null)).toBe(false);
    expect(isSafeWebhookUrl('not a url')).toBe(false);
  });
});

describe('buildWebhookAnswers', () => {
  const blocks: FormBlock[] = [
    { id: 'f1', type: 'short_text', label: 'Your name' },
    { id: 'f2', type: 'email', label: 'Email' },
    { id: 'f3', type: 'long_text', label: '' }, // unlabeled → falls back to id
    { id: 'f4', type: 'heading', label: 'Section' }, // layout block, no answer
  ];
  it('keys answers by human label, in block order, only for answered fields', () => {
    const out = buildWebhookAnswers(blocks, { f2: 'a@b.com', f1: 'Sam', f3: 'hello' });
    expect(out).toEqual({ 'Your name': 'Sam', Email: 'a@b.com', f3: 'hello' });
    expect(Object.keys(out)).toEqual(['Your name', 'Email', 'f3']); // preserves block order
  });
  it('omits fields the respondent left out', () => {
    expect(buildWebhookAnswers(blocks, { f1: 'Sam' })).toEqual({ 'Your name': 'Sam' });
  });
  it('sends a file answer as its filename, never the internal storage path', () => {
    const withFile: FormBlock[] = [...blocks, { id: 'f5', type: 'file', label: 'Brief' }];
    const out = buildWebhookAnswers(withFile, { f1: 'Sam', f5: 'a1b2c3/9f8e7d6c-brief.pdf' });
    expect(out).toEqual({ 'Your name': 'Sam', Brief: 'brief.pdf' });
  });
});
