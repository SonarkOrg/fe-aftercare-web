import { Component, Input } from '@angular/core';

/** Deterministic decorative tint (1-4) from an id or any string. */
export function avatarTone(key: number | string | null | undefined): number {
  const s = String(key ?? '');
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (h * 31 + s.charCodeAt(i)) >>> 0;
  }
  return (h % 4) + 1;
}

@Component({
  selector: 'app-avatar',
  template: `<span class="av av--{{ tone }}" [class.av--md]="size === 'md'" [class.av--lg]="size === 'lg'" [class.av--xl]="size === 'xl'" aria-hidden="true">{{ initials }}</span>`
})
export class AvatarComponent {
  @Input() id: number | string | null | undefined;
  @Input() initials = '';
  @Input() size: 'sm' | 'md' | 'lg' | 'xl' = 'sm';

  get tone(): number {
    return avatarTone(this.id ?? this.initials);
  }
}
