import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FhirQuestionnaireResponse } from '../fhir.model';
import { FULL_Q, SIMPLE_Q } from '../../testing/fixtures';
import { QuestionnaireFormComponent } from './questionnaire-form.component';

describe('QuestionnaireFormComponent', () => {
  let fixture: ComponentFixture<QuestionnaireFormComponent>;
  let emitted: (FhirQuestionnaireResponse | null)[];
  let el: HTMLElement;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ declarations: [QuestionnaireFormComponent] }).compileComponents();
    fixture = TestBed.createComponent(QuestionnaireFormComponent);
    emitted = [];
    fixture.componentInstance.responseChange.subscribe(v => emitted.push(v));
    el = fixture.nativeElement;
  });

  function setup(inputs: Record<string, unknown>) {
    for (const [k, v] of Object.entries(inputs)) {
      fixture.componentRef.setInput(k, v);
    }
    fixture.detectChanges();
  }

  const item = (id: string) => el.querySelector(`[data-id="${id}"]`) as HTMLElement | null;
  const last = () => emitted[emitted.length - 1];

  function click(btn: Element | null | undefined) {
    (btn as HTMLButtonElement).click();
    fixture.detectChanges();
  }

  function type(input: HTMLInputElement | HTMLTextAreaElement, value: string) {
    input.value = value;
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();
  }

  /** Answers every required, enabled item with valid values. */
  function answerRequired() {
    click(item('PAIN')!.querySelectorAll('.q-btn')[3]);
    click(item('FEVER')!.querySelectorAll('.q-btn')[1]); // No
    click(item('MOBILITY')!.querySelectorAll('.q-btn')[0]);
  }

  describe('edit mode', () => {
    it('renders French by default and English when lang changes', () => {
      setup({ questionnaire: FULL_Q });
      expect(el.textContent).toContain('Avez-vous de la fièvre?');
      expect(el.textContent).toContain('Répondez une fois par jour.');
      expect(el.textContent).toContain('0 = aucune douleur');
      expect(el.textContent).toContain('Non');
      fixture.componentRef.setInput('lang', 'en');
      fixture.detectChanges();
      expect(el.textContent).toContain('Do you have a fever?');
      expect(el.textContent).toContain('0 = no pain');
      expect(el.textContent).toContain('No');
      expect(el.textContent).not.toContain('Avez-vous');
    });

    it('renders a display item as a paragraph', () => {
      setup({ questionnaire: FULL_Q });
      expect(el.querySelector('p.q-display')!.textContent).toContain('Répondez');
    });

    it('renders an integer 0-10 as 11 buttons', () => {
      setup({ questionnaire: FULL_Q });
      const btns = item('PAIN')!.querySelectorAll('.q-btn');
      expect(btns.length).toBe(11);
      expect(btns[0].textContent!.trim()).toBe('0');
      expect(btns[10].textContent!.trim()).toBe('10');
    });

    it('renders boolean yes/no buttons with aria-pressed', () => {
      setup({ questionnaire: FULL_Q });
      const [yes, no] = Array.from(item('FEVER')!.querySelectorAll('.q-btn'));
      expect(yes.textContent!.trim()).toBe('Oui');
      expect(yes.getAttribute('aria-pressed')).toBe('false');
      click(yes);
      expect(yes.getAttribute('aria-pressed')).toBe('true');
      expect(no.getAttribute('aria-pressed')).toBe('false');
    });

    it('renders a decimal as an input with its unit and an optional suffix', () => {
      setup({ questionnaire: FULL_Q });
      const input = el.querySelector('#q-TEMP') as HTMLInputElement;
      expect(input.getAttribute('inputmode')).toBe('decimal');
      expect(item('TEMP')!.querySelector('.q-unit')!.textContent).toBe('°C');
      expect(item('TEMP')!.textContent).toContain('(facultatif)');
      expect(item('PAIN')!.textContent).not.toContain('(facultatif)');
    });

    it('renders a large integer as an input, text as a textarea with maxlength, and choice as buttons', () => {
      setup({ questionnaire: FULL_Q });
      expect(el.querySelector('#q-STEPS')).not.toBeNull();
      expect(item('STEPS')!.querySelectorAll('.q-btn').length).toBe(0);
      const ta = el.querySelector('#q-NOTES') as HTMLTextAreaElement;
      expect(ta.tagName).toBe('TEXTAREA');
      expect(ta.getAttribute('maxlength')).toBe('50');
      const opts = item('MOBILITY')!.querySelectorAll('.q-btn');
      expect(Array.from(opts).map(o => o.textContent!.trim())).toEqual(['Sans aide', 'Alité']);
      fixture.componentRef.setInput('lang', 'en');
      fixture.detectChanges();
      expect(Array.from(item('MOBILITY')!.querySelectorAll('.q-btn')).map(o => o.textContent!.trim())).toEqual(['Unaided', 'Bedbound']);
    });

    it('hides the dependent string item until the source is true, with maxlength, and clears it when changed back', () => {
      setup({ questionnaire: FULL_Q });
      expect(el.querySelector('#q-FEVER_DETAIL')).toBeNull();
      click(item('FEVER')!.querySelectorAll('.q-btn')[0]); // Yes
      const input = el.querySelector('#q-FEVER_DETAIL') as HTMLInputElement;
      expect(input.getAttribute('maxlength')).toBe('20');
      type(input, 'depuis hier');
      click(item('PAIN')!.querySelectorAll('.q-btn')[3]);
      click(item('MOBILITY')!.querySelectorAll('.q-btn')[0]);
      click(item('FEVER')!.querySelectorAll('.q-btn')[0]); // Yes again (selected, required: stays)
      expect(last()!.item.map(i => i.linkId)).toContain('FEVER_DETAIL');

      click(item('FEVER')!.querySelectorAll('.q-btn')[1]); // No
      expect(el.querySelector('#q-FEVER_DETAIL')).toBeNull();
      expect(last()!.item.map(i => i.linkId)).not.toContain('FEVER_DETAIL');

      click(item('FEVER')!.querySelectorAll('.q-btn')[0]); // Yes: re-enabled, empty
      expect((el.querySelector('#q-FEVER_DETAIL') as HTMLInputElement).value).toBe('');
      expect(last()).toBeNull(); // required and now empty
    });

    it('emits null until required items are answered, then a valid response', () => {
      setup({ questionnaire: FULL_Q });
      expect(last() ?? null).toBeNull();
      click(item('PAIN')!.querySelectorAll('.q-btn')[3]);
      expect(last()).toBeNull();
      click(item('FEVER')!.querySelectorAll('.q-btn')[1]);
      expect(last()).toBeNull();
      click(item('MOBILITY')!.querySelectorAll('.q-btn')[1]);
      const r = last()!;
      expect(r.questionnaire).toBe('https://aftercare.example/fhir/Questionnaire/test|1');
      expect(r.item).toEqual([
        { linkId: 'PAIN', answer: [{ valueInteger: 3 }] },
        { linkId: 'FEVER', answer: [{ valueBoolean: false }] },
        { linkId: 'MOBILITY', answer: [{ valueCoding: { system: 'http://x/mobility', code: 'bedbound' } }] }
      ]);
    });

    it('accepts a decimal comma ("38,2" -> 38.2)', () => {
      setup({ questionnaire: FULL_Q });
      answerRequired();
      type(el.querySelector('#q-TEMP') as HTMLInputElement, '38,2');
      expect(last()!.item.find(i => i.linkId === 'TEMP')!.answer).toEqual([{ valueDecimal: 38.2 }]);
      expect(item('TEMP')!.querySelector('.q-error')).toBeNull();
    });

    it('shows the invalid message for too many decimals and emits null', () => {
      setup({ questionnaire: FULL_Q });
      answerRequired();
      type(el.querySelector('#q-TEMP') as HTMLInputElement, '38,25');
      expect(item('TEMP')!.querySelector('.q-error')!.textContent).toBe('Valeur invalide');
      expect(last()).toBeNull();
      fixture.componentRef.setInput('lang', 'en');
      type(el.querySelector('#q-TEMP') as HTMLInputElement, '38,25');
      expect(item('TEMP')!.querySelector('.q-error')!.textContent).toBe('Invalid value');
    });

    it('rejects text over maxLength with the tooLong message', () => {
      setup({ questionnaire: FULL_Q });
      answerRequired();
      type(el.querySelector('#q-NOTES') as HTMLTextAreaElement, 'x'.repeat(51));
      expect(item('NOTES')!.querySelector('.q-error')!.textContent).toBe('Texte trop long');
      expect(last()).toBeNull();
    });

    it('drops an optional number answer from the response when its input is emptied', () => {
      setup({ questionnaire: FULL_Q });
      answerRequired();
      type(el.querySelector('#q-STEPS') as HTMLInputElement, '1200');
      expect(last()!.item.map(i => i.linkId)).toContain('STEPS');
      type(el.querySelector('#q-STEPS') as HTMLInputElement, '');
      expect(last()!.item.map(i => i.linkId)).not.toContain('STEPS');
    });

    it('works for a minimal questionnaire', () => {
      setup({ questionnaire: SIMPLE_Q });
      click(item('FEVER')!.querySelectorAll('.q-btn')[0]);
      expect(last()!.questionnaire).toBe('https://aftercare.example/fhir/Questionnaire/simple|2');
    });
  });

  describe('readonly mode', () => {
    const response: FhirQuestionnaireResponse = {
      resourceType: 'QuestionnaireResponse', questionnaire: 'x|1', status: 'completed',
      item: [
        { linkId: 'PAIN', answer: [{ valueInteger: 4 }] },
        { linkId: 'TEMP', answer: [{ valueDecimal: 38.2 }] },
        { linkId: 'FEVER', answer: [{ valueBoolean: false }] },
        { linkId: 'MOBILITY', answer: [{ valueCoding: { system: 'http://x/mobility', code: 'bedbound', display: 'Alité' } }] }
      ]
    };

    it('renders a dl with localized answers, units and a dash for unanswered items, with no inputs', () => {
      setup({ questionnaire: FULL_Q, mode: 'readonly', response, lang: 'en' });
      expect(el.querySelector('dl')).not.toBeNull();
      expect(el.querySelector('input, textarea, button')).toBeNull();
      const dts = Array.from(el.querySelectorAll('dt')).map(d => d.textContent!.trim());
      const dds = Array.from(el.querySelectorAll('dd')).map(d => d.textContent!.trim());
      // FEVER_DETAIL is disabled (FEVER=false) and INTRO is display, so neither appears
      expect(dts).toEqual(['Pain level?', 'Temperature?', 'Number of steps?', 'Do you have a fever?', 'Notes?', 'Mobility?']);
      expect(dds).toEqual(['4', '38.2 °C', '—', 'No', '—', 'Bedbound']);
    });

    it('renders French labels and Oui/Non', () => {
      setup({ questionnaire: FULL_Q, mode: 'readonly', response, lang: 'fr' });
      const dds = Array.from(el.querySelectorAll('dd')).map(d => d.textContent!.trim());
      expect(dds[3]).toBe('Non');
      expect(dds[5]).toBe('Alité');
    });

    it('shows a dependent item when its source enables it, and emits nothing', () => {
      const withDetail: FhirQuestionnaireResponse = {
        ...response,
        item: [
          { linkId: 'FEVER', answer: [{ valueBoolean: true }] },
          { linkId: 'FEVER_DETAIL', answer: [{ valueString: 'depuis hier' }] }
        ]
      };
      setup({ questionnaire: FULL_Q, mode: 'readonly', response: withDetail, lang: 'en' });
      expect(Array.from(el.querySelectorAll('dd')).map(d => d.textContent!.trim())).toContain('depuis hier');
      expect(emitted.length).toBe(0);
    });
  });
});
