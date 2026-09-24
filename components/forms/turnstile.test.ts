import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const walk = (dir: string): string[] => {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) out.push(...walk(path));
    else if (/\.tsx$/.test(path)) out.push(path);
  }
  return out;
};

describe('the captcha follows the page theme', () => {
  it('no call site pins the Turnstile widget to light or dark', () => {
    // The form respondent page is token-driven (bg-canvas, ink-900), so it follows
    // the reader's theme — and both TurnstileWidget call sites pinned theme="dark":
    // every light-mode respondent got a black captcha on a white form. With a first
    // visit now following the OS, that became every light-OS respondent. The widget
    // takes the page's RESOLVED theme instead.
    const offenders: string[] = [];
    for (const file of [...walk('components'), ...walk('app')]) {
      readFileSync(file, 'utf8').split('\n').forEach((line, i) => {
        if (/<TurnstileWidget\b[^>]*\btheme=["'](?:dark|light)["']/.test(line)) offenders.push(`${file}:${i + 1}`);
      });
    }
    expect(offenders, `a pinned captcha theme:\n${offenders.join('\n')}`).toEqual([]);
  });

  it('the widget itself defaults to the resolved page theme', () => {
    // Removing the pin alone falls back to Turnstile's 'auto', which follows the
    // OS — wrong for anyone who chose Light or Dark explicitly. The default lives in
    // the shared widget, so a future call site cannot get it wrong.
    const widget = readFileSync('components/forms/turnstile.tsx', 'utf8');
    expect(widget).toMatch(/useResolvedTheme\(\)/);
    expect(widget).not.toMatch(/theme\s*=\s*['"]auto['"]/);
  });
});
