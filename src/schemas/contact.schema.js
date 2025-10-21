const Joi = require('joi');

const emailSchema = Joi.object({
    to: Joi.string().email().required(),
    subject: Joi.string().required(),
    text: Joi.string().required(),
    html: Joi.string().optional()
})

module.exports = {
    emailSchema
}