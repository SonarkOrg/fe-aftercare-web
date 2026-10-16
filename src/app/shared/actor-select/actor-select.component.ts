import { NgForOf } from '@angular/common';
import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { StaffService } from '../../Services/Staff.service';

/** "All staff" + the directory members that have a login (value = their auth0Subject). Used by both access-log views. */
@Component({
  selector: 'app-actor-select',
  standalone: true,
  imports: [NgForOf, FormsModule],
  template: `
    <label [attr.for]="selectId">Actor</label>
    <select [id]="selectId" class="select" [ngModel]="value" (ngModelChange)="changed.emit($event || null)">
      <option [ngValue]="null">All staff</option>
      <option *ngFor="let a of actors" [ngValue]="a.sub">{{ a.name }}</option>
    </select>`
})
export class ActorSelectComponent implements OnInit {
  @Input() selectId = 'actor-filter';
  @Input() value: string | null = null;
  @Output() changed = new EventEmitter<string | null>();

  actors: { sub: string; name: string }[] = [];

  constructor(private staff: StaffService) {}

  ngOnInit(): void {
    this.staff.list(true).subscribe({
      next: list => (this.actors = list.filter(s => !!s.auth0Subject).map(s => ({ sub: s.auth0Subject!, name: s.displayName }))),
      error: () => { /* the filter just offers "All staff" */ }
    });
  }
}
