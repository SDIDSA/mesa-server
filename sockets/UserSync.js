const SocketListener = require("./SocketListener.js");

const crypto = require('crypto');

class UserSync extends SocketListener {
    constructor(app) {
        super(app);
    }

    async register(user_id) {
        let token = crypto.randomBytes(24).toString("base64");

        await this.insert({
            table: "session",
            keys: [
                "user_id",
                "token"
            ],
            values: [
                user_id,
                token
            ]
        });

        return token;
    }

    async unregister(user_id, token) {
        await this.delete({
            from: "session",
            where: {
                keys: [
                    "user_id",
                    "token"
                ],
                values: [
                    user_id,
                    token
                ],
                op: ["AND"]
            }
        });
    }

    async notify(user_id, change) {
        this.emit(user_id, "user_sync", change);
    }

    async emit(user_id, event, data) {
        let tokens = (await this.select({
            select: ["token"],
            from: ["session"],
            where: {
                keys: ["user_id"],
                values: [user_id]
            }
        }));

        tokens.forEach(token => {
            let socket = this.getSocket(token.token);
            this.to(socket).emit(event, data);
        });
    }

    async emitServer(server, route, event, data) {
        (await route.select({
            select: ['"user"'],
            from: ["member"],
            where: {
                keys: ["server"],
                values: [server]
            }
        })).map(row => row.user).forEach(user => {
            this.emit(user, event, data);
        });
    }
}

module.exports = UserSync;