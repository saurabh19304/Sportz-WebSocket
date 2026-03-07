import { WebSocket, WebSocketServer } from "ws";    
import { wspArcjet as wsArcjet } from "../arcjet.js";


function sendJson(socket, payload){
    if(socket.readyState !== WebSocket.OPEN) return;  
    socket.send(JSON.stringify(payload));
}

function broadcast(wss, payload){
    for(const client of wss.clients){   
        if(client.readyState !== WebSocket.OPEN) continue;  
        client.send(JSON.stringify(payload));
    }
}

export function attachWebsocketServer(server){
    const wss = new WebSocketServer({ noServer: true, maxPayload: 1024 * 1024 });

    server.on('upgrade', async (req, socket, head) => {
        const { pathname } = new URL(req.url, 'http://localhost');
        if (pathname !== '/ws') {
            socket.write('HTTP/1.1 404 Not Found\r\nConnection: close\r\n\r\n');
            socket.destroy();
            return;
        }

        if (wsArcjet) {
            try {
                const decision = await wsArcjet.protect(req);

                if (decision.isDenied()) {
                    const statusLine = decision.reason.isRateLimit()
                        ? 'HTTP/1.1 429 Too Many Requests'
                        : 'HTTP/1.1 403 Forbidden';
                    socket.write(`${statusLine}\r\nConnection: close\r\n\r\n`);
                    socket.destroy();
                    return;
                }
            } catch (e) {
                console.error('WS upgrade error', e);
                socket.write('HTTP/1.1 500 Internal Server Error\r\nConnection: close\r\n\r\n');
                socket.destroy();
                return;
            }
        }

        wss.handleUpgrade(req, socket, head, (ws) => {
            wss.emit('connection', ws, req);
        });
    });

    wss.on('connection', (socket, req) => {
        socket.isAlive = true;
        socket.on('pong', () => {
            socket.isAlive = true;
        });

        sendJson(socket, { type: 'welcome' });
        socket.on('error', console.error);
    });

    const interval = setInterval( () => {

      wss.clients.forEach((ws) => {
        if(ws.isAlive === false) return ws.terminate();
        ws.isAlive = false;
        ws.ping();
      });

    }, 3000)

    wss.on('close', () => clearInterval(interval))

    function broadcastMatchCreated(match){
        broadcast(wss, { type: 'match_created', data: match })
    }

    return { broadcastMatchCreated }
}