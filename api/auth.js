const Route = require("./route.js");
const phoneUtil = require('google-libphonenumber').PhoneNumberUtil.getInstance();

const success = { status: "success" };
const incorrect_password = (key) => {
    return {
        status: "error",
        err: [{
            key,
            value: "incorrect_password"
        }]
    }
}

const checkEmail = (email) => {
    return /^\S+@\S+\.\S+$/.test(email);
}

const checkPhone = (phone) => {
    try {
        let number = phoneUtil.parse(phone);
        return phoneUtil.isValidNumber(number);
    } catch (err) {
        console.log(err);
        return false;
    }
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
        let id = this.app.random.random(8);

        while (this.checkId(id)) {
            id = this.app.random.random(8);
        }

        return id;
    }

    constructor(app) {
        super(app, "/auth");

        this.addEntry("login", async (req, res) => {
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

                let token = await this.app.user_sync.register(user.id);

                user.email_confirmed = (conf_rows.length == 0);
                res.send({
                    status: "success",
                    user,
                    token
                })
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

        this.addEntry("phone_own", async (req, res) => {
            let phone = req.body.phone;

            var err = [];

            if (checkPhone(phone) == false) {
                err.push({
                    key: "phone",
                    value: "phone_invalid"
                })
            } else {
                let rows = await this.select({
                    select: ["id"],
                    from: ["user"],
                    where: {
                        keys: ["phone"],
                        values: [phone]
                    }
                });
                if (rows.length > 0) {
                    err.push({
                        key: "phone",
                        value: "phone_used"
                    })
                }
            }

            if (err.length > 0) {
                res.send({ status: "error", err })
            } else {
                let code = this.app.random.phone_code(phone);
                //TODO ACTUALLY SEND CODE ??

                try {
                    await this.insert({
                        table: "phone_own",
                        keys: [
                            "phone",
                            "code"
                        ],
                        values: [
                            phone,
                            code
                        ]
                    });
                } catch (err) {
                    await this.update({
                        table: "phone_own",
                        cols: ["phone", "code"],
                        values: [phone, code],
                        where: {
                            keys: ["phone"],
                            values: [phone]
                        }
                    });
                }
                res.send(success);
            }
        });

        this.addEntry("verify_phone_own", async (req, res) => {
            let phone = req.body.phone;
            let code = req.body.code;

            let found = (await this.select({
                select: ["id"],
                from: ["phone_own"],
                where: {
                    keys: ["phone", "code"],
                    values: [phone, code],
                    op: ["AND"]
                }
            }));

            if (found.length == 1) {
                res.send(success);
            } else {
                res.send({
                    status: "error", err: [
                        {
                            key: "phone_code",
                            value: "verification_code_incorrect"
                        }
                    ]
                })
            }
        })

        this.addEntry("email_own", async (req, res) => {
            let email = req.body.email;

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

            if (err.length > 0) {
                res.send({ status: "error", err })
            } else {
                res.send(success);
            }
        });

        this.addEntry("username_own", async (req, res) => {
            let username = req.body.username;
            let password = req.body.password;

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

            if (password.length < 6) {
                err.push({
                    key: "password",
                    value: "password_short"
                })
            }

            if (err.length > 0) {
                res.send({ status: "error", err })
            } else {
                res.send(success);
            }
        });

        this.addEntry("register", async (req, res) => {
            let email = req.body.email;
            let phone = req.body.phone;
            let phone_code = req.body.phone_code;
            let username = req.body.username;
            let password = req.body.password;
            let birth_date = req.body.birth_date;

            var err = [];

            if (email) {
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
            } else if (phone) {
                if (checkPhone(phone) == false) {
                    err.push({
                        key: "phone",
                        value: "phone_invalid"
                    })
                } else {
                    let rows = await this.select({
                        select: ["id"],
                        from: ["user"],
                        where: {
                            keys: ["phone"],
                            values: [phone]
                        }
                    });
                    if (rows.length > 0) {
                        err.push({
                            key: "phone",
                            value: "phone_used"
                        })
                    }

                    let found = (await this.select({
                        select: ["id"],
                        from: ["phone_own"],
                        where: {
                            keys: ["phone", "code"],
                            values: [phone, phone_code],
                            op: ["AND"]
                        }
                    }));
                    if (found.length == 0) {
                        err.push({
                            key: "phone",
                            value: "verification_code_incorrect"
                        });
                    }
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
                res.send({ status: "error", err })
            } else {
                await this.delete({
                    from: "phone_own",
                    where: {
                        keys: ["phone"],
                        values: [phone]
                    }
                });
                let id = this.generateUniqueId();
                let avatar = await app.media.generateAvatar(id);
                this.insert({
                    table: "user",
                    keys: [
                        "id",
                        phone ? "phone" : "email",
                        "username",
                        "password",
                        "birth_date",
                        "avatar"
                    ],
                    values: [
                        id,
                        phone ? phone : email,
                        username,
                        password,
                        birth_date,
                        avatar
                    ]
                })
                res.send(success);
            }
        });

        this.addEntry('verify', async (req, res) => {
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
                res.send(success);
                this.app.user_sync.notify(user_id, { email_confirmed: true });
            }
        })

        this.addEntry('editUsername', async (req, res) => {
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
                    res.send(success);
                    this.app.user_sync.notify(user_id, { username });
                } else {
                    res.send(incorrect_password("current_password"));
                }
            }
        });

        this.addEntry('editEmail', async (req, res) => {
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
                    let code = this.app.random.conf_code(8);
                    try {
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
                    } catch (err) {
                        await this.update({
                            table: "email_confirm",
                            cols: ["code"],
                            values: [code],
                            where: {
                                keys: ["user_id"],
                                values: [user_id]
                            }
                        });
                    }

                    res.send(success);
                    this.app.user_sync.notify(user_id, { email, email_confirmed: false });
                } else {
                    res.send(incorrect_password("current_password"));
                }
            }
        });

        this.addEntry("sendPhoneCode", async (req, res) => {
            let user_id = req.body.user_id;
            let phone = req.body.phone;

            let rows = await this.select({
                select: ["id"],
                from: ["user"],
                where: {
                    keys: ["phone"],
                    values: [phone]
                }
            });

            if (rows.length != 0) {
                res.send({ err: "phone_used" });
            } else {
                let code = this.app.random.conf_code(6);

                try {
                    await this.insert({
                        table: "phone_confirm",
                        keys: [
                            "user_id",
                            "code",
                            "phone"
                        ],
                        values: [
                            user_id,
                            code,
                            phone
                        ]
                    });
                } catch (err) {
                    await this.update({
                        table: "phone_confirm",
                        cols: ["code", "phone"],
                        values: [code, phone],
                        where: {
                            keys: ["user_id"],
                            values: [user_id]
                        }
                    });
                }

                res.send(success);
            }
        });

        this.addEntry("verifyPhone", async (req, res) => {
            let user_id = req.body.user_id;
            let phone = req.body.phone;
            let code = req.body.code;

            let count = await this.update({
                table: "phone_confirm",
                cols: ["code"],
                values: ["true"],
                where: {
                    keys: ["user_id", "code", "phone"],
                    values: [user_id, code, phone],
                    op: ["AND", "AND"]
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
                res.send(success)
            }
        });

        this.addEntry("finalizePhone", async (req, res) => {
            let user_id = req.body.user_id;
            let password = req.body.password;

            let phone = (await this.select({
                select: ["phone"],
                from: ["phone_confirm"],
                where: {
                    keys: ["user_id", "code"],
                    values: [user_id, "true"],
                    op: ["AND"]
                }
            }))[0].phone;

            console.log(phone);

            let count = await this.update({
                table: "user",
                cols: ["phone"],
                values: [phone],
                where: {
                    keys: ["id", "password"],
                    values: [user_id, password],
                    op: ["AND"]
                }
            });

            if (count == 1) {
                res.send(success);
                this.app.user_sync.notify(user_id, { phone });
                await this.delete({
                    from: "phone_confirm",
                    where: {
                        keys: ["user_id"],
                        values: [user_id]
                    }
                });
            } else {
                res.send(incorrect_password("password"));
            }
        });

        this.addEntry("removePhone", async (req, res) => {
            let user_id = req.body.user_id;
            let password = req.body.password;

            let count = await this.update({
                table: "user",
                cols: ["phone"],
                values: [""],
                where: {
                    keys: ["id", "password"],
                    values: [user_id, password],
                    op: ["AND"]
                }
            });

            if (count == 1) {
                res.send(success);
                this.app.user_sync.notify(user_id, { phone: "" });
            } else {
                res.send(incorrect_password("password"));
            }
        });

        this.addEntry("changePassword", async (req, res) => {
            let user_id = req.body.user_id;
            let curr_pass = req.body.curr_pass;
            let new_pass = req.body.new_pass;

            var err = [];

            if (err.length > 0) {
                res.send({ err })
            } else {
                let count = await this.update({
                    table: "user",
                    cols: ["password"],
                    values: [new_pass],
                    where: {
                        keys: ["id", "password"],
                        values: [user_id, curr_pass],
                        op: ["AND"]
                    }
                });

                if (count == 1) {
                    res.send(success)
                } else {
                    res.send(incorrect_password("current_password"));
                }
            }
        });

        this.addEntry("deleteAccount", async (req, res) => {
            let user_id = req.body.user_id;
            let password = req.body.password;

            let count = await this.delete({
                from: "user",
                where: {
                    keys: ["id", "password"],
                    values: [user_id, password],
                    op: ["AND"]
                }
            }, "avatar");

            if (count.length == 1) {
                res.send(success);
                let avatar = count[0].avatar;
                let avatar_id = avatar.substring(avatar.lastIndexOf("/") + 1).split(".")[0];
                app.media.deleteAsset(avatar_id);
            } else {
                res.send(incorrect_password("password"));
            }
        });
    }
}

module.exports = Auth;