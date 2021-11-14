class Route {
    constructor(app, path) {
        console.log("adding route " + path);
        this.app = app;
        this.path = path;
    }

    addEntry(name, handler) {
        let ent = this.path + "/" + name;
        console.log("adding path  " + ent);
        this.app.post(ent, handler);
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

module.exports = Route;