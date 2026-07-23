import { describe, expect, it } from 'vitest';
import { getApiErrorMessage, getLoginErrorMessage } from './errors';

describe('getApiErrorMessage', () => {
  it('returns fallback for unknown error', () => {
    expect(getApiErrorMessage(null, 'Lỗi')).toBe('Lỗi');
  });

  it('extracts string message from axios-like error', () => {
    expect(
      getApiErrorMessage({ response: { data: { message: 'Không hợp lệ' } } }, 'Lỗi'),
    ).toBe('Không hợp lệ');
  });

  it('joins array messages', () => {
    expect(
      getApiErrorMessage({ response: { data: { message: ['A', 'B'] } } }, 'Lỗi'),
    ).toBe('A, B');
  });

  it('formats missing fields', () => {
    expect(
      getApiErrorMessage({ response: { data: { missing: ['fullName', 'phone'] } } }, 'Lỗi'),
    ).toBe('Thiếu: fullName, phone');
  });
});

describe('getLoginErrorMessage', () => {
  it('maps 401', () => {
    expect(getLoginErrorMessage({ response: { status: 401 } })).toMatch(/không đúng/i);
  });

  it('maps 429', () => {
    expect(getLoginErrorMessage({ response: { status: 429 } })).toMatch(/quá nhiều/i);
  });
});
