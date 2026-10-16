import { Component, OnInit } from '@angular/core';
import { QuestionnaireDefinitionService } from '../../Services/QuestionnaireDefinition.service';
import { QuestionnaireDefinition } from '../../models/questionnaire-definition.model';
import { questionnaireTitle } from '../../i18n/content';
import { enumKey } from '../../i18n/enum-key';
import { I18nService } from '../../i18n/i18n.service';

@Component({
  selector: 'app-questionnaires',
  templateUrl: './questionnaires.component.html'
})
export class QuestionnairesComponent implements OnInit {
  definitions: QuestionnaireDefinition[] = [];
  loading = true;
  errorMessage: string | null = null;

  constructor(private service: QuestionnaireDefinitionService, private i18n: I18nService) {}

  titleOf(d: QuestionnaireDefinition): string {
    return questionnaireTitle(d, this.i18n.lang);
  }

  ngOnInit(): void {
    this.service.list().subscribe({
      next: d => {
        this.definitions = d;
        this.loading = false;
      },
      error: () => {
        this.loading = false;
        this.errorMessage = this.i18n.t('forms.error.load');
      }
    });
  }

  scope(d: QuestionnaireDefinition): string {
    const parts: string[] = [];
    if (d.specialty) {
      parts.push(this.i18n.t(enumKey('specialty', d.specialty)));
    }
    if (d.appointmentTypes.length) {
      parts.push(d.appointmentTypes.map(t => this.i18n.t(enumKey('appointmentType', t))).join(', '));
    }
    return parts.join(' / ') || '—';
  }
}
