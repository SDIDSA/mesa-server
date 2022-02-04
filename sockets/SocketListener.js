const HashMap = require("hashmap");

class SocketListener {
    constructor(app) {
        this.app = app;
        this.sockets = new HashMap();
        this.tokens = new HashMap();
        this.online = new HashMap();
    }

    addSocket(socket, token, user_id) {
        this.sockets.set(token, socket);
        this.tokens.set(socket, token);

        let onlineTokens = this.online.get(user_id);

        if (!onlineTokens) {
            onlineTokens = [];
            this.online.set(user_id, onlineTokens);
        }

        onlineTokens.push(token);

        console.log(JSON.stringify(this.online));
    }

    removeSocket(socket) {
        let token = this.tokens.get(socket);

        this.sockets.delete(token);
        this.tokens.delete(socket);

        this.removeOnline(token);
    }

    removeToken(token) {
        this.tokens.delete(this.sockets.get(token));
        this.sockets.delete(token);

        this.removeOnline(token);
    }

    removeOnline(token) {
        for (let i = 0; i < this.online.count(); i++) {
            let entry = this.online.entries()[i];
            let key = entry[0];
            let value = entry[1];

            for (let j = 0; j < value.length; j++) {
                if (token === value[j]) {
                    value.splice(j, 1);

                    if (value.length == 0) {
                        this.online.delete(key);
                    }
                    console.log(JSON.stringify(this.online));
                    return;
                }
            }
        }
    }

    isOnline(user_id) {
        return this.online.has(user_id);
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