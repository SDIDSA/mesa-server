const Route = require("./route.js");

const success = { status: "success" };

const checkEmail = (email) => {
    return /^\S+@\S+\.\S+$/.test(email);
}

var chars = "abcdefghijklmnopqrstuvwxyz";
chars += "0123456789";
const random = (length) => {
    let res = "";
    for (let i = 0; i < length; i++) {
        res += chars.charAt(parseInt(Math.random() * chars.length));
    }
    return res;
}

const checkDate = (date) => {
    let parts = date.split("/");
    let d = parseInt(parts[0]);
    let m = parseInt(parts[1]) - 1;
    let y = parseInt(parts[2]);

    let dd = new Date(y, m, d);

    return dd.getDate() == d && dd.getMonth() == m;
}

var allowed = "abcdefghijklmnopqrstuvwxyz";
allowed = allowed + allowed.toUpperCase();
allowed = allowed + "0123456789_."
const checkUsername = (username) => {
    for (let i = 0; i < username.length; i++) {
        let c = username[i];
        if (allowed.indexOf(c) == -1) {
            return c;
        }
    }
    return null;
}

class Auth extends Route {
    checkId(id) {
        return this.select({
            select: ["*"],
            from: ["user"],
            where: {
                keys: ["id"],
                values: [id]
            }
        }).length > 0;
    }

    generateUniqueId() {
        let id = random(8);

        while (this.checkId(id)) {
            id = random(8);
        }

        return id;
    }

    constructor(app) {
        super(app, "/auth");

        this.addEntry("login", async(req, res) => {
            let email_phone = req.body.email_phone;
            let password = req.body.password;

            let rows = await this.select({
                select: ["*"],
                from: ["user"],
                where: {
                    keys: ["password", ["email", "phone"]],
                    values: [password, email_phone, email_phone.charAt(0) === "0" ? email_phone.substring(1) : email_phone],
                    op: ["AND", ["OR", "AND"]]
                }
            });

            if (rows.length == 1) {
                let user = rows[0];
                let conf_rows = await this.select({
                    select: ["*"],
                    from: ["email_confirm"],
                    where: {
                        keys: ["user_id"],
                        values: [user.id]
                    }
                });

                if (conf_rows.length == 1) {
                    user.email_confirmed = false;
                    res.send({
                        next: "verify",
                        user
                    })
                } else {
                    user.email_confirmed = true;
                    res.send({
                        next: "success",
                        user
                    })
                }
            } else {
                let er = "login_invalid";
                res.send({
                    err: [{
                        key: "email_phone",
                        value: er
                    }, {
                        key: "password",
                        value: er
                    }]
                })
            }
        });

        this.addEntry("register", async(req, res) => {
            let email = req.body.email;
            let username = req.body.username;
            let password = req.body.password;
            let birth_date = req.body.birth_date;

            var err = [];

            if (checkEmail(email) == false) {
                err.push({
                    key: "email",
                    value: "email_invalid"
                })
            } else {
                let rows = await this.select({
                    select: ["id"],
                    from: ["user"],
                    where: {
                        keys: ["email"],
                        values: [email]
                    }
                });
                if (rows.length > 0) {
                    err.push({
                        key: "email",
                        value: "email_used"
                    })
                }
            }


            if (checkDate(birth_date) == false) {
                err.push({
                    key: "birth_date",
                    value: "birth_date_invalid"
                })
            }

            if (username.length < 4) {
                err.push({
                    key: "username",
                    value: "username_short"
                })
            }

            let usernameCheck = checkUsername(username);
            if (usernameCheck) {
                err.push({
                    key: "username",
                    value: "username_invalid_char",
                    plus: usernameCheck
                })
            }

            if (err.length > 0) {
                res.send({ err })
            } else {
                this.insert({
                    table: "user",
                    keys: [
                        "id",
                        "email",
                        "username",
                        "password",
                        "birth_date"
                    ],
                    values: [
                        this.generateUniqueId(),
                        email,
                        username,
                        password,
                        birth_date
                    ]
                })
                res.send({ status: "success" });
            }
        });

        this.addEntry('verify', async(req, res) => {
            let user_id = req.body.user_id;
            let code = req.body.verification_code;
            let count = await this.delete({
                from: "email_confirm",
                where: {
                    keys: ["user_id", "code"],
                    values: [user_id, code],
                    op: ["AND"]
                }
            });
            if (count == 0) {
                res.send({
                    err: [{
                        key: "verification_code",
                        value: "verification_code_incorrect"
                    }]
                });
            } else {
                res.send({
                    user_id,
                    code
                })
            }
        })

        this.addEntry('editUsername', async(req, res) => {
            let user_id = req.body.user_id;
            let username = req.body.username;
            let password = req.body.password;

            if (!user_id || !username || !password) {
                res.send({
                    err: [{
                        key: "global",
                        value: "missing params, (required = [user_id:text, username:text, password:text])"
                    }]
                })
                return;
            }

            var err = [];
            if (username.length < 4) {
                err.push({
                    key: "username",
                    value: "username_short"
                })
            }

            let usernameCheck = checkUsername(username);
            if (usernameCheck) {
                err.push({
                    key: "username",
                    value: "username_invalid_char",
                    plus: usernameCheck
                })
            }

            if (err.length > 0) {
                res.send({ err })
            } else {
                let count = await this.update({
                    table: "user",
                    cols: ["username"],
                    values: [username],
                    where: {
                        keys: ["id", "password"],
                        values: [user_id, password],
                        op: ["AND"]
                    }
                });

                if (count == 1) {
                    res.send({ status: "success" })
                } else {
                    res.send({
                        err: [{
                            key: "current_password",
                            value: "incorrect_password"
                        }]
                    })
                }
            }
        });

        this.addEntry('editEmail', async(req, res) => {
            let user_id = req.body.user_id;
            let email = req.body.email;
            let password = req.body.password;

            if (!user_id || !email || !password) {
                res.send({
                    err: [{
                        key: "global",
                        value: "missing params, (required = [user_id:text, email:text, password:text])"
                    }]
                })
                return;
            }

            var err = [];

            if (checkEmail(email) == false) {
                err.push({
                    key: "email_address",
                    value: "email_invalid"
                })
            } else {
                let rows = await this.select({
                    select: ["id"],
                    from: ["user"],
                    where: {
                        keys: ["email"],
                        values: [email]
                    }
                });
                if (rows.length > 0) {
                    err.push({
                        key: "email_address",
                        value: "email_used"
                    })
                }
            }

            if (err.length > 0) {
                res.send({ err })
            } else {
                await this.delete({
                    from: "email_confirm",
                    where: {
                        keys: ["user_id"],
                        values: [user_id]
                    }
                });
                let count = await this.update({
                    table: "user",
                    cols: ["email"],
                    values: [email],
                    where: {
                        keys: ["id", "password"],
                        values: [user_id, password],
                        op: ["AND"]
                    }
                });

                if (count == 1) {
                    let code = (await this.select({
                        select: ["generate_confirmation_code as code"],
                        from: ["generate_confirmation_code(8)"]
                    }))[0].code;

                    await this.insert({
                        table: "email_confirm",
                        keys: [
                            "user_id",
                            "code"
                        ],
                        values: [
                            user_id,
                            code
                        ]
                    });
                    res.send({ status: "success" })
                } else {
                    res.send({
                        err: [{
                            key: "current_password",
                            value: "incorrect_password"
                        }]
                    })
                }
            }
        });
    }
}

module.exports = Auth;