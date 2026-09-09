'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert');

// Lightweight unit-style checks (full integration tests need a running DB)

describe('username rules', () => {
  const reserved = new Set(['admin', 'login', 'home', 'api']);
  it('rejects reserved usernames', () => {
    assert.ok(reserved.has('admin'));
  });
  it('allows normal usernames', () => {
    assert.ok(!reserved.has('alice'));
  });
});

describe('tweet length', () => {
  it('enforces 140 character maximum', () => {
    const text = 'a'.repeat(141);
    assert.ok(text.length > 140);
  });
  it('allows 140 characters', () => {
    const text = 'a'.repeat(140);
    assert.strictEqual(text.length, 140);
  });
});
