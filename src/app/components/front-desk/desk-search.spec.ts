import { matchesName, matchesRow, maybeNam, nameParts, nameTokens, parseBirthDate } from './desk-search';

const p = (firstName: string, lastName: string, dateOfBirth: string | null = null) => ({ firstName, lastName, dateOfBirth });
const TODAY = '2026-11-27';

describe('desk-search', () => {
  describe('tokens and parts', () => {
    it('splits on whitespace, comma, hyphen and apostrophe, drops accents and upper-cases', () => {
      expect(nameTokens("Jean-François, d'Amour")).toEqual(['JEAN', 'FRANCOIS', 'D', 'AMOUR']);
    });

    it('turns the whole tokens ST and STE into SAINT and SAINTE (not the start of a word)', () => {
      expect(nameTokens('st-pierre')).toEqual(['SAINT', 'PIERRE']);
      expect(nameTokens('Ste Marie')).toEqual(['SAINTE', 'MARIE']);
      expect(nameTokens('Stéphane')).toEqual(['STEPHANE']);
    });

    it('adds the joined form when a name has several parts', () => {
      expect(nameParts('Gagnon-Tremblay')).toEqual(['GAGNON', 'TREMBLAY', 'GAGNONTREMBLAY']);
      expect(nameParts('de la Tour')).toEqual(['DE', 'LA', 'TOUR', 'DELATOUR']);
      expect(nameParts('Marie')).toEqual(['MARIE']);
    });
  });

  describe('name matching', () => {
    const find = (q: string, ...people: ReturnType<typeof p>[]) => people.filter(x => matchesName(x, q));

    it('finds Gagnon-Tremblay by tremblay, gagnon and the joined form', () => {
      const x = p('Luc', 'Gagnon-Tremblay');
      for (const q of ['tremblay', 'gagnon', 'gagnontrem', 'Gagnon Tremblay', 'tre']) {
        expect(find(q, x)).withContext(q).toEqual([x]);
      }
    });

    it('finds "de la Tour" by "de la tour" and by "tour"', () => {
      const x = p('Anne', 'de la Tour');
      expect(find('de la tour', x)).toEqual([x]);
      expect(find('tour', x)).toEqual([x]);
    });

    it('finds Jean-François by "jean fr", "jean-fr" and "jeanfr"', () => {
      const x = p('Jean-François', 'Roy');
      for (const q of ['jean fr', 'jean-fr', 'jeanfr', 'francois roy']) {
        expect(find(q, x)).withContext(q).toEqual([x]);
      }
    });

    it('finds Saint-Pierre by "st-pierre", "saint pierre" and "st", and still finds Stéphane by "st"', () => {
      const sp = p('Marc', 'Saint-Pierre');
      const st = p('Stéphane', 'Roy');
      expect(find('st-pierre', sp)).toEqual([sp]);
      expect(find('saint pierre', sp)).toEqual([sp]);
      expect(find('st', sp, st)).toEqual([sp, st]);
      expect(find('ste', st)).toEqual([st]);
      expect(find('sainte', sp)).toEqual([]);
    });

    it('treats the row side the same way ("St-Pierre" is found by "saint")', () => {
      expect(matchesName(p('Marc', 'St-Pierre'), 'saint')).toBeTrue();
    });

    it('requires every token and ignores accents and case', () => {
      expect(matchesName(p('Marie', 'Tremblay'), 'marie trem')).toBeTrue();
      expect(matchesName(p('Marie', 'Tremblay'), 'marie gag')).toBeFalse();
      expect(matchesName(p('Zoé', 'Côté'), 'ZOE COTE')).toBeTrue();
    });

    it('an empty or blank query matches everyone', () => {
      expect(matchesName(p('A', 'B'), '   ')).toBeTrue();
      expect(matchesRow(p('A', 'B'), '', TODAY)).toBeTrue();
    });
  });

  describe('date of birth', () => {
    it('accepts AAAA-MM-JJ, JJ/MM/AAAA, JJ-MM-AAAA and JJMMAAAA', () => {
      for (const q of ['1968-04-12', '12/04/1968', '12-04-1968', '12041968']) {
        expect(parseBirthDate(q, TODAY)).withContext(q).toBe('1968-04-12');
      }
    });

    it('rejects impossible dates, two-digit years, future dates and partial input', () => {
      for (const q of ['31/02/1990', '12/04/68', '12041', '2027-01-01', '12/13/1990', '00/01/1990', '1968-4-12', 'abc']) {
        expect(parseBirthDate(q, TODAY)).withContext(q).toBeNull();
      }
    });

    it('matches a row by equality of the date of birth', () => {
      const marie = p('Marie', 'Tremblay', '1968-04-12');
      expect(matchesRow(marie, '12/04/1968', TODAY)).toBeTrue();
      expect(matchesRow(marie, '12041968', TODAY)).toBeTrue();
      expect(matchesRow(marie, '1968-04-12', TODAY)).toBeTrue();
      expect(matchesRow(marie, '13/04/1968', TODAY)).toBeFalse();
      expect(matchesRow(p('Jean', 'Gagnon', null), '12/04/1968', TODAY)).toBeFalse();
    });
  });

  describe('NAM detection', () => {
    it('recognises a card number and the start of one, never a name or a date', () => {
      expect(maybeNam('ROYS85522712')).toBeTrue();
      expect(maybeNam('roys 8552 2712')).toBeTrue();
      expect(maybeNam('ROYS8552')).toBeTrue();
      expect(maybeNam('TREM 68 12 12 12')).toBeTrue();
      expect(maybeNam('TREM.6812.1212')).toBeTrue();
      expect(maybeNam('TREM 68 1')).toBeTrue();
      expect(maybeNam('tremblay')).toBeFalse();
      expect(maybeNam('12/04/1968')).toBeFalse();
      expect(maybeNam('jean fr')).toBeFalse();
    });
  });
});
