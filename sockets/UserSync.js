const SocketListener = require("./SocketListener.js");

const HashMap = require('hashmap');

class UserSync extends SocketListener {
    constructor(app) {
        super(app);

        this.sockets = new HashMap();
    }

    register_socket(user_id, socket) {
        let user_sockets = this.sockets.get(user_id);
        if (!user_sockets) {
            user_sockets = [];
            this.sockets.set(user_id, user_sockets);
        }
        user_sockets.push(socket);
    }

    notify(user_id, change) {
        this.sockets.get(user_id).forEach(socket => {
            this.to(socket).emit("user_sync", change);
        });
    }
}

module.exports = UserSync;