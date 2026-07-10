const { io } = require("socket.io-client");

// Simula a conexão de dois desenvolvedores na mesma "sala" de workspace
const workspaceId = "1";

const devA = io("http://localhost:3000/clairvoyance");
const devB = io("http://localhost:3000/clairvoyance");

function setupClient(client, name) {
  client.on("connect", () => {
    console.log(`[${name}] Conectado com socket ID: ${client.id}`);
    // Ao conectar, entra na sala do Workspace 1
    client.emit("joinWorkspace", { workspaceId });
  });

  client.on("joined", (data) => {
    console.log(`[${name}] Entrou na sala: ${data.room}`);
  });

  client.on("conflictWarning", (data) => {
    console.log(`\n🚨 [${name}] AVISO RECEBIDO (Para mim)!`);
    console.log(`Mensagem: ${data.message}`);
    console.log(`Conflitos detectados:`, data.conflictingIntents);
  });

  client.on("conflictAlert", (data) => {
    console.log(`\n⚠️ [${name}] ALERTA GERAL (Outro colega colidiu)!`);
    console.log(`Mensagem: ${data.message}`);
    console.log(`Nova Intenção:`, data.newIntent);
  });

  client.on("disconnect", () => {
    console.log(`[${name}] Desconectado`);
  });
}

setupClient(devA, "Dev A");
setupClient(devB, "Dev B");

// Simulação de fluxo
setTimeout(() => {
  console.log("\n--- [Dev A] começa a editar o validateToken ---");
  devA.emit("reportIntent", {
    workspaceId,
    intent: {
      userId: "user-dev-a",
      githubLogin: "Kaua-KGzin",
      branch: "feature/auth-refactor",
      filePathHash: "hash-src-auth-service",
      astNode: "validateToken",
    }
  });
}, 1000);

setTimeout(() => {
  console.log("\n--- [Dev B] começa a editar o validateToken em OUTRA branch ---");
  // Isso deve gerar um conflito, pois o filePathHash e astNode são iguais, mas o client ID é diferente
  devB.emit("reportIntent", {
    workspaceId,
    intent: {
      userId: "user-dev-b",
      githubLogin: "Outro-Dev",
      branch: "hotfix/login",
      filePathHash: "hash-src-auth-service",
      astNode: "validateToken",
    }
  });
}, 2000);

setTimeout(() => {
  console.log("\n--- Encerrando simulação ---");
  devA.disconnect();
  devB.disconnect();
  process.exit(0);
}, 3500);
