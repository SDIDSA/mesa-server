var chars = "abcdefghijklmnopqrstuvwxyz";
var veryRandom = chars + chars.toUpperCase();
var numbers = "0123456789";
chars += numbers;

veryRandom += numbers;

class Random {
    constructor() {}

    random(length) {
        let res = "";
        for (let i = 0; i < length; i++) {
            res += chars.charAt(parseInt(Math.random() * chars.length));
        }
        return res;
    }

    conf_code(length) {
        let res = "";
        for (let i = 0; i < length; i++) {
            res += numbers.charAt(parseInt(Math.random() * numbers.length));
        }
        return res;
    }

    veryRandom(length) {
        let res = "";
        for (let i = 0; i < length; i++) {
            res += veryRandom.charAt(parseInt(Math.random() * veryRandom.length));
        }
        return res;
    }
}

module.exports = Random;