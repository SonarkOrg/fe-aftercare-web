import type { Lang } from '../../i18n/i18n.types';

export type PatientLang = Lang;

export interface QuestionnaireText {
  checkinTitle: string;
  intakeTitle: string;
  submit: string;
  submitting: string;
  doneCheckin: string;
  doneIntake: string;
  alreadyCheckin: string;
  alreadyIntake: string;
  invalid: string;
  error: string;
  validationError: string;
  retry: string;
  loading: string;
  emergency: string;
}

export const QUESTIONNAIRE_TEXT: Record<PatientLang, QuestionnaireText> = {
  fr: {
    checkinTitle: 'Suivi quotidien',
    intakeTitle: 'Questionnaire avant votre rendez-vous',
    submit: 'Envoyer',
    submitting: 'Envoi en cours…',
    doneCheckin: 'Merci! Vos réponses ont été transmises à l\'équipe de soins.',
    doneIntake: 'Merci! Vos réponses ont été transmises à la clinique.',
    alreadyCheckin: 'Vous avez déjà répondu aujourd\'hui. Revenez demain.',
    alreadyIntake: 'Vous avez déjà rempli ce questionnaire.',
    invalid: 'Ce lien n\'est pas valide ou a expiré. Communiquez avec votre équipe de soins.',
    error: 'Une erreur est survenue. Veuillez réessayer.',
    validationError: 'Certaines réponses sont invalides. Vérifiez le formulaire.',
    retry: 'Réessayer',
    loading: 'Chargement…',
    emergency: 'En cas d\'urgence, composez le 911. Pour un conseil santé, appelez Info-Santé au 811.'
  },
  en: {
    checkinTitle: 'Daily check-in',
    intakeTitle: 'Questionnaire before your appointment',
    submit: 'Submit',
    submitting: 'Sending…',
    doneCheckin: 'Thank you! Your answers were sent to the care team.',
    doneIntake: 'Thank you! Your answers were sent to the clinic.',
    alreadyCheckin: 'You have already answered today. Please come back tomorrow.',
    alreadyIntake: 'You have already completed this questionnaire.',
    invalid: 'This link is invalid or has expired. Please contact your care team.',
    error: 'Something went wrong. Please try again.',
    validationError: 'Some answers are invalid. Please check the form.',
    retry: 'Try again',
    loading: 'Loading…',
    emergency: 'In an emergency, call 911. For health advice, call Info-Santé at 811.'
  }
};
