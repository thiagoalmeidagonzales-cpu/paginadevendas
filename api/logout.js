const { setCookie } = require('./_lib');
module.exports = (req, res) => { setCookie(res, '', 0); res.status(200).json({ ok: true }); };
