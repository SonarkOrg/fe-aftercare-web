import { Lang } from './i18n.types';

export type DatePreset = 'date' | 'dateShort' | 'dayShort' | 'dayShortYear' | 'dayLong' | 'dayLongYear'
  | 'weekdayDay' | 'time' | 'dateTime' | 'isoDateTime' | 'isoDate';

/** Angular date pattern syntax. Times are always 24-hour (Angular's `shortTime` is 12-hour in en-CA). */
export const DATE_PATTERNS: Record<Lang, Record<DatePreset, string>> = {
  fr: {
    date: 'd MMM y',
    dateShort: 'd MMM',
    dayShort: 'EEE d MMM',
    dayShortYear: 'EEE d MMM y',
    dayLong: 'EEEE d MMMM',
    dayLongYear: 'EEEE d MMMM y',
    weekdayDay: 'EEE d',
    time: "H\u00a0'h'\u00a0mm", // fmtDate renders fr 'time'/'dateTime' through fmtClock ("8 h", "14 h 05"); these patterns document the shape
    dateTime: "d MMM 'à' H\u00a0'h'\u00a0mm",
    isoDateTime: 'yyyy-MM-dd HH:mm',
    isoDate: 'yyyy-MM-dd'
  },
  en: {
    date: 'd MMM y',
    dateShort: 'd MMM',
    dayShort: 'EEE d MMM',
    dayShortYear: 'EEE d MMM y',
    dayLong: 'EEEE d MMMM',
    dayLongYear: 'EEEE, d MMMM y',
    weekdayDay: 'EEE d',
    time: 'HH:mm',
    dateTime: 'd MMM, HH:mm',
    isoDateTime: 'yyyy-MM-dd HH:mm',
    isoDate: 'yyyy-MM-dd'
  }
};
