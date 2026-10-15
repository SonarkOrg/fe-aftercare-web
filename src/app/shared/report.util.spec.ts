import { report } from '../testing/fixtures';
import { minutes, pct, reportCsv } from './report.util';

describe('report.util', () => {
  it('pct', () => {
    expect(pct(0.62)).toBe('62 %');
    expect(pct(1)).toBe('100 %');
    expect(pct(0)).toBe('0 %');
    expect(pct(null)).toBe('—');
  });

  it('minutes', () => {
    expect(minutes(45)).toBe('45 min');
    expect(minutes(65)).toBe('1 h 05');
    expect(minutes(185)).toBe('3 h 05');
    expect(minutes(120)).toBe('2 h 00');
    expect(minutes(44.6)).toBe('45 min');
    expect(minutes(null)).toBe('—');
    expect(minutes(-5)).toBe('—');
    expect(minutes(-0.4)).toBe('—');
    expect(minutes(0)).toBe('0 min');
  });

  describe('reportCsv', () => {
    const csv = reportCsv(report());
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

    it('leaves numbers alone: a negative number is not prefixed, a string that looks like one is', () => {
      const base = report();
      const neg = reportCsv(report({ alerts: { ...base.alerts, meanMinutesToAcknowledge: -3 } }));
      expect(neg).toContain('"alerts.meanMinutesToAcknowledge","-3"');
      expect(neg).not.toContain('\'-3');
      expect(reportCsv(report({ checkIns: { ...base.checkIns, throughDate: '-3' } }))).toContain('"\'-3"');
    });

    it('doubles inner quotes and defuses formula injection', () => {
      const evil = report({ checkIns: { ...report().checkIns, throughDate: '=cmd|\' /C calc\'!A0 "x"' } });
      const out = reportCsv(evil);
      expect(out).toContain('"\'=cmd|\' /C calc\'!A0 ""x"""');
      for (const lead of ['+1', '-1', '@SUM(1)', '\tx', '\rx']) {
        expect(reportCsv(report({ checkIns: { ...report().checkIns, throughDate: lead } }))).toContain(`"'${lead}"`);
      }
    });
  });
});
