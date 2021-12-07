const HashMap = require("hashmap");

class SocketListener {
    constructor(app) {
        this.app = app;
        this.listeners = new HashMap();
    }

    addListener(name, handler) {
        console.log("registering socket listener [" + name + "]");
        this.listeners.set(name, handler);
    }

    addSocket(socket) {
        this.listeners.forEach((handler, name) => {
            socket.on(name, handler);
        });
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