import { Component, OnInit } from '@angular/core';
import { PrivacyGateService } from '../../../Services/PrivacyGate.service';
import { ApiErrorsService } from '../../../i18n/api-errors';
import { fmtDate } from '../../../i18n/format';
import { I18nService } from '../../../i18n/i18n.service';
import { TKey } from '../../../i18n/i18n.types';
import { PRIVACY_GATE_KEYS, PrivacyGate, PrivacyGateKey } from '../../../models/privacy-gate.model';

/** The two switches in the order of the decisions: P1 (the NAM may be recorded at all), then Q1 (reception may capture the card). */
export const GATE_LABELS: Record<PrivacyGateKey, TKey> = {
  NAM_COLLECTION: 'settings.gates.nam',
  HEALTH_CARD_CAPTURE: 'settings.gates.capture'
};

/**
 * Settings card « Confidentialité » (PRIV-A-40, ADMIN): records that the clinic took decisions P1 and Q1. A switch needs a
 * decision reference to be turned on; who decided and when is shown. Status is glyph + word (the dictionary text carries the glyph).
 */
@Component({
  selector: 'app-privacy-gates',
  templateUrl: './privacy-gates.component.html'
})
export class PrivacyGatesComponent implements OnInit {
  readonly keys = PRIVACY_GATE_KEYS;
  readonly labels = GATE_LABELS;

  gates: Partial<Record<PrivacyGateKey, PrivacyGate>> = {};
  refs: Record<PrivacyGateKey, string> = { NAM_COLLECTION: '', HEALTH_CARD_CAPTURE: '' };
  errors: Partial<Record<PrivacyGateKey, string>> = {};
  loaded = false;
  loadError: string | null = null;
  busy: PrivacyGateKey | null = null;

  constructor(private service: PrivacyGateService, private i18n: I18nService, private apiErrors: ApiErrorsService) {}

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loadError = null;
    this.service.list().subscribe({
      next: list => {
        for (const g of list) {
          this.gates[g.gate] = g;
        }
        this.loaded = true;
      },
      error: err => (this.loadError = this.apiErrors.text(err, 'settings.gates.loadError'))
    });
  }

  enabled(k: PrivacyGateKey): boolean {
    return !!this.gates[k]?.enabled;
  }

  canEnable(k: PrivacyGateKey): boolean {
    return this.busy === null && this.refs[k].trim().length > 0;
  }

  decidedBy(k: PrivacyGateKey): string | null {
    const g = this.gates[k];
    if (!g || !g.decidedAt) {
      return null;
    }
    return this.i18n.t('settings.gates.decidedBy', { name: g.decidedByName ?? '—', date: fmtDate(g.decidedAt, 'isoDateTime', this.i18n.lang) });
  }

  enable(k: PrivacyGateKey): void {
    if (!this.canEnable(k)) {
      return;
    }
    this.save(k, { enabled: true, decisionRef: this.refs[k].trim() });
  }

  disable(k: PrivacyGateKey): void {
    if (this.busy !== null) {
      return;
    }
    this.save(k, { enabled: false, decisionRef: null });
  }

  private save(k: PrivacyGateKey, body: { enabled: boolean; decisionRef: string | null }): void {
    this.busy = k;
    delete this.errors[k];
    this.service.set(k, body).subscribe({
      next: g => {
        this.busy = null;
        this.gates[k] = g;
        this.refs[k] = '';
      },
      error: err => {
        this.busy = null;
        const field = this.apiErrors.fieldTexts(err)['decisionRef'];
        this.errors[k] = field ?? this.apiErrors.text(err, 'settings.gates.saveError');
      }
    });
  }
}
