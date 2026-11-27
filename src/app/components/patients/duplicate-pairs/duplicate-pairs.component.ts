import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { RouterModule } from '@angular/router';
import { PatientDeskService } from '../../../Services/PatientDesk.service';
import { fmtDate } from '../../../i18n/format';
import { I18nModule } from '../../../i18n/i18n.module';
import { I18nService } from '../../../i18n/i18n.service';
import { DuplicateFlag } from '../../../models/arrival.model';

/**
 * The "Flagged duplicates" view of the Patients page: the OPEN pairs of GET /patients/duplicate-flags, with an « Open »
 * link on each file. Standalone and loaded on demand (the Patients page is part of the initial bundle).
 */
@Component({
  selector: 'app-duplicate-pairs',
  standalone: true,
  imports: [CommonModule, RouterModule, I18nModule],
  templateUrl: './duplicate-pairs.component.html'
})
export class DuplicatePairsComponent implements OnInit {
  flags: DuplicateFlag[] = [];
  loading = true;
  failed = false;

  constructor(private desk: PatientDeskService, private i18n: I18nService) {}

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading = true;
    this.failed = false;
    this.desk.duplicateFlags().subscribe({
      next: flags => {
        this.flags = flags;
        this.loading = false;
      },
      error: error => {
        this.loading = false;
        this.failed = true;
        console.error('Fetch duplicate flags error', error?.status);
      }
    });
  }

  nameOf(p: { firstName: string; lastName: string }): string {
    return `${p.firstName} ${p.lastName}`;
  }

  bornText(dob: string | null): string {
    return dob ? this.i18n.t('patients.duplicate.born', { date: fmtDate(dob, 'date', this.i18n.lang) }) : this.i18n.t('patients.duplicate.noDob');
  }

  flaggedText(f: DuplicateFlag): string {
    const date = fmtDate(f.flaggedAt, 'date', this.i18n.lang);
    return f.flaggedByName ? this.i18n.t('patients.duplicates.flaggedBy', { date, name: f.flaggedByName }) : this.i18n.t('patients.duplicates.flagged', { date });
  }
}
