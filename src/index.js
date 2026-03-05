import express from 'express';
import { matchRouter } from '../src/routes/matches.js';
import http from 'http';
import { attachWebsocketServer } from './ws/server.js';


const PORT = Number(process.env.PORT || 8000);
const HOST = process.env.HOST || '0.0.0.0';


const app = express();
app.use(express.json());
const server = http.createServer(app);

app.get('/', (req, res) => {
  res.send('hello from the server!');
});

const { broadcastMatchCreated } = attachWebsocketServer(server);
app.locals.broadcastMatchCreated = broadcastMatchCreated; 

app.use('/matches', matchRouter);

server.listen(PORT, HOST, () => {
 const baseUrl = HOST === '0.0.0.0' ? `http://localhost:${PORT}` : `http://${HOST}:${PORT}`;

  console.log(`server is running at ${baseUrl}`);
  console.log(`websocket server is running on ${baseUrl.replace('http', 'ws')}/ws`);
});