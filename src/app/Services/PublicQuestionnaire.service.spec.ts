import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { environment } from '../../environments/environment';
import { PublicQuestionnaireService } from './PublicQuestionnaire.service';

describe('PublicQuestionnaireService', () => {
  let service: PublicQuestionnaireService;
  let http: HttpTestingController;
  const api = `${environment.apiUrl}/public/q`;

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [HttpClientTestingModule] });
    service = TestBed.inject(PublicQuestionnaireService);
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());

  it('get GETs /public/q/:code, encoding the code', () => {
    service.get('ab_-c').subscribe();
    expect(http.expectOne(`${api}/ab_-c`).request.method).toBe('GET');
    service.get('a/b?c').subscribe();
    http.expectOne(`${api}/a%2Fb%3Fc`).flush({});
  });

  it('submit POSTs the response to /public/q/:code', () => {
    const body = { resourceType: 'QuestionnaireResponse' as const, questionnaire: 'u|1', status: 'completed' as const, item: [] };
    service.submit('abc', body).subscribe();
    const req = http.expectOne(`${api}/abc`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(body);
    expect(req.request.headers.has('Authorization')).toBeFalse();
  });
});
