import { describe, it, expect } from 'vitest';
import { sessionUserFromClaims } from './session-user';

describe('sessionUserFromClaims', () => {
  it('reads the id and email a Supabase token carries', () => {
    expect(sessionUserFromClaims({ sub: 'u1', email: 'sam@studio.test', role: 'authenticated' } as never))
      .toEqual({ id: 'u1', email: 'sam@studio.test' });
  });

  it('is signed out when there is no token', () => {
    expect(sessionUserFromClaims(null)).toBeNull();
    expect(sessionUserFromClaims(undefined)).toBeNull();
  });

  it('is signed out when the token carries no subject', () => {
    // A token can be perfectly signed and still name nobody. Inventing a user
    // here would hand every query an undefined id.
    expect(sessionUserFromClaims({ email: 'sam@studio.test' })).toBeNull();
    expect(sessionUserFromClaims({ sub: '' })).toBeNull();
    expect(sessionUserFromClaims({ sub: 42 })).toBeNull();
  });

  it('has no email rather than a wrong one', () => {
    expect(sessionUserFromClaims({ sub: 'u1' })).toEqual({ id: 'u1', email: null });
    expect(sessionUserFromClaims({ sub: 'u1', email: '' })).toEqual({ id: 'u1', email: null });
    expect(sessionUserFromClaims({ sub: 'u1', email: 12 })).toEqual({ id: 'u1', email: null });
  });
});
