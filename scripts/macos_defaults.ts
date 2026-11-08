#!/usr/bin/env bun
// macOS `defaults` settings this machine is expected to have. `./up macos`
// writes them; `./up doctor` checks them.

import { lookupApp, run, type AppLookup, type Runner } from './lib/run';

export type DefaultValue = { type: 'bool'; value: boolean };

interface BaseSetting {
  key: string;
  description: string;
}

// Either a fixed domain (`-g` for NSGlobalDomain) or an app whose bundle id is
// resolved at run time. Resolving by name covers apps whose id isn't stable
// or obvious (Cursor's is com.todesktop.<hash>) and lets a missing app be skipped.
export type DefaultSetting = BaseSetting & DefaultValue & ({ domain: string } | { app: string });

export const SETTINGS: DefaultSetting[] = [
  {
    domain: '-g',
    key: 'NSAutomaticPeriodSubstitutionEnabled',
    type: 'bool',
    value: false,
    description: 'Keyboard: disable "Add period with double-space"',
  },
  ...['Visual Studio Code', 'Visual Studio Code - Insiders', 'Cursor'].map(
    (app): DefaultSetting => ({
      app,
      key: 'ApplePressAndHoldEnabled',
      type: 'bool',
      value: false,
      description: `${app}: key repeat instead of the accent popup`,
    })
  ),
];

export function settingLabel(s: DefaultSetting): string {
  return `${'domain' in s ? s.domain : s.app} ${s.key}`;
}

// The domain to pass to `defaults` (as `id`), or why there is none.
export async function resolveDomain(s: DefaultSetting, runner: Runner = run): Promise<AppLookup> {
  return 'domain' in s ? { kind: 'installed', id: s.domain } : lookupApp(runner, s.app);
}

// `defaults read` prints booleans as 1/0.
export function encodeRead(v: DefaultValue): string {
  return v.value ? '1' : '0';
}

export function writeArgs(domain: string, s: DefaultSetting): string[] {
  return ['defaults', 'write', domain, s.key, `-${s.type}`, String(s.value)];
}

export type ApplyOutcome = { setting: DefaultSetting; result: 'written' | 'skipped' | 'failed'; message?: string };

export async function applyAll(settings: DefaultSetting[], runner: Runner = run): Promise<ApplyOutcome[]> {
  const outcomes: ApplyOutcome[] = [];
  for (const setting of settings) {
    const domain = await resolveDomain(setting, runner);
    if (domain.kind === 'missing') {
      outcomes.push({ setting, result: 'skipped', message: 'app not installed' });
      continue;
    }
    if (domain.kind === 'error') {
      outcomes.push({ setting, result: 'failed', message: domain.message });
      continue;
    }
    const res = await runner(writeArgs(domain.id, setting));
    outcomes.push(
      res.exitCode === 0
        ? { setting, result: 'written' }
        : { setting, result: 'failed', message: res.stderr.trim() }
    );
  }
  return outcomes;
}

async function main() {
  const outcomes = await applyAll(SETTINGS);
  for (const o of outcomes) {
    const mark = { written: '✅', skipped: '⏭ ', failed: '❌' }[o.result];
    console.log(`${mark} ${settingLabel(o.setting)}${o.message ? ` (${o.message})` : ''}`);
  }
  console.log('\nRestart the affected apps (or log out) for the changes to take effect.');
  if (outcomes.some(o => o.result === 'failed')) process.exit(1);
}

if (import.meta.main) await main();
