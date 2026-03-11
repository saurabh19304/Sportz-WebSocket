import { WebSocket, WebSocketServer } from "ws";    
import { wspArcjet as wsArcjet } from "../arcjet.js";


const matchSubscriber = new Map();

function subscribe(matchId, socket){
    if(!matchSubscriber.has(matchId)){
        matchSubscriber.set(matchId, new Set());
    }

    matchSubscriber.get(matchId).add(socket);
}

function unsubscribe(matchId, socket){
    const subscribers = matchSubscriber.get(matchId);

    if(!subscribers) return;

    subscribers.delete(socket); 

    if(subscribers.size === 0 ){
            matchSubscriber.delete(matchId);
    }
}

function cleanupSubscription(socket){
    for(const matchId of socket.subscriptions){
        unsubscribe(matchId, socket)
    }
}

function sendJson(socket, payload){
    if(socket.readyState !== WebSocket.OPEN) return;  
    socket.send(JSON.stringify(payload));
}


function broadcastToMatch(matchId , payload){
    const subscribers = matchSubscriber.get(matchId);
    if(!subscribers || subscribers.size ===  0 )  return ;

    const message = JSON.stringify(payload);

  for(const client of subscribers){
    if(client.readyState   === WebSocket.OPEN ){    
    client.send(message)
    }
  }

} 

function handleMessage(socket , data){
    let message;
    try {
        message = JSON.parse(data.toString())
    } catch {
        sendJson(socket, {type: 'error' , message: 'invalid json'})
    }

if(message ?.type  === 'subscribe' &&  Number.isInteger(message.matchId) ){

     subscribe(message.matchId , socket );
            socket.subscriptions.add(message.matchId);
            sendJson(socket , {type: 'subscribed', matchId: message.matchId })
            return;
}

if(message ?.type  === 'unsubscribe' &&  Number.isInteger(message.matchId) ){
    unsubscribe(message.matchId, socket);
    socket.subscriptions.delete(message.matchId);
    sendJson(socket, {type: 'unsubscribe' , message: message.matchId})
}
           
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

            socket.subscriptions = new Set();

        sendJson(socket, { type: 'welcome' });

        socket.on('message', (data) => {
                handleMessage(socket,data);
        });

        socket.on('error', () => {
            socket.terminate();
        });

        socket.on('close', () => [
            cleanupSubscription(socket)
        ])

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

    function broadcastCommentry(matchId, comment){
        broadcastToMatch(matchId, {type: 'commentry' , data: comment});
    }

    return { broadcastMatchCreated , broadcastCommentry }
}