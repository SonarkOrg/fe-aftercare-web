import { Component, Input } from '@angular/core';

export type IconName = 'dashboard' | 'users' | 'calendar' | 'bell' | 'file' | 'search' | 'logout' | 'menu' | 'close'
  | 'chevron-left' | 'chevron-right' | 'plus' | 'phone' | 'copy' | 'check' | 'link' | 'thermometer' | 'activity'
  | 'building' | 'grid-dots' | 'chevron-down' | 'clock' | 'alert-triangle' | 'slash-circle' | 'more-horizontal' | 'heart-pulse'
  | 'check-circle' | 'clipboard' | 'x-circle' | 'arrow-up' | 'arrow-down' | 'trash'
  | 'settings' | 'message' | 'send' | 'upload' | 'download' | 'eye' | 'eye-off' | 'edit' | 'shield' | 'lock' | 'pill' | 'bar-chart';

@Component({
  selector: 'app-icon',
  template: `<svg aria-hidden="true" focusable="false" viewBox="0 0 24 24" stroke="currentColor" fill="none"
    stroke-linecap="round" stroke-linejoin="round" [attr.width]="size" [attr.height]="size" [attr.stroke-width]="stroke" [ngSwitch]="name">
    <ng-container *ngSwitchCase="'dashboard'"><rect x="3" y="3" width="7" height="9" rx="1"/><rect x="14" y="3" width="7" height="5" rx="1"/><rect x="14" y="12" width="7" height="9" rx="1"/><rect x="3" y="16" width="7" height="5" rx="1"/></ng-container>
    <ng-container *ngSwitchCase="'users'"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></ng-container>
    <ng-container *ngSwitchCase="'calendar'"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></ng-container>
    <ng-container *ngSwitchCase="'bell'"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/></ng-container>
    <ng-container *ngSwitchCase="'file'"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M16 13H8M16 17H8M10 9H8"/></ng-container>
    <ng-container *ngSwitchCase="'search'"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></ng-container>
    <ng-container *ngSwitchCase="'logout'"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="m16 17 5-5-5-5M21 12H9"/></ng-container>
    <ng-container *ngSwitchCase="'menu'"><path d="M3 6h18M3 12h18M3 18h18"/></ng-container>
    <ng-container *ngSwitchCase="'close'"><path d="M18 6 6 18M6 6l12 12"/></ng-container>
    <ng-container *ngSwitchCase="'chevron-left'"><path d="m15 18-6-6 6-6"/></ng-container>
    <ng-container *ngSwitchCase="'chevron-right'"><path d="m9 18 6-6-6-6"/></ng-container>
    <ng-container *ngSwitchCase="'plus'"><path d="M12 5v14M5 12h14"/></ng-container>
    <ng-container *ngSwitchCase="'phone'"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.8 19.8 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.8 19.8 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z"/></ng-container>
    <ng-container *ngSwitchCase="'copy'"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></ng-container>
    <ng-container *ngSwitchCase="'check'"><path d="M20 6 9 17l-5-5"/></ng-container>
    <ng-container *ngSwitchCase="'link'"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></ng-container>
    <ng-container *ngSwitchCase="'thermometer'"><path d="M14 4v10.54a4 4 0 1 1-4 0V4a2 2 0 0 1 4 0z"/></ng-container>
    <ng-container *ngSwitchCase="'activity'"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></ng-container>
    <ng-container *ngSwitchCase="'building'"><rect x="4" y="3" width="16" height="18" rx="2"/><path d="M9 21v-4h6v4M12 7v4M10 9h4"/></ng-container>
    <ng-container *ngSwitchCase="'grid-dots'"><g fill="currentColor" stroke="none"><circle cx="5" cy="5" r="1.7"/><circle cx="12" cy="5" r="1.7"/><circle cx="19" cy="5" r="1.7"/><circle cx="5" cy="12" r="1.7"/><circle cx="12" cy="12" r="1.7"/><circle cx="19" cy="12" r="1.7"/><circle cx="5" cy="19" r="1.7"/><circle cx="12" cy="19" r="1.7"/><circle cx="19" cy="19" r="1.7"/></g></ng-container>
    <ng-container *ngSwitchCase="'chevron-down'"><path d="m6 9 6 6 6-6"/></ng-container>
    <ng-container *ngSwitchCase="'clock'"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></ng-container>
    <ng-container *ngSwitchCase="'alert-triangle'"><path d="M12 3 2 20h20L12 3z"/><path d="M12 10v4M12 17h.01"/></ng-container>
    <ng-container *ngSwitchCase="'slash-circle'"><circle cx="12" cy="12" r="9"/><path d="m5.6 5.6 12.8 12.8"/></ng-container>
    <ng-container *ngSwitchCase="'more-horizontal'"><g fill="currentColor" stroke="none"><circle cx="5" cy="12" r="1.8"/><circle cx="12" cy="12" r="1.8"/><circle cx="19" cy="12" r="1.8"/></g></ng-container>
    <ng-container *ngSwitchCase="'heart-pulse'"><path d="M19 14c1.5-1.5 3-3.2 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.8 0-3 .5-4.5 2-1.5-1.5-2.7-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4 3 5.5l7 7z"/><path d="M3.2 12H8l2-3 3 6 2-3h5.8"/></ng-container>
    <ng-container *ngSwitchCase="'check-circle'"><circle cx="12" cy="12" r="9"/><path d="m8 12.5 3 3 5-6"/></ng-container>
    <ng-container *ngSwitchCase="'clipboard'"><rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 4.5A1.5 1.5 0 0 1 10.5 3h3A1.5 1.5 0 0 1 15 4.5V6H9zM9 12h6M9 16h4"/></ng-container>
    <ng-container *ngSwitchCase="'x-circle'"><circle cx="12" cy="12" r="9"/><path d="m9 9 6 6M15 9l-6 6"/></ng-container>
    <ng-container *ngSwitchCase="'trash'"><path d="M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6M10 11v6M14 11v6"/></ng-container>
    <ng-container *ngSwitchCase="'arrow-up'"><path d="M12 19V5M5 12l7-7 7 7"/></ng-container>
    <ng-container *ngSwitchCase="'arrow-down'"><path d="M12 5v14M19 12l-7 7-7-7"/></ng-container>
    <ng-container *ngSwitchCase="'settings'"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></ng-container>
    <ng-container *ngSwitchCase="'message'"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></ng-container>
    <ng-container *ngSwitchCase="'send'"><path d="M22 2 11 13M22 2l-7 20-4-9-9-4z"/></ng-container>
    <ng-container *ngSwitchCase="'upload'"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12"/></ng-container>
    <ng-container *ngSwitchCase="'download'"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/></ng-container>
    <ng-container *ngSwitchCase="'eye'"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8S1 12 1 12z"/><circle cx="12" cy="12" r="3"/></ng-container>
    <ng-container *ngSwitchCase="'eye-off'"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24M1 1l22 22"/></ng-container>
    <ng-container *ngSwitchCase="'edit'"><path d="M12 20h9M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4z"/></ng-container>
    <ng-container *ngSwitchCase="'shield'"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="m9 12 2 2 4-4"/></ng-container>
    <ng-container *ngSwitchCase="'lock'"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></ng-container>
    <ng-container *ngSwitchCase="'pill'"><path d="m10.5 20.5 10-10a4.95 4.95 0 1 0-7-7l-10 10a4.95 4.95 0 1 0 7 7z"/><path d="m8.5 8.5 7 7"/></ng-container>
    <ng-container *ngSwitchCase="'bar-chart'"><path d="M4 21V10M10 21V4M16 21v-8M22 21H2"/></ng-container>
  </svg>`
})
export class IconComponent {
  @Input() name: IconName = 'dashboard';
  @Input() size = 20;
  @Input() stroke = 1.8;
}
