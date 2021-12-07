var auth = require('./api/auth.js');
var dev = require('./api/dev.js');

var UserSync = require('./sockets/UserSync.js');

var db = require('./db/db.js');

var express = require('express');
var http = require('http');
var { Server } = require("socket.io");


var app = express();
var server = http.createServer(app);
var io = new Server(server);

app.db = new db();
app.io = io;

app.use(express.json())

const registerRoute = (route) => {
    new route(app);
}

const socketListeners = [];
const registerSocketListener = (socketListener) => {
    let sl = new socketListener(app);
    socketListeners.push(sl);
}

io.on("connect", socket => {
    socketListeners.forEach(sl => {
        sl.addSocket(socket);
    })
});

app.get("/", (req, res) => {
    res.send('working');
})

registerRoute(auth);
registerRoute(dev);

let user_sync = new UserSync(app);
socketListeners.push(user_sync);

app.user_sync = user_sync;

server.listen(4000);