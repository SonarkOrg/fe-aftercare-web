import { Injectable } from '@angular/core';
import { Observable, catchError, forkJoin, map, of, switchMap } from 'rxjs';
import { RuleJson } from '../models/questionnaire-definition.model';
import { CareSnapshot } from '../shared/care.model';
import { addDays, businessNow, businessToday } from '../shared/link.util';
import { buildRows } from '../shared/patient-status';
import { AlertService } from './Alert.service';
import { AppointmentService } from './Appointment.service';
import { CheckInFeedService } from './CheckInFeed.service';
import { PatientService } from './Patient.service';
import { QuestionnaireDefinitionService } from './QuestionnaireDefinition.service';

/**
 * One snapshot shared by the Dashboard and Patients pages.
 * Limits: "last check-in" only looks back 31 days (older shows "—", which only affects INACTIVE patients because
 * follow-ups last at most 30 days) and "next appointment" only looks ahead 31 days.
 */
@Injectable({ providedIn: 'root' })
export class CareDataService {
  constructor(
    private patients: PatientService,
    private alerts: AlertService,
    private checkIns: CheckInFeedService,
    private appointments: AppointmentService,
    private definitions: QuestionnaireDefinitionService
  ) {}

  load(): Observable<CareSnapshot> {
    const today = businessToday();
    return forkJoin({
      patients: this.patients.getPatientList(),
      alerts: this.alerts.list(),
      checkIns: this.checkIns.range(addDays(today, -30), today),
      appointments: this.appointments.list(today, addDays(today, 30))
    }).pipe(
      switchMap(feeds => {
        const ids = Array.from(new Set(
          feeds.patients.map(p => p.activeFollowUp?.questionnaireDefinitionId).filter((id): id is number => id !== undefined)));
        // A definition that fails to load only costs that follow-up its thresholds; it never fails the snapshot.
        const defs$ = ids.length
          ? forkJoin(ids.map(id => this.definitions.get(id).pipe(catchError(() => of(null)))))
          : of([]);
        return defs$.pipe(map(defs => {
          const rules = new Map<number, RuleJson[]>();
          defs.forEach(d => d && rules.set(d.id, d.rules));
          return {
            today,
            rows: buildRows({ ...feeds, rules, today, nowLocal: businessNow() }),
            alerts: feeds.alerts,
            checkIns: feeds.checkIns,
            appointments: feeds.appointments
          };
        }));
      })
    );
  }
}
