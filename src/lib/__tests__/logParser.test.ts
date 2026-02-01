import { describe, it, expect } from 'vitest';
import { parseLogLine, extractTimestamp } from '../logParser';

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

describe('extractTimestamp', () => {
  it('should parse ISO 8601 with T separator', () => {
    const d = extractTimestamp('2024-01-15T14:30:00.000Z some log');
    expect(d).toBeInstanceOf(Date);
    expect(d!.getUTCHours()).toBe(14);
    expect(d!.getUTCMinutes()).toBe(30);
  });

  it('should parse ISO 8601 with space separator', () => {
    const d = extractTimestamp('2024-01-15 14:30:00 INFO starting');
    expect(d).toBeInstanceOf(Date);
    expect(d!.getHours()).toBe(14);
  });

  it('should parse syslog format', () => {
    const d = extractTimestamp('Jan 15 14:30:00 myhost kernel: stuff');
    expect(d).toBeInstanceOf(Date);
    expect(d!.getMonth()).toBe(0); // January
    expect(d!.getDate()).toBe(15);
  });

  it('should parse bracket-wrapped datetime', () => {
    const d = extractTimestamp('[2024-01-15 14:30:00] INFO hello');
    expect(d).toBeInstanceOf(Date);
    expect(d!.getHours()).toBe(14);
  });

  it('should parse bracket-wrapped time only', () => {
    const d = extractTimestamp('[14:30:00] some message');
    expect(d).toBeInstanceOf(Date);
    expect(d!.getHours()).toBe(14);
    expect(d!.getMinutes()).toBe(30);
  });

  it('should parse common log format', () => {
    const d = extractTimestamp('127.0.0.1 - - [15/Jan/2024:14:30:00 +0000] "GET /"');
    expect(d).toBeInstanceOf(Date);
    expect(d!.getDate()).toBe(15);
  });

  it('should return null for lines without timestamps', () => {
    expect(extractTimestamp('just some plain text')).toBeNull();
    expect(extractTimestamp('')).toBeNull();
  });
});