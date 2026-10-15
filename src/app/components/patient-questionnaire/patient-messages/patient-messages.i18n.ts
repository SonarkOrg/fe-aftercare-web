import { PatientLang } from '../patient-questionnaire.i18n';

export interface PatientMessagesText {
  tabQuestionnaire: string; tabMessages: string; intro: string; clinicPhone: string; careTeam: string; you: string; seen: string;
  label: string; send: string; sending: string; empty: string; earlier: string; refresh: string; rateLimited: string;
  invalidBody: string; error: string; counter: string;
}

export const PATIENT_MESSAGES_TEXT: Record<PatientLang, PatientMessagesText> = {
  fr: {
    tabQuestionnaire: 'Questionnaire',
    tabMessages: 'Messages',
    intro: 'Écrivez à votre équipe de soins. Les messages sont lus pendant les heures d\'ouverture de la clinique. Ce service ne convient pas aux urgences.',
    clinicPhone: 'Pour joindre la clinique :',
    careTeam: 'Équipe de soins',
    you: 'Vous',
    seen: 'Lu',
    label: 'Votre message',
    send: 'Envoyer',
    sending: 'Envoi…',
    empty: 'Aucun message pour l\'instant.',
    earlier: 'Messages précédents',
    refresh: 'Actualiser',
    rateLimited: 'Vous avez envoyé plusieurs messages récemment. Réessayez plus tard ou appelez la clinique.',
    invalidBody: 'Le message est vide ou trop long (2000 caractères maximum).',
    error: 'Une erreur est survenue. Veuillez réessayer.',
    counter: '{n} / 2000 caractères'
  },
  en: {
    tabQuestionnaire: 'Questionnaire',
    tabMessages: 'Messages',
    intro: 'Write to your care team. Messages are read during clinic opening hours. This service is not for emergencies.',
    clinicPhone: 'To reach the clinic:',
    careTeam: 'Care team',
    you: 'You',
    seen: 'Seen',
    label: 'Your message',
    send: 'Send',
    sending: 'Sending…',
    empty: 'No messages yet.',
    earlier: 'Earlier messages',
    refresh: 'Refresh',
    rateLimited: 'You have sent several messages recently. Please try again later or call the clinic.',
    invalidBody: 'The message is empty or too long (2,000 characters maximum).',
    error: 'Something went wrong. Please try again.',
    counter: '{n} / 2,000 characters'
  }
};
