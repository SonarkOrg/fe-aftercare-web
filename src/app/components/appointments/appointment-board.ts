import { fmtDate } from '../../i18n/format';
import { AnyLang, TKey } from '../../i18n/i18n.types';
import { Appointment } from '../../models/appointment.model';
import { addDays, businessToday } from '../../shared/link.util';

/** Explicit estimate shown (and labelled as such) in the appointments KPI helper line. */
export const MINUTES_SAVED_PER_INTAKE = 5;
/** 96px per hour: a 30-minute slot is 48px, enough for two text lines. */
export const HOUR_PX = 96;
export const MIN_BLOCK_PX = 44;

export type BoardKey = 'review' | 'missing' | 'awaiting' | 'ready' | 'closed';

export interface BoardGroup {
  key: BoardKey;
  title: TKey;
  items: Appointment[];
  collapsed: boolean;
}

const byTime = (a: Appointment, b: Appointment) => a.scheduledAt.localeCompare(b.scheduledAt) || a.id - b.id;

/** Fixed order; empty groups are omitted. Within a group: scheduledAt, then id. */
export function groupForBoard(appts: Appointment[]): BoardGroup[] {
  const defs: { key: BoardKey; title: TKey; collapsed: boolean; test: (a: Appointment) => boolean }[] = [
    { key: 'review', title: 'enum.appointmentStatus.NEEDS_REVIEW', collapsed: false, test: a => a.status === 'NEEDS_REVIEW' },
    { key: 'missing', title: 'chip.appt.questionnaireMissing', collapsed: false, test: a => a.status === 'SCHEDULED' && a.questionnaireMissing },
    { key: 'awaiting', title: 'appts.group.awaiting', collapsed: false, test: a => a.status === 'SCHEDULED' && !a.questionnaireMissing },
    { key: 'ready', title: 'enum.appointmentStatus.READY', collapsed: false, test: a => a.status === 'READY' },
    { key: 'closed', title: 'appts.group.closed', collapsed: true, test: a => ['COMPLETED', 'CANCELLED', 'NO_SHOW'].includes(a.status) }
  ];
  return defs
    .map(d => ({ key: d.key, title: d.title, collapsed: d.collapsed, items: appts.filter(d.test).sort(byTime) }))
    .filter(g => g.items.length > 0);
}

const pad = (n: number) => (n < 10 ? '0' + n : String(n));

export function startMinutes(scheduledAt: string): number {
  return Number(scheduledAt.substring(11, 13)) * 60 + Number(scheduledAt.substring(14, 16));
}

/** "HH:mm" of start + duration, wrapping past midnight. Computed from the strings, never via Date parsing. */
export function endTime(scheduledAt: string, durationMinutes: number): string {
  const end = (startMinutes(scheduledAt) + durationMinutes) % 1440;
  return `${pad(Math.floor(end / 60))}:${pad(end % 60)}`;
}

export interface Block {
  appt: Appointment;
  top: number;
  height: number;
  lane: number;
  lanes: number;
  leftPct: number;
  widthPct: number;
}

export interface WeekDay { date: string; label: string; isToday: boolean; blocks: Block[] }

export interface Week { days: WeekDay[]; startHour: number; endHour: number; hourPx: number }

export function layoutWeek(appts: Appointment[], monday: string, opts: { today?: string; hourPx?: number; lang?: AnyLang } = {}): Week {
  const hourPx = opts.hourPx ?? HOUR_PX;
  // A block is never drawn shorter than MIN_BLOCK_PX, so lanes are computed on that visual extent in minutes.
  const minBlockMinutes = (MIN_BLOCK_PX / hourPx) * 60;
  const today = opts.today ?? businessToday();
  const starts = appts.map(a => startMinutes(a.scheduledAt));
  const ends = appts.map(a => startMinutes(a.scheduledAt) + Math.max(a.durationMinutes, (MIN_BLOCK_PX / hourPx) * 60));
  const startHour = Math.max(0, Math.min(7, ...starts.map(m => Math.floor(m / 60))));
  const endHour = Math.min(24, Math.max(19, ...ends.map(m => Math.ceil(m / 60))));

  const days: WeekDay[] = [];
  for (let i = 0; i < 7; i++) {
    const date = addDays(monday, i);
    const items = appts.filter(a => a.scheduledAt.substring(0, 10) === date).sort(byTime);
    const placed = items.map(appt => {
      const s = startMinutes(appt.scheduledAt);
      return {
        appt, s, e: s + Math.max(appt.durationMinutes, minBlockMinutes), lane: 0, lanes: 1,
        top: ((s - startHour * 60) / 60) * hourPx,
        height: Math.max((appt.durationMinutes / 60) * hourPx, MIN_BLOCK_PX)
      };
    });
    // greedy lane assignment, then lane counts per cluster of transitively overlapping blocks
    const laneEnds: number[] = [];
    for (const b of placed) {
      let lane = laneEnds.findIndex(end => end <= b.s);
      if (lane < 0) {
        lane = laneEnds.length;
        laneEnds.push(0);
      }
      laneEnds[lane] = b.e;
      b.lane = lane;
    }
    let cluster: typeof placed = [];
    let clusterEnd = -1;
    const closeCluster = () => {
      const lanes = cluster.reduce((m, b) => Math.max(m, b.lane + 1), 1);
      cluster.forEach(b => (b.lanes = lanes));
      cluster = [];
    };
    for (const b of placed) {
      if (cluster.length && b.s >= clusterEnd) {
        closeCluster();
        clusterEnd = -1;
      }
      cluster.push(b);
      clusterEnd = Math.max(clusterEnd, b.e);
    }
    closeCluster();
    days.push({
      date, label: fmtDate(date, 'weekdayDay', opts.lang ?? 'en'), isToday: date === today,
      blocks: placed.map(b => ({
        appt: b.appt, top: b.top, height: b.height, lane: b.lane, lanes: b.lanes,
        leftPct: (b.lane / b.lanes) * 100, widthPct: 100 / b.lanes
      }))
    });
  }
  return { days, startHour, endHour, hourPx };
}
