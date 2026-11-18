// Vercel : toutes les routes /api/* arrivent ici (voir vercel.json).
const { handleApi } = require("../lib/app.js");

module.exports = (req, res) => handleApi(req, res);
