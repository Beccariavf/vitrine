import { strict as assert } from "node:assert";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { connect } from "node:net";
import { describe, it } from "node:test";
import type { AstroIntegrationLogger } from "astro";
import {
  MESSAGE_DESACTIVE,
  apiRecherche,
  composerOrigines,
  demarrerApi,
  essaiAutoDesactive,
} from "../src/integrations/api-recherche.ts";

/** Logger simulé : l'intégration ne reçoit que `info` et `warn`. */
type JournalSimule = { infos: string[]; avertissements: string[]; logger: AstroIntegrationLogger };

function journalSimule(): JournalSimule {
  const infos: string[] = [];
  const avertissements: string[] = [];
  const faux = {
    info: (message: string) => {
      infos.push(message);
    },
    warn: (message: string) => {
      avertissements.push(message);
    },
  };
  return { infos, avertissements, logger: faux as unknown as AstroIntegrationLogger };
}

/** Port libre sur la boucle locale : ouvert puis refermé aussitôt. */
async function portLibre(): Promise<number> {
  const serveur = createServer();
  await new Promise<void>((resoudre) => serveur.listen(0, "127.0.0.1", resoudre));
  const port = (serveur.address() as AddressInfo).port;
  await new Promise<void>((resoudre) => serveur.close(() => resoudre()));
  return port;
}

/** Connexion TCP : résout si elle aboutit, rejette si le port est fermé. */
function connexion(port: number): Promise<void> {
  return new Promise((resoudre, rejeter) => {
    const socket = connect(port, "127.0.0.1", () => {
      socket.destroy();
      resoudre();
    });
    socket.on("error", rejeter);
  });
}

/** Options du hook de démarrage, avec l'adresse que connaît Astro. */
function optionsDemarrage(port: number, logger: AstroIntegrationLogger) {
  return { address: { address: "127.0.0.1", family: "IPv4", port }, logger };
}

describe("origines de l'API de recherche", () => {
  it("ajoute les deux formes du serveur de développement aux origines lues", () => {
    assert.deepEqual(composerOrigines(["http://exemple.test"], 4330), [
      "http://exemple.test",
      "http://localhost:4330",
      "http://127.0.0.1:4330",
    ]);
  });

  it("dédoublonne une origine déjà déclarée", () => {
    assert.deepEqual(composerOrigines(["http://localhost:4330"], 4330), [
      "http://localhost:4330",
      "http://127.0.0.1:4330",
    ]);
  });

  it("ne désactive que la valeur exacte 0", () => {
    assert.equal(essaiAutoDesactive("0"), true);
    assert.equal(essaiAutoDesactive(undefined), false);
    assert.equal(essaiAutoDesactive(""), false);
    assert.equal(essaiAutoDesactive("1"), false);
    assert.equal(essaiAutoDesactive("false"), false);
  });
});

describe("lancement de l'API avec le serveur de développement", () => {
  it("avertit d'une ligne sans lever quand le port est occupé", async () => {
    const bloqueur = createServer();
    await new Promise<void>((resoudre) => bloqueur.listen(0, "127.0.0.1", resoudre));
    const port = (bloqueur.address() as AddressInfo).port;
    const journal = journalSimule();
    try {
      const serveur = await demarrerApi({ port, origines: [], logger: journal.logger });
      assert.equal(serveur, null);
      assert.deepEqual(journal.infos, []);
      assert.equal(journal.avertissements.length, 1);
      assert.match(journal.avertissements[0] ?? "", new RegExp(`port ${port} occupé`));
      assert.match(journal.avertissements[0] ?? "", /l'encart dira service éteint/);
    } finally {
      await new Promise<void>((resoudre) => bloqueur.close(() => resoudre()));
    }
  });

  it("démarre avec les hooks, autorise l'origine réelle, puis s'arrête", async () => {
    const port = await portLibre();
    const journal = journalSimule();
    const integration = apiRecherche();
    const ancienPort = process.env.VITRINE_HTTP_PORT;
    const ancienAuto = process.env.VITRINE_ESSAI_AUTO;
    delete process.env.VITRINE_ESSAI_AUTO;
    process.env.VITRINE_HTTP_PORT = String(port);
    try {
      await integration.hooks["astro:server:start"]?.(optionsDemarrage(4330, journal.logger));
      assert.deepEqual(journal.avertissements, []);

      const reponse = await fetch(`http://127.0.0.1:${port}/autre`, {
        headers: { Origin: "http://localhost:4330" },
      });
      await reponse.text();
      assert.equal(reponse.status, 404);
      assert.equal(reponse.headers.get("access-control-allow-origin"), "http://localhost:4330");

      await integration.hooks["astro:server:done"]?.({ logger: journal.logger });
      await assert.rejects(connexion(port));
    } finally {
      if (ancienPort === undefined) delete process.env.VITRINE_HTTP_PORT;
      else process.env.VITRINE_HTTP_PORT = ancienPort;
      if (ancienAuto === undefined) delete process.env.VITRINE_ESSAI_AUTO;
      else process.env.VITRINE_ESSAI_AUTO = ancienAuto;
      await integration.hooks["astro:server:done"]?.({ logger: journal.logger });
    }
  });

  it("ferme l'ancien serveur avant d'en rouvrir un au redémarrage", async () => {
    const port = await portLibre();
    const journal = journalSimule();
    const integration = apiRecherche();
    const ancienPort = process.env.VITRINE_HTTP_PORT;
    const ancienAuto = process.env.VITRINE_ESSAI_AUTO;
    delete process.env.VITRINE_ESSAI_AUTO;
    process.env.VITRINE_HTTP_PORT = String(port);
    try {
      await integration.hooks["astro:server:start"]?.(optionsDemarrage(4330, journal.logger));
      await integration.hooks["astro:server:start"]?.(optionsDemarrage(4330, journal.logger));
      assert.deepEqual(journal.avertissements, []);
      const reponse = await fetch(`http://127.0.0.1:${port}/autre`);
      await reponse.text();
      assert.equal(reponse.status, 404);
    } finally {
      if (ancienPort === undefined) delete process.env.VITRINE_HTTP_PORT;
      else process.env.VITRINE_HTTP_PORT = ancienPort;
      if (ancienAuto === undefined) delete process.env.VITRINE_ESSAI_AUTO;
      else process.env.VITRINE_ESSAI_AUTO = ancienAuto;
      await integration.hooks["astro:server:done"]?.({ logger: journal.logger });
    }
  });

  it("ne lance rien quand VITRINE_ESSAI_AUTO=0", async () => {
    const port = await portLibre();
    const journal = journalSimule();
    const integration = apiRecherche();
    const ancienAuto = process.env.VITRINE_ESSAI_AUTO;
    const ancienPort = process.env.VITRINE_HTTP_PORT;
    process.env.VITRINE_ESSAI_AUTO = "0";
    process.env.VITRINE_HTTP_PORT = String(port);
    try {
      await integration.hooks["astro:server:start"]?.(optionsDemarrage(4330, journal.logger));
      assert.deepEqual(journal.infos, [MESSAGE_DESACTIVE]);
      assert.deepEqual(journal.avertissements, []);
      await assert.rejects(connexion(port));
    } finally {
      if (ancienAuto === undefined) delete process.env.VITRINE_ESSAI_AUTO;
      else process.env.VITRINE_ESSAI_AUTO = ancienAuto;
      if (ancienPort === undefined) delete process.env.VITRINE_HTTP_PORT;
      else process.env.VITRINE_HTTP_PORT = ancienPort;
    }
  });
});
