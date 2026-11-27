import { Component, EventEmitter, Input, Output } from '@angular/core';
import { PatientMatch } from '../../../models/arrival.model';

/** The panel under a search result that has no appointment today: the file, or a visit without appointment. */
@Component({
  selector: 'app-result-panel',
  templateUrl: './result-panel.component.html'
})
export class ResultPanelComponent {
  @Input() match!: PatientMatch;
  @Input() readOnly = false;
  @Output() walkIn = new EventEmitter<PatientMatch>();
}
