import { describe, it, expect } from 'vitest';
import { iniciaisDoNome, formatarHorario } from './text.js';

describe('iniciaisDoNome', () => {
  it('usa a inicial da primeira e da última palavra', () => {
    expect(iniciaisDoNome('Maria Clara Souza')).toBe('MS');
  });

  it('com um nome só, pega as duas primeiras letras', () => {
    expect(iniciaisDoNome('madonna')).toBe('MA');
  });

  it('vazio vira interrogação', () => {
    expect(iniciaisDoNome('   ')).toBe('?');
  });
});

describe('formatarHorario', () => {
  it('data ausente vira string vazia', () => {
    expect(formatarHorario(null)).toBe('');
  });

  it('formata uma data como HH:MM', () => {
    const d = new Date(2026, 0, 1, 9, 5);
    expect(formatarHorario(d)).toMatch(/^\d{2}:\d{2}$/);
  });
});
