import { DatePreset } from '../i18n/date-presets';
import { NBSP, fmtDate, fmtNum } from '../i18n/format';
import { I18nService } from '../i18n/i18n.service';
import { Params, TKey } from '../i18n/i18n.types';

/** Everything a chart needs to write text: translated strings, dates and numbers. Specs build an English one from CORE_EN. */
export interface ChartText {
  t(key: TKey, params?: Params): string;
  date(value: string, preset: DatePreset): string;
  num(value: number, digits?: string): string;
  /** A measured value with its unit: "38.4°C" in English, "38,4 °C" in French. */
  value(value: number, unit: string): string;
}

export function chartTextFor(i18n: I18nService): ChartText {
  return {
    t: (key, params) => i18n.t(key, params),
    date: (value, preset) => fmtDate(value, preset, i18n.lang),
    num: (value, digits = '1.0-2') => fmtNum(value, digits, i18n.lang),
    value: (value, unit) => fmtNum(value, '1.0-2', i18n.lang) + (unit && i18n.lang === 'fr' ? NBSP : '') + unit
  };
}
