## Brief pour l'agent kit

Ce brief se donne au Planner avec ce document. Il impose le mode collaboration : spécifier, planifier, implémenter par petites tâches, rendre un rapport. Pas de génération massive de code sans inspection.

```markdown
# Mission : App de suivi financier personnel — Phase 1

Source de vérité : docs/spec.md (règles R1 à R13, modèle de données).
Portée : Phase 1 uniquement. Tout ce qui n'y est pas est hors périmètre.

## Planner

1. Lis la spec en entier. Liste les ambiguïtés sous forme de questions oui/non. Arrête-toi et attends les réponses.
2. Propose le découpage en tâches (backend/API séparé du frontend), chacune livrable et testable seule.
3. Pour chaque tâche : fichiers touchés, règles R concernées, tests attendus.

## Implementer

- Une tâche à la fois. Explore le code existant avant d'écrire.
- Les règles métier vivent dans un module de domaine pur (sans UI ni base), testé unitairement.
- Interface en français. Montants en entiers XAF.
- Fin de tâche : rapport court (fait, testé, décisions prises, points ouverts).

## Reviewer

- Vérifie chaque tâche contre les règles R citées, pas seulement que ça compile.
- Points bloquants : totaux hors classe (R2), transferts qui modifient les dépenses, mois clôturé modifiable, suppression physique.

## QA

- Jeu de test = import du fichier v9.3.
- Attendus octobre 2026 après import : revenus gagnés 1 023 000 ; remboursement 150 000 ; prêt 150 000 soldé ; achat projet 280 315 hors enveloppes.
- Scénario de pointage : un écart de 3 000 sur espèces crée un ajustement à la demande.
- Rapport final : couverture des règles de la phase, écarts avec la spec.
```

## Questions ouvertes

- [x] Stack : React + Node, confirmée.
- [x] Sources des enveloppes : Abonnements = carte, Voiture / entretien = courant, autres = pot (R4).
- [x] Jour de bascule du mois budgétaire : le 25, confirmé (R3).
- [x] Tolérance espèces : 5 000 par semaine, retenue (R12).
- [x] Lignes 30 et 32 (pizza, goûter) : payées avec les fonds Prestix, Usage Personnel (R9).
- [x] Achats PC : transferts épargne → carte confirmés, à reprendre à l'import.
- [x] PC Tower : pas de plafond, limite = solde BGFI épargne (R7).
- [x] Rappels : notifications push PWA.
