const Route = require("./route.js");
const Form = require('formidable').IncomingForm;
const sharp = require("sharp");

const templates = {
    default: [{
        name: "Text Channels",
        channels: [{
            name: "general",
            type: "text"
        }]
    }, {
        name: "Voice Channels",
        channels: [{
            name: "General",
            type: "audio"
        }]
    }],
    gaming: [{
        name: "Text Channels",
        channels: [{
                name: "general",
                type: "text"
            },
            {
                name: "clips-and-highlights",
                type: "text"
            }
        ]
    }, {
        name: "Voice Channels",
        channels: [{
            name: "Lobby",
            type: "audio"
        }, {
            name: "Gaming",
            type: "audio"
        }]
    }]
}

const success = { status: "success" };
const bad_session = { err: "bad_session" };
class Session extends Route {
    constructor(app) {
        super(app, "/session");

        this.addEntry("getUser", async(req, res, user_id) => {
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

        this.addEntry("getUserForId", async(req, res) => {
            let user_id = req.body.user_id;
            let user = (await this.select({
                select: ["username", "avatar"],
                from: ["user"],
                where: {
                    keys: ["id"],
                    values: [user_id]
                }
            }))[0];

            user.online = this.app.user_sync.isOnline(user_id);

            res.send({ user });
        });

        this.addEntry("logout", async(req, res, user_id, token) => {
            await this.app.user_sync.unregister(user_id, token);
            this.app.user_sync.removeToken(token);

            res.send(success);
        })

        this.addEntry("createServer", async(req, res, user_id) => {
            var form = new Form();
            form.parse(req, async(err, fields, files) => {
                let name = fields.name;
                let template = fields.template;
                let audience = fields.audience;

                let icon = files.icon;
                let resized = icon.filepath + "_resized.jpg";

                // resize/crop icon
                await sharp(icon.filepath)
                    .resize(256, 256, {
                        kernel: sharp.kernel.lanczos3,
                        fit: 'cover',
                        position: 'center'
                    }).toFile(resized);

                // upload icon to cloudinary
                let url = await this.app.media.uploadFile(resized, {
                    public_id: "server_" + this.app.random.random(16)
                });

                // insert server to DB
                let id = (await this.insert({
                    table: "server",
                    keys: [
                        "owner",
                        "name",
                        "icon"
                    ],
                    values: [
                        user_id,
                        name,
                        url
                    ]
                }, "id")).rows[0].id;

                let order = (await this.insert({
                    table: "member",
                    keys: [
                        '"user"',
                        "server"
                    ],
                    values: [
                        user_id,
                        id
                    ]
                }, '"order"')).rows[0].order;

                res.send(success);

                // apply template
                let temp = templates[template];
                for (let i = 0; i < temp.length; i++) {
                    let group = temp[i];

                    let group_id = (await this.insert({
                        table: "channel_group",
                        keys: [
                            "server",
                            "name"
                        ],
                        values: [
                            id,
                            group.name
                        ]
                    }, "id")).rows[0].id;

                    for (let j = 0; j < group.channels.length; j++) {
                        let channel = group.channels[j];

                        await this.insert({
                            table: "channel",
                            keys: [
                                '"group"',
                                "name",
                                "type"
                            ],
                            values: [
                                group_id,
                                channel.name,
                                channel.type
                            ]
                        });
                    }
                }

                this.app.user_sync.emit(user_id, "join_server", { id, order });

            });
        });

        this.addEntry("getServers", async(req, res, user_id) => {
            let servers = (await this.select({
                select: ["server", '"order"'],
                from: ["member"],
                where: {
                    keys: ['"user"'],
                    values: [user_id]
                }
            }));

            res.send({ servers });
        });

        this.addEntry("getServer", async(req, res, user_id) => {
            let server_id = req.body.server_id;

            if (!server_id) {
                res.send({ err: "missing param server_id" })
                return;
            }

            let server = (await this.select({
                select: ["*"],
                from: ["server"],
                where: {
                    keys: ["id"],
                    values: [server_id]
                }
            }))[0];

            if (!server) {
                res.send({ err: "server with id = " + server_id + " doesn't exist" })
                return;
            }

            server.groups = await this.select({
                select: ["id", "name"],
                from: ["channel_group"],
                where: {
                    keys: ["server"],
                    values: [server_id]
                }
            });

            for (let i = 0; i < server.groups.length; i++) {
                let group = server.groups[i];
                group.channels = await this.select({
                    select: ["id", "name", "type"],
                    from: ["channel"],
                    where: {
                        keys: ['"group"'],
                        values: [group.id]
                    }
                });

                for (let j = 0; j < group.channels.length; j++) {
                    let channel = group.channels[j];

                    //select * from public.message where type='text' and channel=314 order by time desc limit 1;

                    let last = (await this.select({
                        select: ["id", "sender"],
                        from: ["message"],
                        where: {
                            keys: ["channel", "type"],
                            values: [channel.id, "text"],
                            op: ["AND"]
                        },
                        order: "time desc",
                        limit: "1"
                    }));

                    if (last.length == 0 || last[0].sender === user_id) {
                        channel.unread = false;
                    } else {
                        let last_id = last[0].id;
                        let found = await this.select({
                            select: ["id"],
                            from: ["message"],
                            where: {
                                keys: ["id>", "type", "sender"],
                                values: [last_id, "seen", user_id],
                                op: ["AND", "AND"]
                            }
                        });
                        channel.unread = (found.length == 0);
                    }
                }
            }

            server.members = (await this.select({
                select: ['"user"'],
                from: ["member"],
                where: {
                    keys: ["server"],
                    values: [server_id]
                }
            })).map(row => row.user);
            res.send({ server })
        });

        this.addEntry("createInvite", async(req, res, user_id, token) => {
            let server_id = req.body.server_id;

            let invite_id = this.app.random.veryRandom(8);

            await this.insert({
                table: "invite",
                keys: [
                    "id",
                    "server"
                ],
                values: [
                    invite_id,
                    server_id
                ]
            });

            res.send({ invite_id });
        });

        this.addEntry("joinWithInvite", async(req, res, user_id, token) => {
            let invite_code = req.body.invite_code;

            let servers = await this.select({
                select: ["server"],
                from: ["invite"],
                where: {
                    keys: ["id"],
                    values: [invite_code]
                }
            });

            if (servers.length != 0) {
                let server = servers[0].server;
                let order = (await this.insert({
                    table: "member",
                    keys: [
                        '"user"',
                        "server"
                    ],
                    values: [
                        user_id,
                        server
                    ]
                }, '"order"')).rows[0].order;

                this.app.user_sync.emit(user_id, "join_server", { id: server, order });
                res.send(success);
            } else {
                res.send({
                    err: [{
                        key: "invite_link",
                        value: "invalid_invite"
                    }]
                });
            }
        });

        this.addEntry("sendMessage", async(req, res, user_id) => {
            let sender = user_id;
            let content = req.body.content;
            let channel = req.body.channel;
            let server = req.body.server;
            let time = this.formatDate(new Date());

            let id = (await this.insert({
                table: "message",
                keys: [
                    "sender",
                    "channel",
                    "type",
                    "content",
                    "time"
                ],
                values: [
                    sender,
                    channel,
                    "text",
                    content,
                    time
                ]
            }, "id")).rows[0].id;

            setTimeout(async() => {
                res.send({
                    id,
                    time
                });

                this.app.user_sync.emitServer(server, "message", {
                    id,
                    sender,
                    channel: parseInt(channel),
                    type: "text",
                    content,
                    time
                });
            }, 200);

        });

        this.addEntry("seen", async(req, res, user_id) => {
            let channel = req.body.channel;
            let time = this.formatDate(new Date());

            await this.delete({
                from: "message",
                where: {
                    keys: ["sender", "channel", "type"],
                    values: [user_id, channel, "seen"],
                    op: ["AND", "AND"]
                }
            });

            (await this.insert({
                table: "message",
                keys: [
                    "sender",
                    "channel",
                    "type",
                    "content",
                    "time"
                ],
                values: [
                    user_id,
                    channel,
                    "seen",
                    "",
                    time
                ]
            }));

            res.send(success);
        });

        this.addEntry("deleteChannel", async(req, res) => {
            let server = parseInt(req.body.server);
            let channel = parseInt(req.body.channel);

            await this.delete({
                from: "channel",
                where: {
                    keys: ["id"],
                    values: [channel]
                }
            });

            res.send(success)

            this.app.user_sync.emitServer(server, "delete_channel", { server, channel })
        });

        this.addEntry("createChannel", async(req, res) => {
            let server = parseInt(req.body.server);
            let group = parseInt(req.body.group);
            let name = req.body.name;
            let type = req.body.type;

            let id = (await this.insert({
                table: "channel",
                keys: [
                    '"group"',
                    "name",
                    "type"
                ],
                values: [
                    group,
                    name,
                    type
                ]
            }, "id")).rows[0].id;

            res.send(success);

            this.app.user_sync.emitServer(server, "create_channel", { channel: { id, name, type }, group, server });
        })

        this.addEntry("getMessages", async(req, res, user_id) => {
            let channel = req.body.channel;

            let data = await this.select({
                select: ["*"],
                from: ["message"],
                where: {
                    keys: ['channel'],
                    values: [channel]
                }
            });

            res.send({ data });
        });
    }

    addEntry(name, handler) {
        super.addEntry(name, async(req, res) => {
            let token = req.header("token");
            try {
                let user_id = (await this.select({
                    select: ["user_id"],
                    from: ["session"],
                    where: {
                        keys: ["token"],
                        values: [token]
                    }
                }))[0].user_id;

                handler(req, res, user_id, token);
            } catch (err) {
                res.send(bad_session);
            }
        });
    }
}

module.exports = Session;