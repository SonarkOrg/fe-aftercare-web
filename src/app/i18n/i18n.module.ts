import { NgModule } from '@angular/core';
import { DurationPipe, EnumLabelPipe, FileSizePipe, NumPipe, PctPipe, TzDatePipe } from './format.pipes';
import { TPipe } from './t.pipe';

const PIPES = [TPipe, TzDatePipe, NumPipe, PctPipe, FileSizePipe, DurationPipe, EnumLabelPipe];

@NgModule({ declarations: PIPES, exports: PIPES })
export class I18nModule {}
