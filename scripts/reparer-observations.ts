/**
 * Réparation des observations écrasées par le report.
 *
 * Pour chaque détail de l'exercice cible dont l'observation commence par
 * "Stock reporté", restaure l'observation initiale : observation du détail
 * source (exercice année-1, même SOA, même article × prix), sinon
 * justificatifs des mouvements sources joints par " ; ".
 * En cas de doublon sur le compte cible, " — désignation" (puis " — prix")
 * est ajouté, sans jamais masquer l'origine.
 *
 * Usage (depuis srb_backend) :
 *   node scripts/reparer-observations.ts --exerciceId 6            # dry-run
 *   node scripts/reparer-observations.ts --exerciceId 6 --apply    # écriture
 *
 * Faites un backup de la base avant --apply.
 */
import { readFileSync } from 'node:fs';
import { PrismaClient } from '@prisma/client';

function parseArgs(argv: string[]): { exerciceId: number; apply: boolean } {
  let exerciceId = NaN;
  let apply = false;
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--exerciceId' && i + 1 < argv.length) {
      exerciceId = Number(argv[i + 1]);
      i += 1;
    } else if (argv[i] === '--apply') {
      apply = true;
    }
  }
  if (!Number.isInteger(exerciceId)) {
    console.error('Usage : node scripts/reparer-observations.ts --exerciceId <id> [--apply]');
    process.exit(2);
  }
  return { exerciceId, apply };
}

function loadDatabaseUrl(): string {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  try {
    const env = readFileSync(new URL('../.env', import.meta.url), 'utf8');
    for (const line of env.split('\n')) {
      const match = line.match(/^\s*DATABASE_URL\s*=\s*"?([^"\r\n]+)"?\s*$/);
      if (match) {
        process.env.DATABASE_URL = match[1];
        return match[1];
      }
    }
  } catch {
    // ignore, erreur explicite ci-dessous
  }
  console.error("DATABASE_URL introuvable (env ou srb_backend/.env).");
  process.exit(2);
}

function cle(articleId: number, prixUnitaire: unknown): string {
  return `${articleId}:${Number(prixUnitaire).toFixed(2)}`;
}

const prisma = new PrismaClient();
const { exerciceId, apply } = parseArgs(process.argv.slice(2));
loadDatabaseUrl();

const cible = await prisma.exercice.findUnique({
  where: { id: exerciceId },
  include: {
    compteMatiere: {
      include: { details: { include: { article: true } } },
    },
  },
});
if (!cible) {
  console.error(`Exercice cible ${exerciceId} introuvable.`);
  await prisma.$disconnect();
  process.exit(1);
}
if (cible.statut === 'CLOTURE') {
  console.error(`Exercice cible ${cible.annee} clôturé : on n'y écrit jamais.`);
  await prisma.$disconnect();
  process.exit(1);
}
const source = await prisma.exercice.findUnique({
  where: { soaId_annee: { soaId: cible.soaId, annee: cible.annee - 1 } },
  include: {
    compteMatiere: {
      include: { details: { include: { article: true } } },
    },
    mouvements: {
      select: { articleId: true, prixUnitaire: true, observation: true },
      orderBy: { id: 'asc' },
    },
  },
});
if (!source?.compteMatiere) {
  console.error(`Exercice source ${cible.annee - 1} (même SOA) sans compte-matière : rien à restaurer.`);
  await prisma.$disconnect();
  process.exit(1);
}

const detailsSourceParCle = new Map(
  (source.compteMatiere.details ?? []).map((detail) => [
    cle(detail.articleId, detail.prixUnitaire),
    detail,
  ]),
);
const justificatifsParCle = new Map<string, string[]>();
for (const mouvement of source.mouvements ?? []) {
  const texte = mouvement.observation?.trim();
  if (!texte) continue;
  const key = cle(mouvement.articleId, mouvement.prixUnitaire);
  const liste = justificatifsParCle.get(key) ?? [];
  if (!liste.includes(texte)) liste.push(texte);
  justificatifsParCle.set(key, liste);
}

const detailsCible = cible.compteMatiere?.details ?? [];
const aReparer = detailsCible.filter((detail) =>
  (detail.observation ?? '').startsWith('Stock reporté'),
);
const observationsConservees = new Set<string>(
  detailsCible
    .filter((detail) => !(detail.observation ?? '').startsWith('Stock reporté'))
    .map((detail) => detail.observation)
    .filter((observation): observation is string => observation != null),
);

let restaures = 0;
let ignores = 0;
const ecritures: { id: number; ancienne: string; nouvelle: string }[] = [];
for (const detail of aReparer) {
  const key = cle(detail.articleId, detail.prixUnitaire);
  const sourceDetail = detailsSourceParCle.get(key);
  const justificatifs = justificatifsParCle.get(key) ?? [];
  const base =
    sourceDetail?.observation?.trim() ||
    (justificatifs.length > 0 ? justificatifs.join(' ; ') : null);
  if (!base) {
    ignores += 1;
    console.log(
      `- détail #${detail.id} (${detail.article.designation}, ${Number(detail.prixUnitaire)} Ar) : aucune observation initiale trouvée, conservé tel quel.`,
    );
    continue;
  }
  let nouvelle = base;
  if (observationsConservees.has(nouvelle)) {
    nouvelle = `${base} — ${detail.article.designation}`;
  }
  if (observationsConservees.has(nouvelle)) {
    nouvelle = `${base} — ${detail.article.designation} — ${Number(detail.prixUnitaire)}`;
  }
  if (observationsConservees.has(nouvelle)) {
    ignores += 1;
    console.log(
      `- détail #${detail.id} (${detail.article.designation}) : conflit d'unicité persistant pour "${base}", intervention manuelle requise.`,
    );
    continue;
  }
  observationsConservees.add(nouvelle);
  restaures += 1;
  ecritures.push({
    id: detail.id,
    ancienne: detail.observation ?? '',
    nouvelle,
  });
  console.log(`- détail #${detail.id} (${detail.article.designation}) :\n    avant : ${detail.observation}\n    après : ${nouvelle}`);
}

console.log(
  `\nExercice ${cible.annee} : ${aReparer.length} détail(s) "Stock reporté", ${restaures} restauré(s), ${ignores} ignoré(s).`,
);
if (!apply) {
  console.log('Dry-run : aucune écriture. Relancez avec --apply pour écrire (après backup).');
} else if (ecritures.length > 0) {
  await prisma.$transaction(
    ecritures.map((ecriture) =>
      prisma.detailCompteMatiere.update({
        where: { id: ecriture.id },
        data: { observation: ecriture.nouvelle },
      }),
    ),
  );
  console.log(`${ecritures.length} observation(s) restaurée(s).`);
}
await prisma.$disconnect();
