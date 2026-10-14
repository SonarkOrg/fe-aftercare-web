import { Component, OnInit } from '@angular/core';
import { QuestionnaireDefinitionService } from '../../Services/QuestionnaireDefinition.service';
import { QuestionnaireDefinition } from '../../models/questionnaire-definition.model';
import { humanize } from '../../shared/link.util';

@Component({
  selector: 'app-questionnaires',
  templateUrl: './questionnaires.component.html'
})
export class QuestionnairesComponent implements OnInit {
  definitions: QuestionnaireDefinition[] = [];
  loading = true;
  errorMessage: string | null = null;
  humanize = humanize;

  constructor(private service: QuestionnaireDefinitionService) {}

  ngOnInit(): void {
    this.service.list().subscribe({
      next: d => {
        this.definitions = d;
        this.loading = false;
      },
      error: () => {
        this.loading = false;
        this.errorMessage = 'Could not load forms.';
      }
    });
  }

  scope(d: QuestionnaireDefinition): string {
    const parts: string[] = [];
    if (d.specialty) {
      parts.push(humanize(d.specialty));
    }
    if (d.appointmentTypes.length) {
      parts.push(d.appointmentTypes.map(humanize).join(', '));
    }
    return parts.join(' / ') || '—';
  }
}
