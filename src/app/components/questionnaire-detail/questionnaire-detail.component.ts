import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { QuestionnaireDefinitionService } from '../../Services/QuestionnaireDefinition.service';
import { Lang } from '../../fhir/fhir.util';
import { questionnaireTitle } from '../../i18n/content';
import { enumKey } from '../../i18n/enum-key';
import { I18nService } from '../../i18n/i18n.service';
import { TKey } from '../../i18n/i18n.types';
import { ApiErrorsService } from '../../i18n/api-errors';
import { QuestionnaireDefinitionDetail, RuleJson } from '../../models/questionnaire-definition.model';
import { ChipSpec, severityChip } from '../../shared/status';

@Component({
  selector: 'app-questionnaire-detail',
  templateUrl: './questionnaire-detail.component.html'
})
export class QuestionnaireDetailComponent implements OnInit {
  def: QuestionnaireDefinitionDetail | null = null;
  lang: Lang = this.i18n.lang === 'en' ? 'en' : 'fr';
  notFound = false;
  errorMessage: string | null = null;
  severityChip = severityChip;
  reviewChip: ChipSpec = { tone: 'serious', glyph: '◆', label: { key: 'chip.rule.needsReview' } };

  constructor(private route: ActivatedRoute, private service: QuestionnaireDefinitionService, private i18n: I18nService, private errors: ApiErrorsService) {}

  get formLang(): Lang {
    return this.i18n.lang === 'en' ? 'en' : 'fr';
  }

  titleOf(d: QuestionnaireDefinitionDetail): string {
    return questionnaireTitle(d, this.i18n.lang);
  }

  appointmentTypes(d: QuestionnaireDefinitionDetail): string {
    return d.appointmentTypes.length ? d.appointmentTypes.map(t => this.i18n.t(enumKey('appointmentType', t))).join(', ') : '—';
  }

  outcomeKey(r: RuleJson): TKey {
    return r.outcome.type === 'ALERT' ? 'forms.outcome.ALERT' : 'forms.outcome.NEEDS_REVIEW';
  }

  ngOnInit(): void {
    const id = Number(this.route.snapshot.paramMap.get('id'));
    this.service.get(id).subscribe({
      next: d => (this.def = d),
      error: err => {
        if (err?.status === 404) {
          this.notFound = true;
        } else {
          this.errorMessage = this.errors.text(err, 'forms.error.loadOne');
        }
      }
    });
  }

  ruleValue(r: RuleJson): string {
    if (r.value === undefined || r.value === null) {
      return '—';
    }
    return Array.isArray(r.value) ? r.value.join(', ') : String(r.value);
  }
}
