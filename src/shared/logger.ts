import chalk from 'chalk';

type Colorize = (message: string) => string;

export const alert: Colorize = (message) => chalk.red(message);
export const success: Colorize = (message) => chalk.green(message);
export const warning: Colorize = (message) => chalk.hex('#FFB302')(message);
export const caution: Colorize = (message) => chalk.hex('#FCE83A')(message);
export const waiting: Colorize = (message) => chalk.hex('#87a2c7')(message);
export const changed: Colorize = (message) => chalk.hex('#3865a3')(message);
export const available: Colorize = (message) => chalk.hex('#2DCCFF')(message);
export const unavailable: Colorize = (message) => chalk.hex('#A4ABB6')(message);
