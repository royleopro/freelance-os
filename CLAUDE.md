@AGENTS.md
# Freelance OS — CLAUDE.md

## Stack
Next.js 14 App Router, Supabase, Tailwind, shadcn/ui

## Structure
- /app/dashboard
- /app/projets
- /app/heures
- /app/parametres
- /components → composants réutilisables
- /lib/supabase.ts → client Supabase

## Base de données
- clients, projets, sessions_heures, transactions_ca, objectifs, parametres

## Conventions
- Style sombre (dark mode uniquement)
- Composants shadcn/ui pour les formulaires, modals, tableaux
- Calculs : rentabilité = montant_payé / heures_facturables
- Taux URSSAF : 25.6%, taux impôts : 2%