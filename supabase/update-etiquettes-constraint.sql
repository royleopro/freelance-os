-- Supprime l'ancien check constraint sur etiquette
ALTER TABLE sessions_heures DROP CONSTRAINT sessions_heures_etiquette_check;

-- Nouveau check constraint avec les etiquettes en texte lisible
ALTER TABLE sessions_heures ADD CONSTRAINT sessions_heures_etiquette_check CHECK (etiquette IN (
  'projet',
  'prospection',
  'wireframe',
  'communication',
  'design ui',
  'réunion',
  'analyse',
  'organisation',
  'administration',
  'brainstorming',
  'formation',
  'tests utilisateurs',
  'design system',
  'prototypage',
  'mail/discussion',
  'study case',
  'facturation',
  'graphisme',
  'outillage',
  'design thinking',
  'maintenance',
  'benchmark',
  'veille',
  'retouches UI/UX',
  'code',
  'autre'
));
