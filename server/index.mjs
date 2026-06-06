import { createApp } from "./app.mjs";

const port = Number(process.env.PORT || 4173);
const host = "127.0.0.1";
const server = createApp();

server.listen(port, host, () => {
  console.log(`AI, Geopolitics, and Legal Education workspace: http://${host}:${port}`);
});
