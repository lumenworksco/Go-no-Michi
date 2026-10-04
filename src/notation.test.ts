import { describe, expect, it } from 'vitest';
import { sgfResultText } from './notation';

describe('SGF の結果の文', () => {
  it('目数・投了・持碁を、かなの文にする', () => {
    expect(sgfResultText('B+3.5')).toBe('くろの 3もくはん かち');
    expect(sgfResultText('W+12')).toBe('しろの 12もく かち');
    expect(sgfResultText('W+R')).toBe('しろの かち（あいてが とうりょう）');
    expect(sgfResultText('b+Resign')).toBe('くろの かち（あいてが とうりょう）');
    expect(sgfResultText('0')).toBe('じご（ひきわけ）');
    expect(sgfResultText('Draw')).toBe('じご（ひきわけ）');
    expect(sgfResultText('B+T')).toBe('くろの かち');
  });
  it('読めない形は null', () => {
    expect(sgfResultText('?')).toBeNull();
    expect(sgfResultText('')).toBeNull();
    expect(sgfResultText('Void')).toBeNull();
  });
});
