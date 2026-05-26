import { describe, expect, it } from 'vitest';
import { getContentRefreshMode } from '../contentRefreshMode';

describe('getContentRefreshMode', () => {
  it('polls local log files in live mode', () => {
    expect(getContentRefreshMode('nginx', true)).toBe('poll');
  });

  it('polls the local system journal in live mode', () => {
    expect(getContentRefreshMode('(system-journal)', true)).toBe('poll');
  });

  it('streams remote log files in live mode', () => {
    expect(getContentRefreshMode('remote:prod', true)).toBe('stream');
  });

  it('loads once when live mode is paused', () => {
    expect(getContentRefreshMode('remote:prod', false)).toBe('once');
  });
});
