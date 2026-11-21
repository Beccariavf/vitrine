/**
 * Réponses PISTE synthétiques pour les entrées du descripteur `textes_fr` qui
 * n'ont pas de capture réelle committée : les tests hors ligne exercent toutes
 * les routes (texte entier, section de code, article, liste d'articles) sans
 * réseau. Chaque article est `VIGUEUR`, porte son numéro et une date de début.
 *
 * Les captures réelles (`decret.json`, `code-penal.json`, `cpce.json`) restent
 * celles des trois entrées d'origine ; ce fichier ne les remplace jamais.
 */

import { createHash } from "node:crypto";
import type { DescripteurTextesFr, TexteFr } from "../../../mcp/corpus/textes-fr/parse.ts";

/** Identifiant `LEGIARTI…` stable, dérivé du texte et du numéro. */
export function identifiantSynthetique(textId: string, num: string): string {
  const empreinte = createHash("sha256")
    .update(`${textId}|${num}`, "utf8")
    .digest("hex")
    .slice(0, 9)
    .toUpperCase();
  return `LEGIARTI${empreinte}`;
}

/** Réponse `getArticleWithIdAndNum` d'un article en vigueur. */
export function articleSynthetique(textId: string, num: string): unknown {
  return {
    article: {
      id: identifiantSynthetique(textId, num),
      num,
      etat: "VIGUEUR",
      dateDebut: "2021-01-01",
      dateFin: null,
      texte: `Texte de l'article ${num}.`,
      context: { titresTM: [{ titre: "Partie législative" }] },
    },
  };
}

/** Réponse `/consult/code` réduite à une section : un article par numéro demandé. */
export function sectionSynthetique(texte: TexteFr, sctCid: string, nums: readonly string[]): unknown {
  return {
    id: `${texte.textId}_01-01-2025`,
    title: texte.titre,
    dateDebutVersion: "2025-01-01",
    articles: [],
    sections: [
      {
        id: sctCid,
        cid: sctCid,
        title: `Section ${nums.join(", ")}`,
        articles: nums.map((num) => ({
          id: identifiantSynthetique(texte.textId, num),
          num,
          content: `<p>Texte de l'article ${num}.</p>`,
          pathTitle: [],
          etat: "VIGUEUR",
          dateDebut: "2021-01-01",
          dateFin: null,
        })),
        sections: [],
      },
    ],
  };
}

/** Réponse `/consult/code` de la route `code` : la section visée, premier et dernier article. */
export function codeSynthetique(texte: TexteFr): unknown {
  const route = texte.route;
  if (route.type !== "code") {
    throw new Error(`${texte.cle} : route code attendue`);
  }
  return sectionSynthetique(texte, route.sctCid, [route.premier, route.dernier]);
}

/**
 * Une réponse par entrée du descripteur, dans l'ordre de celui-ci. Les captures
 * réelles sont reprises telles quelles ; toute autre entrée reçoit sa réponse
 * synthétique. Une route `legiPart` sans capture réelle lève : elle ne peut pas
 * être inventée compacte sans fausser les comptes.
 */
export function reponsesSynthetiques(
  descripteur: DescripteurTextesFr,
  reelles: Readonly<Record<string, unknown>> = {},
): Record<string, unknown> {
  const reponses: Record<string, unknown> = { ...reelles };
  for (const texte of descripteur.textes) {
    if (reponses[texte.cle] !== undefined) continue;
    const route = texte.route;
    if (route.type === "articles") {
      reponses[texte.cle] = route.nums.map((num) => articleSynthetique(texte.textId, num));
    } else if (route.type === "article") {
      reponses[texte.cle] = articleSynthetique(texte.textId, route.num);
    } else if (route.type === "code") {
      reponses[texte.cle] = codeSynthetique(texte);
    } else if (route.type === "codeArticles") {
      reponses[texte.cle] = route.sections.map((section) =>
        sectionSynthetique(texte, section.sctCid, section.nums),
      );
    } else {
      throw new Error(`${texte.cle} : aucune capture réelle pour une route legiPart`);
    }
  }
  return reponses;
}

/** Corps d'un appel PISTE, tel que le fake de `fetch` le reçoit. */
export type CorpsAppel = {
  textId?: unknown;
  sctCid?: unknown;
  id?: unknown;
  num?: unknown;
};

/**
 * Réponse d'un appel PISTE simulé, retrouvée par ses identifiants : la section
 * visée pour `/consult/code`, le couple texte + numéro pour
 * `getArticleWithIdAndNum`. `null` quand l'appel ne correspond à aucune entrée.
 */
export function reponseParCorps(
  descripteur: DescripteurTextesFr,
  reponses: Readonly<Record<string, unknown>>,
  corps: CorpsAppel,
): unknown {
  for (const texte of descripteur.textes) {
    const route = texte.route;
    if (route.type === "code") {
      if (corps.textId === texte.textId && corps.sctCid === route.sctCid) return reponses[texte.cle];
    } else if (route.type === "article") {
      if (corps.id === texte.textId && corps.num === route.num) return reponses[texte.cle];
    } else if (route.type === "articles") {
      const rang = route.nums.indexOf(String(corps.num));
      if (corps.id === texte.textId && rang >= 0) {
        return (reponses[texte.cle] as unknown[] | undefined)?.[rang];
      }
    } else if (route.type === "codeArticles") {
      const rang = route.sections.findIndex((section) => section.sctCid === corps.sctCid);
      if (corps.textId === texte.textId && rang >= 0) {
        return (reponses[texte.cle] as unknown[] | undefined)?.[rang];
      }
    }
  }
  return null;
}
