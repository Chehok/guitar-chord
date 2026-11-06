#!/usr/bin/env node
/**
 * 로컬/CI용 수동 스모크: Ponytail mode-tracker를 Cursor 환경으로 가장해 stdin JSON을 넣고 stdout을 측정합니다.
 * 실제 Cursor 또는 Cloud Agent가 훅을 호출했다는 증거는 아닙니다.
 */
const { spawnSync } = require('child_process');
const path = require('path');

const root = path.join(__dirname, '..');
const tracker = path.join(root, 'vendor', 'ponytail', 'hooks', 'ponytail-mode-tracker.js');

function runTracker(prompt) {
  return spawnSync(process.execPath, [tracker], {
    input: JSON.stringify({ prompt }),
    env: {
      ...process.env,
      CURSOR_VERSION: process.env.CURSOR_VERSION || 'smoke-test-9a81',
      CURSOR_PROJECT_DIR: root,
    },
    encoding: 'utf8',
    maxBuffer: 20 * 1024 * 1024,
  });
}

function measure(label, prompt) {
  const r = runTracker(prompt);
  if (r.status !== 0) {
    console.error(label, 'exit', r.status, 'stderr:', r.stderr);
    process.exit(1);
  }
  const out = r.stdout || '';
  let parsed = null;
  try {
    parsed = out.trim() ? JSON.parse(out.trim()) : null;
  } catch (e) {
    console.error(label, 'JSON parse error:', e.message, 'stdout:', out.slice(0, 200));
    process.exit(1);
  }
  const ctx = parsed && typeof parsed.additional_context === 'string' ? parsed.additional_context : '';
  console.log(
    label,
    '| stdout bytes:', Buffer.byteLength(out, 'utf8'),
    '| additional_context chars:', ctx.length,
    '| keys:',
    parsed ? Object.keys(parsed).join(',') : '(empty)',
  );
}

measure('ordinary prompt', 'Say hello in one word.');
measure('opt-in /ponytail lite', '/ponytail lite');
