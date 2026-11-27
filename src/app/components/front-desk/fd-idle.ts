/** Time without a key, pointer or wheel event after which the Arrivals list is masked (spec 7.6). */
export const FD_IDLE_MS = 5 * 60 * 1000;

/** A resettable one-shot timer: `touch()` restarts it, `onIdle` fires once after `ms` without a touch. */
export class IdleTimer {
  private handle: ReturnType<typeof setTimeout> | null = null;

  constructor(private readonly onIdle: () => void, private readonly ms: number = FD_IDLE_MS) {}

  touch(): void {
    this.stop();
    this.handle = setTimeout(() => {
      this.handle = null;
      this.onIdle();
    }, this.ms);
  }

  stop(): void {
    if (this.handle !== null) {
      clearTimeout(this.handle);
      this.handle = null;
    }
  }
}
