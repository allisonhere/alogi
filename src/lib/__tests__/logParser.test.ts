import { describe, it, expect } from 'vitest';
import { parseLogLine } from '../logParser';

describe('logParser', () => {
  it('should detect error severity', () => {
    const result = parseLogLine('2023-10-27 10:00:00 [ERROR] Connection failed');
    expect(result.severity).toBe('error');
    // "[ERROR]" matches the timestamp regex \[.*?\ ]
    expect(result.tokens).toEqual(expect.arrayContaining([
      expect.objectContaining({ text: '[ERROR]', type: 'timestamp' }),
      expect.objectContaining({ text: 'failed', type: 'keyword-error' })
    ]));
  });

  it('should detect warning severity', () => {
    const result = parseLogLine('2023-10-27 10:00:00 [WARN] High latency detected');
    expect(result.severity).toBe('warn');
  });

  it('should parse timestamps correctly', () => {
    const result = parseLogLine('[2023-10-27 10:00:00] Info message');
    expect(result.tokens[0]).toEqual({ text: '[2023-10-27 10:00:00]', type: 'timestamp' });
  });

  it('should handle search queries', () => {
    const result = parseLogLine('User admin logged in', 'admin');
    const matchToken = result.tokens.find(t => t.type === 'match');
    expect(matchToken).toBeDefined();
    expect(matchToken?.text).toBe('admin');
  });

  it('should handle case-insensitive search', () => {
    const result = parseLogLine('User ADMIN logged in', 'admin');
    const matchToken = result.tokens.find(t => t.type === 'match');
    expect(matchToken).toBeDefined();
    expect(matchToken?.text).toBe('ADMIN');
  });

  it('should detect JSON', () => {
    const jsonStr = '{"foo":"bar"}';
    const result = parseLogLine(jsonStr);
    expect(result.isJson).toBe(true);
    expect(result.jsonContent).toEqual({ foo: 'bar' });
  });

  it('should handle regex search', () => {
    // Regex matching "User" followed by 3 digits
    const result = parseLogLine('User 123 logged in', 'User \\d{3}', true);
    const matchToken = result.tokens.find(t => t.type === 'match');
    expect(matchToken).toBeDefined();
    expect(matchToken?.text).toBe('User 123');
  });

  it('should handle invalid regex safely', () => {
    // Invalid regex (unclosed group)
    const result = parseLogLine('Some text', '(', true);
    const matchToken = result.tokens.find(t => t.type === 'match');
    expect(matchToken).toBeUndefined();
    // Should still parse other tokens normally
    expect(result.tokens.length).toBeGreaterThan(0);
  });
});