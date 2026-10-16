import { Component } from '@angular/core';
import { PageTitleService } from '../../shell/page-title.service';

@Component({
  selector: 'app-home',
  templateUrl: './home.component.html'
})
export class HomeComponent {
  constructor(titles: PageTitleService) {
    titles.set('page.home');
  }
}
