import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { QuestionnaireDefinitionService } from '../../Services/QuestionnaireDefinition.service';
import { Lang } from '../../fhir/fhir.util';
import { QuestionnaireDefinitionDetail, RuleJson } from '../../models/questionnaire-definition.model';
import { humanize } from '../../shared/link.util';

@Component({
  selector: 'app-questionnaire-detail',
  templateUrl: './questionnaire-detail.component.html'
})
export class QuestionnaireDetailComponent implements OnInit {
  def: QuestionnaireDefinitionDetail | null = null;
  lang: Lang = 'en';
  notFound = false;
  errorMessage: string | null = null;
  humanize = humanize;

  constructor(private route: ActivatedRoute, private service: QuestionnaireDefinitionService) {}

  ngOnInit(): void {
    const id = Number(this.route.snapshot.paramMap.get('id'));
    this.service.get(id).subscribe({
      next: d => (this.def = d),
      error: err => {
        if (err?.status === 404) {
          this.notFound = true;
        } else {
          this.errorMessage = 'Could not load form.';
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
