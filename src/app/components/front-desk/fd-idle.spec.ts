import { fakeAsync, tick } from '@angular/core/testing';
import { FD_IDLE_MS, IdleTimer } from './fd-idle';

describe('IdleTimer', () => {
  it('the idle time is five minutes', () => {
    expect(FD_IDLE_MS).toBe(300_000);
  });

  it('fires once after the idle time', fakeAsync(() => {
    let n = 0;
    const t = new IdleTimer(() => n++);
    t.touch();
    tick(FD_IDLE_MS - 1);
    expect(n).toBe(0);
    tick(1);
    expect(n).toBe(1);
    tick(FD_IDLE_MS * 3);
    expect(n).toBe(1);
  }));

  it('touch restarts the countdown', fakeAsync(() => {
    let n = 0;
    const t = new IdleTimer(() => n++, 1000);
    t.touch();
    tick(900);
    t.touch();
    tick(900);
    expect(n).toBe(0);
    tick(100);
    expect(n).toBe(1);
  }));

  it('stop cancels it', fakeAsync(() => {
    let n = 0;
    const t = new IdleTimer(() => n++, 1000);
    t.touch();
    t.stop();
    tick(5000);
    expect(n).toBe(0);
  }));
});
