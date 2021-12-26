const HashMap = require("hashmap");

class SocketListener {
    constructor(app) {
        this.app = app;
        this.sockets = new HashMap();
        this.tokens = new HashMap();
    }

    addSocket(socket, token) {
        this.sockets.set(token, socket);
        this.tokens.set(socket, token);

        console.log(this.sockets);
    }

    removeSocket(socket) {
        this.sockets.delete(this.tokens.get(socket));
        this.tokens.delete(socket);

        console.log(this.sockets);
    }

    removeToken(token) {
        this.tokens.delete(this.sockets.get(token));
        this.sockets.delete(token);

        console.log(this.sockets);
    }

    getSocket(token) {
        return this.sockets.get(token);
    }

    to(socket) {
        return this.app.io.to(socket);
    }
    async select(data, schema) {
        return (await this.app.db.select(data, schema));
    }

    async delete(data) {
        return (await this.app.db.delete(data));
    }

    async insert(data) {
        await this.app.db.insert(data);
    }

    async update(data) {
        return (await this.app.db.update(data));
    }
}

module.exports = SocketListener;