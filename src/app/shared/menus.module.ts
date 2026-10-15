import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { SharedModule } from './shared.module';
import { ConfirmInlineComponent } from './confirm-inline/confirm-inline.component';
import { RowMenuComponent } from './row-menu/row-menu.component';

/** Row menu and inline confirmation: only the lazy patient file and settings pages use them, so they stay out of the eager bundle. */
@NgModule({
  declarations: [RowMenuComponent, ConfirmInlineComponent],
  imports: [CommonModule, SharedModule],
  exports: [RowMenuComponent, ConfirmInlineComponent]
})
export class MenusModule {}
