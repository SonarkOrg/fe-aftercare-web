import { report } from '../testing/fixtures';
import { fmtDuration, fmtPct } from '../i18n/format';
import { testT } from '../testing/i18n-testing.module';
import { reportCsv } from './report.util';

describe('report.util', () => {
  it('pct', () => {
    expect(fmtPct(0.62, 'fr')).toBe('62\u00a0%');
    expect(fmtPct(0.62, 'en')).toBe('62%');
    expect(fmtPct(1, 'fr')).toBe('100\u00a0%');
    expect(fmtPct(0, 'en')).toBe('0%');
    expect(fmtPct(null, 'en')).toBe('—');
  });

  it('minutes', () => {
    expect(fmtDuration(45)).toBe('45\u00a0min');
    expect(fmtDuration(65)).toBe('1\u00a0h\u00a005');
    expect(fmtDuration(185)).toBe('3\u00a0h\u00a005');
    expect(fmtDuration(120)).toBe('2\u00a0h\u00a000');
    expect(fmtDuration(44.6)).toBe('45\u00a0min');
    expect(fmtDuration(null)).toBe('—');
    expect(fmtDuration(-5)).toBe('—');
    expect(fmtDuration(-0.4)).toBe('—');
    expect(fmtDuration(0)).toBe('0\u00a0min');
  });

  describe('reportCsv', () => {
    const t = testT('en');
    const csv = reportCsv(report(), t);
    const lines = csv.split('\r\n');

    it('starts with a BOM, uses CRLF and ends with a line break', () => {
      expect(csv.charCodeAt(0)).toBe(0xfeff);
      expect(csv).not.toMatch(/[^\r]\n/);
      expect(csv.endsWith('\r\n')).toBeTrue();
    });

    it('quotes every cell', () => {
      expect(lines[0]).toBe('\uFEFF"Metric","Value"');
      for (const l of lines.filter(x => x)) {
        expect(l.replace('\uFEFF', '')).toMatch(/^("([^"]|"")*"(,|$))+$/);
      }
    });

    it('writes every scalar of the four sections, rates with 4 decimals and nulls empty', () => {
      expect(lines).toContain('"checkIns.expected","20"');
      expect(lines).toContain('"checkIns.completionRate","0.7500"');
      expect(lines).toContain('"checkIns.throughDate","2026-10-14"');
      expect(lines).toContain('"followUps.activeNow","4"');
      expect(lines).toContain('"alerts.meanMinutesToAcknowledge","45"');
      expect(lines).toContain('"appointments.needsReviewRate","0.3333"');
      expect(lines).toContain('"appointments.noShowRate",""');
    });

    it('has a blank line, then the week header and one row per week', () => {
      const i = lines.indexOf('');
      expect(i).toBeGreaterThan(0);
      expect(lines[i + 1]).toBe('"Week start","From","To","Check-ins expected","Check-ins received","Alerts high","Alerts medium"');
      expect(lines[i + 2]).toBe('"2026-09-14","2026-09-18","2026-09-20","4","3","1","2"');
      expect(lines[i + 3]).toBe('"2026-09-21","2026-09-21","2026-09-27","0","0","0","0"');
    });

    it('translates only the two header rows: every data row is identical in French', () => {
      const fr = reportCsv(report(), testT('fr')).split('\r\n');
      expect(fr[0]).toBe('\uFEFF"Indicateur","Valeur"');
      expect(fr.slice(1, lines.indexOf('') + 1)).toEqual(lines.slice(1, lines.indexOf('') + 1));
      expect(fr[lines.indexOf('') + 1]).toContain('"Début de la semaine"');
      expect(fr.slice(lines.indexOf('') + 2)).toEqual(lines.slice(lines.indexOf('') + 2));
    });

    it('leaves numbers alone: a negative number is not prefixed, a string that looks like one is', () => {
      const base = report();
      const neg = reportCsv(report({ alerts: { ...base.alerts, meanMinutesToAcknowledge: -3 } }), t);
      expect(neg).toContain('"alerts.meanMinutesToAcknowledge","-3"');
      expect(neg).not.toContain('\'-3');
      expect(reportCsv(report({ checkIns: { ...base.checkIns, throughDate: '-3' } }), t)).toContain('"\'-3"');
    });

    it('doubles inner quotes and defuses formula injection', () => {
      const evil = report({ checkIns: { ...report().checkIns, throughDate: '=cmd|\' /C calc\'!A0 "x"' } });
      const out = reportCsv(evil, t);
      expect(out).toContain('"\'=cmd|\' /C calc\'!A0 ""x"""');
      for (const lead of ['+1', '-1', '@SUM(1)', '\tx', '\rx']) {
        expect(reportCsv(report({ checkIns: { ...report().checkIns, throughDate: lead } }), t)).toContain(`"'${lead}"`);
      }
    });
  });
});
