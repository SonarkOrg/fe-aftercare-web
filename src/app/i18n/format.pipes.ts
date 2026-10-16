import { Pipe, PipeTransform } from '@angular/core';
import { DatePreset } from './date-presets';
import { EnumGroup, enumKey } from './enum-key';
import { fmtDate, fmtDuration, fmtFileSize, fmtNum, fmtPct } from './format';
import { I18nService } from './i18n.service';

@Pipe({ name: 'tzDate' })
export class TzDatePipe implements PipeTransform {
  constructor(private i18n: I18nService) {}
  transform(value: string | Date | null | undefined, preset: DatePreset): string {
    return fmtDate(value, preset, this.i18n.lang);
  }
}

@Pipe({ name: 'num' })
export class NumPipe implements PipeTransform {
  constructor(private i18n: I18nService) {}
  transform(value: number | string | null | undefined, digits = '1.0-2'): string {
    return fmtNum(value, digits, this.i18n.lang);
  }
}

@Pipe({ name: 'pct' })
export class PctPipe implements PipeTransform {
  constructor(private i18n: I18nService) {}
  transform(rate: number | null | undefined): string {
    return fmtPct(rate, this.i18n.lang);
  }
}

@Pipe({ name: 'fileSize' })
export class FileSizePipe implements PipeTransform {
  constructor(private i18n: I18nService) {}
  transform(bytes: number): string {
    return fmtFileSize(bytes, this.i18n.lang);
  }
}

@Pipe({ name: 'duration' })
export class DurationPipe implements PipeTransform {
  transform(minutes: number | null | undefined): string {
    return fmtDuration(minutes);
  }
}

/** `{{ a.status | enumLabel:'alertStatus' }}` -> the translated enum value. */
@Pipe({ name: 'enumLabel' })
export class EnumLabelPipe implements PipeTransform {
  constructor(private i18n: I18nService) {}
  transform(value: string | null | undefined, group: EnumGroup): string {
    return value ? this.i18n.t(enumKey(group, value)) : '';
  }
}
