const { io } = require("socket.io-client");

// Simula dois desenvolvedores na mesma "sala" de workspace.
// O namespace exige o JWT do REST e que os dois sejam membros do workspace:
//   TOKEN_A=... TOKEN_B=... WORKSPACE_ID=... node scripts/simulate-ide-client.js
const { TOKEN_A, TOKEN_B, WORKSPACE_ID, API_URL = "http://localhost:3000" } = process.env;
if (!TOKEN_A || !TOKEN_B || !WORKSPACE_ID) {
  console.error("Defina TOKEN_A, TOKEN_B (JWT de dois membros) e WORKSPACE_ID.");
  process.exit(1);
}
const workspaceId = WORKSPACE_ID;

const devA = io(`${API_URL}/clairvoyance`, { auth: { token: TOKEN_A } });
const devB = io(`${API_URL}/clairvoyance`, { auth: { token: TOKEN_B } });

function setupClient(client, name) {
  client.on("connect", () => {
    console.log(`[${name}] Conectado com socket ID: ${client.id}`);
    // Ao conectar, entra na sala do Workspace 1
    client.emit("joinWorkspace", { workspaceId });
  });

  client.on("joined", (data) => {
    console.log(`[${name}] Entrou na sala: ${data.room}`);
  });

  client.on("denied", () => {
    console.log(`[${name}] Entrada negada: não é membro do workspace ${workspaceId}`);
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
    // userId/githubLogin vêm do token, não do payload.
    intent: {
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
