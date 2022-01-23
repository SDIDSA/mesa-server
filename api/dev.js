const Route = require("./route.js");

const toCamelCase = (name) => {
    return name.toLowerCase().replace(/[-_][a-z]/g, (group) => group.slice(-1).toUpperCase());
}

const toCamelCaseMethod = (name) => {
    return name.charAt(0).toUpperCase() + toCamelCase(name.substring(1));
}

class Dev extends Route {
    constructor(app) {
        super(app, "/dev");

        this.addEntry("generateBean", async(req, res) => {
            let tableName = req.body.table;
            let className = toCamelCaseMethod(tableName);
            let cols = await this.select({
                select: ["column_name", "data_type", "ordinal_position"],
                from: ["columns"],
                where: {
                    keys: ["table_name"],
                    values: [tableName]
                }
            }, "information_schema");
            let bean = "package mesa.data.bean;\n\nimport org.json.JSONObject;\nimport javafx.beans.property.SimpleIntegerProperty;\nimport javafx.beans.property.IntegerProperty;\nimport javafx.beans.property.SimpleStringProperty;\nimport javafx.beans.property.StringProperty;\n\npublic class " +
                className + " extends Bean {";

            cols.forEach(col => {
                if (col.data_type === "text") {
                    bean += "\n\tprivate StringProperty " + toCamelCase(col.column_name) + ";";
                } else if (col.data_type === "integer") {
                    bean += "\n\tprivate IntegerProperty " + toCamelCase(col.column_name) + ";";
                }
            });

            bean += "\n\n\tpublic " + className + "(JSONObject obj) {"

            cols.forEach(col => {
                if (col.data_type === "text") {
                    bean += "\n\t\t" + toCamelCase(col.column_name) + " = new SimpleStringProperty();";
                } else if (col.data_type === "integer") {
                    bean += "\n\t\t" + toCamelCase(col.column_name) + " = new SimpleIntegerProperty();";
                }
            });

            bean += "\n\t\tinit(obj);\n\t}\n"

            cols.forEach(col => {
                if (col.data_type === "text") {
                    bean += "\n\tpublic StringProperty " + toCamelCase(col.column_name) + "Property() {\n\t\treturn " + toCamelCase(col.column_name) + ";\n\t}\n";
                    bean += "\n\tpublic String get" + toCamelCaseMethod(col.column_name) + "() {\n\t\treturn " + toCamelCase(col.column_name) + ".get();\n\t}\n";
                    bean += "\n\tpublic void set" + toCamelCaseMethod(col.column_name) + "(String val) {\n\t\t" + toCamelCase(col.column_name) + ".set(val);\n\t}\n";
                } else if (col.data_type === "integer") {
                    bean += "\n\tpublic IntegerProperty " + toCamelCase(col.column_name) + "Property() {\n\t\treturn " + toCamelCase(col.column_name) + ";\n\t}\n";
                    bean += "\n\tpublic Integer get" + toCamelCaseMethod(col.column_name) + "() {\n\t\treturn " + toCamelCase(col.column_name) + ".get();\n\t}\n";
                    bean += "\n\tpublic void set" + toCamelCaseMethod(col.column_name) + "(Integer val) {\n\t\t" + toCamelCase(col.column_name) + ".set(val);\n\t}\n";
                }
            });

            bean += "\n\t@Override\n\tpublic String toString() {\n\t\treturn getClass().getSimpleName() + \" {\"";

            cols.forEach(col => {
                if (col.data_type === "text") {
                    bean += "\n\t\t\t+ \"\\t" + toCamelCase(col.column_name) + " : \" + " + toCamelCase(col.column_name) + ".get()";
                }
            });

            bean += "\n\t\t+ \"}\";"

            bean += "\n\t}";

            bean += "\n}"


            res.send(bean);
        })
    }
}

module.exports = Dev;