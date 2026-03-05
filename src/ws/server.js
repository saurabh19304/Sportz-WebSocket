import { WebSocket, WebSocketServer } from "ws";     //some error I fixed them with claude 

function sendJson(socket, payload){
    if(socket.readyState != WebSocket.OPEN) return;  //  readyState not ready
    socket.send(JSON.stringify(payload));
}

function broadcast(wss, payload){
    for(const client of wss.clients){   
        if(client.readyState != WebSocket.OPEN) continue;  // continue not return
        client.send(JSON.stringify(payload));
    }
}

export function attachWebsocketServer(server){
    const wss = new WebSocketServer({ server, path: '/ws', maxPayload: 1024 * 1024 });

    wss.on('connection', (socket) => {
        sendJson(socket, { type: 'welcome' });
        socket.on('error', console.error);
    });

    function broadcastMatchCreated(match){
        broadcast(wss, { type: 'match created', data: match })
    }

    return { broadcastMatchCreated }
}