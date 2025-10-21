const validate = require("../middleware/validate");
const { emailSchema } = require("../schemas/contact.schema");
const contactController = require("../controllers/contact.controller");

/**
 *
 * @param {import('../index')} app
 * @param {import('../middleware/authentication')} auth
 */
exports.init = function(app, auth) {
    app.post('/contact/send-email', validate(emailSchema), contactController.sendContactMessage);
};
