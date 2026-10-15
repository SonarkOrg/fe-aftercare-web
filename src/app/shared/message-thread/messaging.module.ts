import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { SharedModule } from '../shared.module';
import { MessageThreadComponent } from './message-thread.component';

/** The message thread is used by the patient file and by the Messages page, both lazy-loaded. */
@NgModule({
  declarations: [MessageThreadComponent],
  imports: [CommonModule, FormsModule, RouterModule, SharedModule],
  exports: [MessageThreadComponent]
})
export class MessagingModule {}
