const http = require('http');
const WebSocket = require('ws');

function createMonitoringWebSocket(server, sessionMiddleware, isAllowedOrigin) {
    const wss = new WebSocket.Server({ noServer: true });
    server.on('upgrade', (req, socket, head) => {
        const reject = status => {
            socket.end(`HTTP/1.1 ${status}\r\nConnection: close\r\nContent-Length: 0\r\n\r\n`);
        };
        if (req.url.split('?')[0] !== '/monitoring-ws') return reject('404 Not Found');
        if (!isAllowedOrigin(req.headers.origin)) return reject('403 Forbidden');
        sessionMiddleware(req, new http.ServerResponse(req), error => {
            if (error || req.session?.user?.role !== 'admin') return reject('403 Forbidden');
            if (socket.destroyed) return;
            wss.handleUpgrade(req, socket, head, ws => wss.emit('connection', ws, req));
        });
    });
    return wss;
}

module.exports = { createMonitoringWebSocket };
