const Route = require("./route.js");

const success = { status: "success" };
class Session extends Route {
    constructor(app) {
        super(app, "/session");

        this.addEntry("getUser", async(req, res) => {
            let token = req.header("token");

            let user_id = (await this.select({
                select: ["user_id"],
                from: ["session"],
                where: {
                    keys: ["token"],
                    values: [token]
                }
            }))[0].user_id;

            let user = (await this.select({
                select: ["*"],
                from: ["user"],
                where: {
                    keys: ["id"],
                    values: [user_id]
                }
            }))[0];

            user.email_confirmed = (await this.select({
                select: ["*"],
                from: ["email_confirm"],
                where: {
                    keys: ["user_id"],
                    values: [user_id]
                }
            })).length == 0;

            res.send({ user });
        });

        this.addEntry("logout", async(req, res) => {
            let token = req.header("token");

            let user_id = req.body.user_id;

            await this.app.user_sync.unregister(user_id, token);
            this.app.user_sync.removeToken(token);

            res.send(success);
        })
    }
}

module.exports = Session;