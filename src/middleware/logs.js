const chalk = require('chalk');
const moment = require('moment');

/**
 * 
 * @param {import('express').Request} req 
 * @param {import('express').Response} res 
 * @param {import('express').NextFunction} next 
 */
exports.logs = (req, res, next) => {

    const startTime = new Date();
    const { method, originalUrl, ip } = req;

    res.on('finish', () => {
        const requestedAt = moment().format('DD-MM-YYYY HH:mm:ss')
        const elapsedTime = new Date().getTime() - startTime.getTime();
        const { statusCode } = res;

        let statusColor = '4AEC48';
        if (statusCode >= 400 && statusCode < 500) {
            statusColor = 'DCF140';
        } else if (statusCode >= 500) {
            statusColor = 'D74040';
        }

        console.log(`${chalk.gray('[')}${chalk.bold.cyan(method)}${chalk.gray(']')} ${originalUrl} - ${chalk.hex('#' + statusColor)(statusCode)} (${chalk.yellow(elapsedTime + 'ms')})  |  ${requestedAt}  |  ${ip}`);
    });

    next();
};
