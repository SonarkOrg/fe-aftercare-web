import { Component, ElementRef, OnInit, ViewChild } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { PublicQuestionnaireService } from '../../Services/PublicQuestionnaire.service';
import { FhirQuestionnaireResponse } from '../../fhir/fhir.model';
import { localize } from '../../fhir/fhir.util';
import { PublicSession } from '../../models/public-session.model';
import { PatientLang, QUESTIONNAIRE_TEXT, QuestionnaireText } from './patient-questionnaire.i18n';

export type PageState = 'loading' | 'invalid' | 'form' | 'submitting' | 'done' | 'already' | 'error';

const LANG_KEY = 'aftercare.lang';

@Component({
  selector: 'app-patient-questionnaire',
  templateUrl: './patient-questionnaire.component.html'
})
export class PatientQuestionnaireComponent implements OnInit {
  code = '';
  lang: PatientLang = 'fr';
  state: PageState = 'loading';
  session: PublicSession | null = null;
  current: FhirQuestionnaireResponse | null = null;
  errorKey: 'error' | 'validationError' = 'error';
  /** True when the error came from submitting (the form stays visible so answers are kept). */
  submitFailed = false;

  @ViewChild('statusMsg') statusMsg?: ElementRef<HTMLElement>;

  constructor(private route: ActivatedRoute, private service: PublicQuestionnaireService) {}

  get t(): QuestionnaireText {
    return QUESTIONNAIRE_TEXT[this.lang];
  }

  get formVisible(): boolean {
    return !!this.session && (this.state === 'form' || this.state === 'submitting' || (this.state === 'error' && this.submitFailed));
  }

  get isCheckin(): boolean {
    return this.session?.kind === 'FOLLOW_UP_CHECKIN';
  }

  get title(): string {
    const q = this.session?.questionnaire;
    return q ? localize(q.title, q._title, this.lang) : '';
  }

  ngOnInit(): void {
    try {
      const stored = localStorage.getItem(LANG_KEY);
      if (stored === 'fr' || stored === 'en') {
        this.lang = stored;
      }
    } catch {
      // storage unavailable: keep the default
    }
    document.documentElement.lang = this.lang;
    this.code = this.route.snapshot.paramMap.get('code') ?? '';
    this.load();
  }

  toggleLang(): void {
    this.lang = this.lang === 'fr' ? 'en' : 'fr';
    document.documentElement.lang = this.lang;
    try {
      localStorage.setItem(LANG_KEY, this.lang);
    } catch {
      // ignore
    }
  }

  load(): void {
    this.state = 'loading';
    this.submitFailed = false;
    this.service.get(this.code).subscribe({
      next: s => {
        this.session = s;
        this.current = null;
        this.state = s.submitted ? 'already' : 'form';
        if (s.submitted) {
          this.focusStatus();
        }
      },
      error: err => {
        this.state = err?.status === 404 ? 'invalid' : 'error';
        if (this.state === 'invalid') {
          this.focusStatus();
        }
      }
    });
  }

  submit(): void {
    if (this.current === null || !this.formVisible || this.state === 'submitting') {
      return;
    }
    this.state = 'submitting';
    this.submitFailed = false;
    this.service.submit(this.code, this.current).subscribe({
      next: () => {
        this.state = 'done';
        this.focusStatus();
      },
      error: err => {
        if (err?.status === 409) {
          this.state = 'already';
          this.focusStatus();
        } else if (err?.status === 404) {
          this.state = 'invalid';
          this.focusStatus();
        } else {
          this.errorKey = err?.status === 400 ? 'validationError' : 'error';
          this.submitFailed = true;
          this.state = 'error';
        }
      }
    });
  }

  /** Moves focus to the status message once it has rendered (done / already / invalid). */
  private focusStatus(): void {
    setTimeout(() => this.statusMsg?.nativeElement.focus());
  }

  /** After a failed submit go back to the form (answers kept); otherwise reload the session. */
  retry(): void {
    if (this.submitFailed) {
      this.submitFailed = false;
      this.state = 'form';
      return;
    }
    this.errorKey = 'error';
    this.load();
  }
}
