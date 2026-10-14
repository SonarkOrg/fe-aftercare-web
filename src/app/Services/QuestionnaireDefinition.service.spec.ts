import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { environment } from '../../environments/environment';
import { QuestionnaireDefinitionService } from './QuestionnaireDefinition.service';

describe('QuestionnaireDefinitionService', () => {
  let service: QuestionnaireDefinitionService;
  let http: HttpTestingController;
  const api = `${environment.apiUrl}/questionnaires`;

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [HttpClientTestingModule] });
    service = TestBed.inject(QuestionnaireDefinitionService);
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());

  it('list GETs /questionnaires', () => {
    service.list().subscribe();
    expect(http.expectOne(api).request.method).toBe('GET');
  });

  it('get GETs /questionnaires/:id and caches per id', () => {
    const results: any[] = [];
    service.get(1).subscribe(r => results.push(r));
    service.get(1).subscribe(r => results.push(r));
    const req = http.expectOne(`${api}/1`);
    expect(req.request.method).toBe('GET');
    req.flush({ id: 1 });
    service.get(1).subscribe(r => results.push(r));
    http.expectNone(`${api}/1`);
    expect(results.length).toBe(3);

    service.get(2).subscribe();
    http.expectOne(`${api}/2`).flush({ id: 2 });
  });
});
