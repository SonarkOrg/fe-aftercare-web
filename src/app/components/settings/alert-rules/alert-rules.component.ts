import { Component, OnInit } from '@angular/core';
import { forkJoin } from 'rxjs';
import { QuestionnaireDefinitionService } from '../../../Services/QuestionnaireDefinition.service';
import { FhirItem } from '../../../fhir/fhir.model';
import { Lang, localize } from '../../../fhir/fhir.util';
import { questionnaireTitle } from '../../../i18n/content';
import { fmtNum } from '../../../i18n/format';
import { I18nService } from '../../../i18n/i18n.service';
import { QuestionnaireDefinitionDetail, RuleJson } from '../../../models/questionnaire-definition.model';
import { ChipSpec, ruleOutcomeChip } from '../../../shared/status';

function findItem(items: FhirItem[] | undefined, linkId: string): FhirItem | undefined {
  for (const i of items ?? []) {
    if (i.linkId === linkId) {
      return i;
    }
    const nested = findItem(i.item, linkId);
    if (nested) {
      return nested;
    }
  }
  return undefined;
}

/** Read-only view of the alert thresholds, built from the form definitions (no endpoint of its own). */
@Component({
  selector: 'app-alert-rules',
  templateUrl: './alert-rules.component.html'
})
export class AlertRulesComponent implements OnInit {
  defs: QuestionnaireDefinitionDetail[] = [];
  loading = true;
  error = false;

  constructor(private definitions: QuestionnaireDefinitionService, public i18n: I18nService) {}

  get lang(): Lang {
    return this.i18n.lang === 'en' ? 'en' : 'fr';
  }

  titleOf(d: QuestionnaireDefinitionDetail): string {
    return questionnaireTitle(d, this.i18n.lang);
  }

  message(r: RuleJson): string {
    return r.outcome.message[this.lang] || r.outcome.message.fr || r.outcome.message.en;
  }

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading = true;
    this.error = false;
    this.definitions.list().subscribe({
      next: list => {
        const active = list.filter(d => d.status === 'ACTIVE');
        if (!active.length) {
          this.defs = [];
          this.loading = false;
          return;
        }
        forkJoin(active.map(d => this.definitions.get(d.id))).subscribe({
          next: details => {
            this.defs = details;
            this.loading = false;
          },
          error: () => this.fail()
        });
      },
      error: () => this.fail()
    });
  }

  private fail(): void {
    this.loading = false;
    this.error = true;
  }

  question(d: QuestionnaireDefinitionDetail, r: RuleJson): string {
    const item = findItem(d.questionnaire.item, r.linkId);
    return item ? localize(item.text, item._text, this.lang) || r.linkId : r.linkId;
  }

  /** Operators as the backend stores them: '>=', '<=', 'equals-true', 'equals-false', 'in'. */
  condition(d: QuestionnaireDefinitionDetail, r: RuleJson): string {
    const v = r.value;
    switch (r.operator) {
      case 'equals-true': return `= ${this.i18n.t('common.yes')}`;
      case 'equals-false': return `= ${this.i18n.t('common.no')}`;
      case '>=': return v === undefined || v === null ? '—' : `≥ ${this.n(v)}`;
      case '<=': return v === undefined || v === null ? '—' : `≤ ${this.n(v)}`;
      case 'in': {
        const item = findItem(d.questionnaire.item, r.linkId);
        const codes = Array.isArray(v) ? v : [];
        return codes.map(code => {
          const opt = item?.answerOption?.find(o => o.valueCoding.code === code)?.valueCoding;
          return opt ? localize(opt.display, opt._display, this.lang) || code : code;
        }).join(', ') || '—';
      }
      default: return v === undefined || v === null ? r.operator : `${r.operator} ${v}`;
    }
  }

  private n(v: number | string[]): string {
    return typeof v === 'number' ? fmtNum(v, '1.0-2', this.i18n.lang) : String(v);
  }

  outcome(r: RuleJson): ChipSpec {
    return ruleOutcomeChip(r.outcome);
  }
}
