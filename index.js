var auth = require('./api/auth.js');
var dev = require('./api/dev.js');

var UserSync = require('./sockets/UserSync.js');

var db = require('./db/db.js');

var express = require('express');
var http = require('http');
var { Server } = require("socket.io");
const session = require('./api/session.js');
const Media = require('./media/media.js');
const Random = require('./utils/random.js');

var media = new Media();

var app = express();
var server = http.createServer(app);
var io = new Server(server);

app.db = new db();
app.io = io;
app.random = new Random();

app.use(express.json())

const registerRoute = (route) => {
    new route(app);
}

app.get("/", (req, res) => {
    res.send('working');
})

registerRoute(auth);
registerRoute(session);
registerRoute(dev);

let user_sync = new UserSync(app);

io.on("connect", socket => {
    socket.on('register', data => {
        user_id = data.user_id;
        user_sync.addSocket(data.socket, data.token, user_id);
    });

    socket.on('disconnect', () => {
        user_sync.removeSocket(socket.id);
    });
});

app.user_sync = user_sync;
app.media = media;

server.listen(process.env.PORT || 4000);
let d = new Date();