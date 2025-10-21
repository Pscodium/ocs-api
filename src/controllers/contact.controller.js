const { Mailer } = require("../services/email/mailer");


exports.sendContactMessage = async (req, res) => {
    try {
        const mailer = new Mailer()
        const result = await mailer.sendMail(req.body);
        return res.status(200).json(result);
    } catch (e) {
        console.error(e);
        return res.sendStatus(500);
    }
}