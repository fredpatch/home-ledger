# Spécification — App de suivi financier personnel

Oct 7, 2026 · @Patchelli

## Contexte et objectifs

L'app remplace le classeur Excel v9.3 par une web app personnelle, mono-utilisateur, hébergée sur le homelab et accessible partout via Tailscale. Elle devient la seule source de vérité : plus de fichier Excel à maintenir.

Pourquoi quitter Excel :

- Saisie lente et sujette aux erreurs sur mobile (catégorie de revenu sur une dépense, mauvaise date, mauvaise catégorie).
- Plages figées `$5:$504` : le classeur sera plein en environ un an.
- Règles métier codées en soustractions `SUMIFS` dupliquées sur 3 feuilles.
- Listes de référence en double, mois suivi saisi à 3 endroits, budget non historisé.

Objectifs :

1. Suivre chaque dépense au quotidien, y compris les récurrentes (abonnements, factures).
2. Mesurer l'épargne réelle (placée et non placée) contre la cible de 30 % du salaire.
3. Suivre les projets financés par l'épargne sur plusieurs mois.
4. **Précision cible : moins de 20 000 XAF d'écart inexpliqué par mois et par compte**, grâce au pointage hebdomadaire plutôt qu'à une saisie parfaite.

Langue de l'interface : français. Devise : XAF, montants entiers sans décimales.

## Flux financier et règles métier

Le salaire arrive sur BGFI courant ; de là, environ 30 % part en épargne et 400 000 XAF vers BGFI mobile, dont environ 200 000 sont retirés en espèces. Le diagramme ci-dessous résume le flux ; les flèches en pointillé sont occasionnelles.

&#91;embedded content: flux mensuel · 6 comptes et poches\]

Les projets sont payés depuis l'épargne ; le reste de courant sert de réserve et finance les renforts.

### R1 — Comptes

| Compte         | Rôle                                                                    | Pointage               |
| -------------- | ----------------------------------------------------------------------- | ---------------------- |
| BGFI courant   | Reçoit le salaire, réserve « à oublier », renforts, Voiture / entretien | Hebdo, écart 0         |
| BGFI mobile    | Pot du mois (≈ 400 000)                                                 | Hebdo, écart 0         |
| Espèces        | Retrait ≈ 200 000 depuis mobile                                         | Hebdo, tolérance 5 000 |
| BGFI épargne   | Épargne active, seule source des projets                                | Mensuel                |
| UGB épargne    | Épargne bloquée, ne bouge pas, jamais utilisée pour un projet           | Mensuel                |
| Carte prépayée | Abonnements (prélèvement direct), achats en ligne                       | Hebdo                  |

Airtel Money n'est pas un compte : une recharge = une dépense payée en espèces, dans sa catégorie (ex. Internet mobile).

### R2 — Classes d'opération

Chaque catégorie porte une classe ; la classe décide de tous les totaux. Plus aucune soustraction ad hoc.

| Classe        | Exemples                                          | Compte dans                    |
| ------------- | ------------------------------------------------- | ------------------------------ |
| Revenu        | Salaire, Revenu développement, Cadeau, Vente      | Revenus gagnés                 |
| Dépense       | Courses, Carburant, Famille, Abonnements          | Dépenses du mois, enveloppes   |
| Transfert     | Courant → mobile, retrait espèces, recharge carte | Rien (neutre)                  |
| Épargne       | Courant → BGFI/UGB épargne                        | Épargne placée                 |
| Projet        | Achat lié à un projet                             | Poche projets, hors enveloppes |
| Prêt          | Avance à un proche                                | Prêts en cours, hors dépenses  |
| Remboursement | Retour d'une avance                               | Clôture du prêt, hors revenus  |
| Ajustement    | Écart non identifié au pointage                   | KPI d'écart                    |

La classe et l'enveloppe sont déduites de la catégorie, jamais saisies. Une combinaison incohérente (catégorie de revenu sur une sortie d'argent) est bloquée.

### R3 — Mois budgétaire

- Par défaut = mois de la date de l'opération.
- Le salaire et l'épargne versés à partir du 25 basculent sur le mois suivant (ex. salaire du 29/09 = cycle octobre).
- Modifiable à la main sur chaque opération.

### R4 — Enveloppes

- Une enveloppe = un plafond mensuel estimé sur un groupe de catégories. Ce n'est pas de l'argent mis de côté.
- Aucun report : chaque enveloppe repart à son montant le 1er du mois (Famille 100 000 en novembre non dépensé ≠ 200 000 en décembre).
- Chaque enveloppe indique sa source : « pot du mois » (mobile + espèces) ou « courant / carte », pour que la prévision du pot ne compte pas l'argent payé ailleurs. Abonnements = carte prépayée ; Voiture / entretien = courant (réserve de sécurité, rarement utilisée) ; toutes les autres = pot.
- Budgets historisés par mois ; un nouveau mois copie le précédent.

### R5 — Renforts

- Un transfert courant → mobile en cours de mois est marqué `Renfort` et lié à l'enveloppe qui déborde.
- À la clôture, une enveloppe renforcée 3 mois de suite est signalée comme sous-estimée.

### R6 — Épargne

- Cible : 30 % du salaire, paramétrable. Le jour du salaire, l'app propose le virement (≈ 307 000) ; le montant est ajustable.
- Épargne placée = virements vers BGFI ou UGB épargne.
- Épargne non placée = reliquat laissé volontairement sur courant à la clôture.
- Taux d'épargne total = (placée + non placée) / salaire, affiché avec ses deux parts.

### R7 — Projets et poches d'épargne

- Les projets sont payés depuis BGFI épargne uniquement (souvent via un transfert BGFI épargne → carte prépayée lié au projet). UGB épargne ne finance jamais de projet.
- Deux poches virtuelles dans l'épargne : **Épargne de sécurité** et **Fonds projets**. Aucune répartition fixée à l'avance.
- Fonds projets du mois = somme des achats projets du mois. Sécurité du mois = épargne versée − achats projets. Exemple : 307 000 versés, RAM 32 Go 205 000 → sécurité 102 000.
- Si les achats projets dépassent l'épargne du mois, le surplus est prélevé sur l'épargne de sécurité accumulée, et l'app l'affiche explicitement.
- Taux brut = épargne versée / salaire ; taux net = sécurité / salaire.
- Un projet a un nom, un montant cible facultatif (plafond souple, alerte sans blocage ; PC Tower n'en a pas, sa seule limite est le solde disponible de BGFI épargne), une échéance facultative, et cumule ses achats sur plusieurs mois. Les achats projets n'entrent jamais dans les enveloppes.

### R8 — Reliquat de fin de mois

À la clôture, l'app calcule le reliquat (courant et mobile au-delà du prévu). Choix : virer vers l'épargne, ou le garder sur courant. Gardé, il devient du « disponible libre » : une dépense financée par lui reste dans sa catégorie, et l'enveloppe affiche « dépassement couvert par le disponible », pas « budget dépassé ».

### R9 — Activité développement

- Revenus = catégorie Revenu développement, rattachée à un client (ex. Prestix).
- Coûts déduits = opérations avec Usage = Activité ; Usage = Mixte est affiché mais non déduit.
- Gain net = revenus − coûts, par mois, par client et par an.
- Une dépense payée avec l'argent d'un client mais sans lien avec l'activité (ex. pizza, goûter payés avec les fonds Prestix) porte ce client et Usage = Personnel : elle apparaît dans « utilisation des fonds » du client sans réduire le gain net. Conformité : si les revenus dev sont un jour déclarés, seules les vraies charges peuvent réduire le gain.

### R10 — Prêts et avances

Un prêt crée une créance (personne, montant, date). Un remboursement la solde en tout ou partie. Ni l'un ni l'autre ne touche dépenses ou revenus gagnés.

## Modèle de données

Une table `operations` au centre ; tout le reste est référentiel ou calculé. Montants en entiers XAF, toujours positifs : le sens vient de la classe et des comptes.

| Table            | Champs principaux                                                                                                                                                                        | Notes                                                              |
| ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| `comptes`        | id, nom, type (banque, mobile, espèces, épargne, carte), solde_ouverture, actif, ordre                                                                                                   | Les 6 comptes de R1                                                |
| `categories`     | id, nom, classe, enveloppe_id, actif                                                                                                                                                     | La classe pilote les totaux (R2)                                   |
| `enveloppes`     | id, nom, source (pot, courant_carte)                                                                                                                                                     | Maison, Transport et alimentation, Famille, Loisirs et personnel…  |
| `budgets`        | mois, enveloppe_id ou categorie_id, montant                                                                                                                                              | Un jeu par mois, copié du précédent                                |
| `operations`     | id, date, mois_budget, libelle, montant, categorie_id, compte_source_id, compte_dest_id, projet_id, client, usage, pret_id, recurrent_id, statut, note, cree_le, modifie_le, supprime_le | statut : brouillon, validée                                        |
| `recurrents`     | id, libelle, montant, montant_variable, categorie_id, compte_id, frequence, jour, actif, prochaine_echeance                                                                              | Génère des brouillons (R11)                                        |
| `projets`        | id, nom, plafond, echeance, statut, note                                                                                                                                                 | PC Tower, Terrain…                                                 |
| `prets`          | id, personne, montant, date, statut                                                                                                                                                      | Soldé par les remboursements                                       |
| `pointages`      | id, compte_id, date, solde_reel, solde_theorique, ecart, operation_ajustement_id                                                                                                         | Historique des contrôles                                           |
| `clotures`       | mois, salaire, epargne_placee, epargne_non_placee, fonds_projets, securite, reliquat, choix_reliquat, ecart_total, verrouille_le                                                         | Photo figée du mois                                                |
| `parametres`     | cle, valeur                                                                                                                                                                              | Cible d'épargne 30 %, jour de bascule 25, tolérance espèces 5 000… |
| `journal_modifs` | id, table, ligne_id, avant, apres, date                                                                                                                                                  | Toute modification ou suppression                                  |

Règles de cohérence :

- Transfert et Épargne : `compte_source_id` et `compte_dest_id` obligatoires, différents.
- Dépense, Projet, Prêt : `compte_source_id` obligatoire. Revenu, Remboursement : `compte_dest_id` obligatoire.
- Projet : `projet_id` obligatoire. Remboursement : `pret_id` obligatoire.
- Suppression logique uniquement (`supprime_le`).
- Un mois clôturé est en lecture seule ; le rouvrir est une action explicite, journalisée.

Solde théorique d'un compte = solde d'ouverture + entrées − sorties, toutes classes confondues, opérations validées uniquement.

## Écrans mobile

Le mobile sert à saisir vite et à voir où en est le mois ; une saisie doit prendre moins de 5 secondes. PWA installable, navigation basse à 5 onglets : Accueil, Budget, + (saisie), Historique, Plus.

1. **Accueil**
   - Pot du mois : chargé, dépensé (mobile + espèces), reste.
   - Reste à dépenser par jour = reste des enveloppes « pot » / jours restants.
   - Dépensé aujourd'hui, nombre de brouillons à valider.
   - Alertes : enveloppe ≥ 90 %, pointage en retard, achat projet qui entame la sécurité.
   - 5 dernières opérations.
2. **Saisie rapide**
   - Montant en grand avec pavé numérique, puis catégorie et compte en puces (les plus utilisées d'abord).
   - Libellé facultatif ; date = aujourd'hui ; mois budgétaire auto (R3).
   - Ligne de confirmation : classe, enveloppe et mois déduits.
   - Champs conditionnels : projet (classe Projet), personne (Prêt), client et usage (bascule Activité dev), compte de destination (Transfert, Épargne).
   - Mode hors ligne : la saisie est mise en file et envoyée au retour du réseau.
3. **À valider** : brouillons des récurrents (et plus tard du bot et des SMS). Valider en un geste, ou corriger le montant puis valider.
4. **Budget** : enveloppes du mois avec barre de progression, dépenses projets à part. Toucher une ligne ouvre ses opérations.
5. **Historique** : un bloc par mois (taux d'épargne brut et net, dépenses, reste) et l'évolution sur 12 mois.
6. **Plus** : Comptes et pointage, Projets, Prêts, Activité dev, Clôture, Réglages.

Le pointage sur mobile : une ligne par compte, solde théorique affiché, saisie du solde réel, écart calculé ; si l'écart dépasse la tolérance, proposer de chercher l'opération manquante ou de créer un ajustement.

## Écrans desktop

Le desktop sert à relire, corriger et clôturer. Même app, mise en page large : barre latérale à gauche, contenu au centre, panneau de contexte à droite.

| Écran               | Contenu                                                                                                                                                                              |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Accueil             | Indicateurs (aujourd'hui, reste par jour, fin de mois prévue, écart non pointé), courbe dépensé cumulé contre rythme budgétaire, journal récent, échéances à venir, état des comptes |
| À valider           | Brouillons en liste, validation groupée                                                                                                                                              |
| Journal             | Toutes les opérations, filtres (mois, compte, catégorie, classe, projet, client, texte), édition en ligne, modification groupée, export CSV                                          |
| Budget              | Enveloppes par mois, édition des montants, copie du mois précédent, renforts liés                                                                                                    |
| Récurrents          | Échéancier, coût mensuel et annuel des abonnements                                                                                                                                   |
| Comptes             | Soldes théoriques, historique des pointages, écarts                                                                                                                                  |
| Objectifs / Projets | Par projet : dépensé, plafond, échéance, achats ; poches sécurité et projets                                                                                                         |
| Prêts               | Créances ouvertes et soldées                                                                                                                                                         |
| Activité dev        | Revenus, coûts, gain net par mois, client et année ; dépenses « Activité » à vérifier                                                                                                |
| Historique          | Tableau mensuel et graphiques sur 12 mois et plus                                                                                                                                    |
| Clôture             | Assistant de fin de mois (R13)                                                                                                                                                       |
| Réglages            | Catégories, enveloppes, comptes, paramètres, import/export, sauvegardes                                                                                                              |

Le panneau de droite de l'accueil montre les échéances du mois restant et le dernier pointage de chaque compte, avec un bouton « Pointer maintenant ».

## Fiabilité : récurrents, pointage, clôture

La précision vient du contrôle des soldes réels, pas d'une saisie parfaite : un oubli doit être repéré en quelques jours.

### R11 — Récurrents

- Chaque modèle génère un brouillon à sa date, visible dans « À valider ». Rien n'est enregistré sans validation.
- Montant variable (électricité) : le brouillon porte le dernier montant, à corriger à la validation.
- Modèles initiaux, à confirmer :

| Libellé         | Jour | Montant (XAF) | Compte                 | Classe    |
| --------------- | ---- | ------------- | ---------------------- | --------- |
| Claude          | 1    | 12 000        | Carte prépayée         | Dépense   |
| Internet maison | 1    | 25 500        | Pot                    | Dépense   |
| ChatGPT         | 8    | 12 000        | Carte prépayée         | Dépense   |
| GitHub Copilot  | 17   | 6 100         | Carte prépayée         | Dépense   |
| Spotify         | 21   | 2 000         | Carte prépayée         | Dépense   |
| Amazon Prime    | 25   | 4 600         | Carte prépayée         | Dépense   |
| Internet mobile | 26   | 10 000        | Espèces                | Dépense   |
| Salaire         | 29   | 1 023 000     | BGFI courant           | Revenu    |
| Épargne (30 %)  | 29   | ≈ 307 000     | Courant → BGFI épargne | Épargne   |
| Pot du mois     | 29   | 400 000       | Courant → BGFI mobile  | Transfert |
| Retrait espèces | 30   | ≈ 200 000     | Mobile → Espèces       | Transfert |

### R12 — Pointage

- Hebdomadaire (rappel le dimanche) pour courant, mobile, espèces et carte ; mensuel pour les comptes d'épargne.
- Écart = solde réel − solde théorique. Au-delà de la tolérance : chercher l'opération oubliée, sinon créer un `Ajustement` (« Écart non identifié », « Écart espèces »).
- Tolérance espèces : 5 000 par semaine ; 0 pour les comptes bancaires.

### R13 — Clôture mensuelle

Assistant en 5 étapes, bloquantes dans l'ordre :

1. Tous les brouillons du mois validés ou supprimés.
2. Tous les comptes pointés après le dernier jour du mois.
3. Opérations « à vérifier » revues (Activité suspecte, ajustements).
4. Reliquat : virer vers l'épargne ou garder sur courant (R8).
5. Verrouillage : photo du mois dans `clotures`, enveloppes sous-estimées signalées (R5).

### Indicateurs

| Indicateur           | Calcul                                                  | Cible               |
| -------------------- | ------------------------------------------------------- | ------------------- |
| Écart inexpliqué     | Somme des ajustements du mois, par compte               | < 20 000 par compte |
| Taux d'épargne total | (placée + non placée) / salaire                         | 30 %                |
| Taux net             | Sécurité / salaire                                      | Suivi, pas de cible |
| Reste par jour       | Reste enveloppes pot / jours restants                   | ≥ 0                 |
| Fin de mois prévue   | Solde actuel + échéances à venir − reste des enveloppes | ≥ 0                 |
| Renforts             | Nombre et montant par mois                              | 0                   |
| Jours sans saisie    | Jours du mois sans aucune opération                     | Signal d'oubli      |

Rappel quotidien à 21 h si aucune opération n'a été saisie dans la journée.

## Architecture, hébergement, sécurité

Une seule application, une seule base SQLite, un seul conteneur sur le homelab, joignable uniquement via le tailnet.

| Couche        | Choix proposé                                                                                                                | Pourquoi                                                                         |
| ------------- | ---------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| App           | React (Vite, PWA) + API Node REST, en TypeScript ; Node sert aussi le build React                                            | Stack habituelle ; l'API sert aussi le bot, les SMS, l'export CSV et les e-mails |
| Base          | SQLite + migrations versionnées (Drizzle)                                                                                    | Mono-utilisateur, zéro serveur de base à gérer                                   |
| Déploiement   | Docker Compose sur le homelab                                                                                                | Mise à jour = pull + restart                                                     |
| Réseau        | `tailscale serve` (HTTPS automatique sur le nom `.ts.net`)                                                                   | Aucun port ouvert sur internet                                                   |
| Auth          | Compte unique : mot de passe fort ou passkey, session courte sur desktop, longue sur le téléphone                            | Défense en profondeur si un appareil du tailnet est compromis                    |
| Notifications | Notifications push PWA (Web Push) ; sur iPhone, l'app doit être installée sur l'écran d'accueil ; e-mail plus tard via l'API | Rappels 21 h, pointage du dimanche, échéances                                    |
| Sauvegardes   | Copie nocturne de la base (sauvegarde SQLite à chaud), chiffrée, vers un 2e disque et une copie hors site                    | La base est la seule source de vérité                                            |

Règles de sécurité :

- Aucune exposition publique (pas de Funnel, pas de redirection de port).
- Test de restauration une fois par mois, sinon la sauvegarde ne compte pas.
- Export CSV complet disponible à tout moment : pas d'enfermement dans l'app.
- **Conformité :** n'accéder à l'app ni l'installer depuis un poste ANAC joint au domaine ; Tailscale et des données personnelles sur un poste de travail iraient très probablement contre la politique de la DSI. Utiliser le téléphone et le PC personnel.
- Bot Telegram (phase 3) : les messages transitent par les serveurs de Telegram ; n'y envoyer que montant et catégorie, jamais de soldes. Même règle pour les notifications push, qui transitent par les serveurs de Google ou d'Apple : texte générique, sans montant.

## Migration du fichier Excel v9.3

L'import reprend les 46 opérations d'août à octobre 2026, les catégories, les budgets et les soldes de fin de mois saisis dans l'Historique. Il passe par un écran de prévisualisation : rien n'est écrit avant validation.

Correspondances :

| Excel                     | App                                                                       |
| ------------------------- | ------------------------------------------------------------------------- |
| Type + Catégorie          | Catégorie (la classe en découle)                                          |
| Enveloppe / support       | Compte réel si c'est un compte ; sinon déduit (enveloppe virtuelle = pot) |
| « Mobile / Airtel Money » | BGFI mobile                                                               |
| Mois budgétaire           | `mois_budget` tel quel                                                    |
| Projet / Client, Usage    | `projet_id` ou `client`, `usage`                                          |
| Budget mensuel B11:B24    | Budgets d'août, septembre et octobre 2026                                 |
| Historique J:L (soldes)   | Pointages de fin de mois                                                  |

Corrections à faire pendant l'import :

| Ligne     | Problème                                            | Correction proposée                                                                                                          |
| --------- | --------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| 13        | Date 04/08/2026 dans le cycle de septembre          | 04/09/2026                                                                                                                   |
| 24        | « Baleno fuel » classé Voiture / entretien          | Carburant                                                                                                                    |
| 29–32, 34 | Catégorie « Revenu développement » sur des dépenses | Vraie catégorie + Usage = Activité si c'est un coût dev                                                                      |
| 30, 32    | Pizza et goûter marqués Activité                    | Client Prestix, Usage Personnel, catégorie Restaurant ou Famille : payées avec les fonds Prestix, hors coûts d'activité (R9) |
| 33, 35    | Usage = Mixte sur le salaire et l'épargne           | Usage vide                                                                                                                   |
| 6, 35     | Épargne catégorisée « Autre »                       | Classe Épargne, courant → BGFI épargne                                                                                       |
| 7, 39     | Achats PC en classe Projet payés par carte          | Projet PC Tower ; ajouter les transferts épargne → carte (confirmés), montants et dates saisis à l'import                    |
| 40, 50    | Prêt à Cody et remboursement                        | Prêt soldé de 150 000                                                                                                        |

Les transferts entre comptes n'étaient pas saisis dans Excel. Les soldes d'ouverture au 1er octobre 2026 seront donc saisis à la main au premier pointage ; septembre et août restent consultables mais non pointés.

## Phases

Les phases 1 et 2 suffisent à tenir la cible de moins de 20 000 XAF d'écart par mois, à condition de pointer chaque semaine. Chaque phase se termine par un critère de sortie vérifiable.

1. **Phase 1 — Socle** : comptes, catégories, enveloppes, saisie rapide (mobile), journal (desktop), transferts, budget du mois, pointage, import v9.3, sauvegardes, auth, déploiement Tailscale.
   - Sortie : octobre 2026 importé, soldes d'ouverture saisis, un pointage hebdo réalisé avec un écart expliqué, restauration testée.
2. **Phase 2 — Discipline** : récurrents et boîte « À valider », épargne (R6), projets et poches (R7), reste par jour, fin de mois prévue, clôture mensuelle, historique, rappels.
   - Sortie : un mois complet clôturé dans l'app sans Excel, écart inexpliqué sous 20 000 par compte.
3. **Phase 3 — Confort** : prêts, Activité dev complet, bot de saisie, graphiques 12 mois, desktop enrichi (modification groupée, accueil complet).
   - Sortie : trois mois clôturés d'affilée.
4. **Phase 4 — Automatisation** : import des SMS BGFI en brouillons via un relais SMS Android vers l'app.
   - Sortie : plus de 80 % des opérations bancaires arrivent en brouillon sans saisie.
