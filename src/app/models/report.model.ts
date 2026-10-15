export interface ReportWeek {
  weekStart: string; from: string; to: string;
  checkInsExpected: number; checkInsReceived: number; alertsHigh: number; alertsMedium: number;
}

export interface ReportSummary {
  from: string; to: string; generatedAt: string;
  checkIns: { expected: number; received: number; completionRate: number | null; throughDate: string };
  followUps: { activeNow: number; started: number; closed: number };
  alerts: {
    total: number; high: number; medium: number;
    responded: number; meanMinutesToAcknowledge: number | null;
    resolved: number; meanMinutesToResolve: number | null; unresolved: number;
  };
  appointments: {
    total: number; completed: number; cancelled: number; noShow: number;
    questionnairesExpected: number; questionnairesCompleted: number; questionnaireCompletionRate: number | null;
    intakesWithFlags: number; needsReviewRate: number | null;
    cancellationRate: number | null; noShowRate: number | null;
  };
  weeks: ReportWeek[];
}
