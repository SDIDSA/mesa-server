var auth = require('./api/auth.js');
var dev = require('./api/dev.js');

var express = require('express');
const db = require('./db/db.js');


var app = express();
app.db = new db();

app.use(express.json())

const registerRoute = (route) => {
    new route(app);
}

app.get("/", (req, res) => {
    res.send('working');
})

registerRoute(auth);
registerRoute(dev);

app.listen(4000);