const { Pool } = require('pg');

const lay = (arr, pre, post) => {
    let res = "";
    arr.forEach((el, i) => {
        if (i != 0) {
            res += ", ";
        }
        res += (pre ? pre : "") + el + (post ? post : "");
    })
    return res;
}

const layJoin = (cond, schema) => {
    schema = (schema ? schema : "public") + ".";
    return schema + cond.from[0] + "." + cond.from[1] + " = " + schema + cond.to[0] + "." + cond.to[1];
}

const preLayWhere = (where, count) => {
    var count = { v: count ? count : 0 };
    return laywhere(where.keys, where.values, where.op, count);
}

const laywhere = (keys, values, op, count) => {
    let res = "";
    keys.forEach((key, ind) => {
        if (ind != 0) {
            let o = op[ind - 1];
            res += " " + (o.forEach ? o[o.length - 1] : o) + " ";
        }
        if (key.forEach) {
            res += "(" + laywhere(key, values[ind], op[ind], count) + ")";
        } else {
            res += key + "=$" + ((count.v++) + 1);
        }
    });
    return res;
}

class db {
    constructor() {
        const extractData = (url) => {
            let arr = url.split(':');
            let sec = arr[2].split('@');
            let third = arr[3].split('/');
            return {
                username: arr[1].replace('//', ''),
                password: sec[0],
                host: sec[1],
                port: parseInt(third[0]),
                database: third[1]
            };
        }

        let data = extractData(process.env.DATABASE_URL || 'postgres://postgres:8520@localhost:5432/mesa');

        console.log("database connection : success");

        this.db = new Pool({
            user: data.username,
            host: data.host,
            database: data.database,
            password: data.password,
            port: data.port,
            ssl: process.env.DATABASE_URL ? true : false
        });
    }

    async select(data, schema) {
        let query = "SELECT ";
        query += lay(data.select);
        query += " FROM " + lay(data.from, (schema ? schema : "public") + ".");

        if (data.where) {
            query += " WHERE ";
            query += preLayWhere(data.where);
        }

        if (data.join) {
            data.join.forEach((cond, ind) => {
                query += " AND ";
                query += layJoin(cond, schema);
            })
        }

        if (data.order) {
            query += " ORDER BY " + data.order;
        }

        if (data.limit) {
            query += " LIMIT " + data.limit;
        }

        console.log({ query, values: data.where ? data.where.values : [] });

        let res = (await this.db.query(query, data.where ? data.where.values : [])).rows;
        //console.log(res); //DEBUG
        return res;
    }

    async delete(data) {
        let query = "WITH deleted AS (delete ";
        query += " FROM public." + data.from;

        if (data.where) {
            query += " WHERE ";
            query += preLayWhere(data.where);
        }

        query += " IS TRUE RETURNING *) SELECT count(*) FROM deleted"

        //console.log({ query, values: data.where.values });
        let res = (await this.db.query(query, data.where.values)).rows;
        //console.log(res); //DEBUG
        return res[0].count;
    }

    async insert(data, returning) {
        let query = "INSERT INTO public." + data.table + " (";
        data.keys.forEach((key, i) => {
            if (i != 0) {
                query += ", ";
            }
            query += key;
        });
        query += ") VALUES (";
        data.keys.forEach((key, i) => {
            if (i != 0) {
                query += ", ";
            }
            query += "$" + (i + 1);
        });
        query += ")";
        if (returning) {
            query += " RETURNING " + returning;
        }
        //console.log({ query, values: data.values });
        let res = await this.db.query(query, data.values);
        //console.log(res);
        return res;
    }

    async update(data) {
        let query = "UPDATE public." + data.table + " SET ";

        data.cols.forEach((col, i) => {
            if (i != 0) {
                query += ", ";
            }
            query += col + "=$" + (i + 1);
        });

        if (data.where) {
            query += " WHERE ";
            query += preLayWhere(data.where, data.cols.length);
        }

        let vals = data.values;
        if (data.where) {
            vals = vals.concat(data.where.values);
        }

        //console.log({ query, values: vals });
        let res = await this.db.query(query, vals);
        return res.rowCount;
    }
}

module.exports = db;