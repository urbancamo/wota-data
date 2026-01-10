"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = default_1;
const pino_abstract_transport_1 = __importDefault(require("pino-abstract-transport"));
const client_1 = require("@prisma/client");
const os_1 = __importDefault(require("os"));
const prisma = new client_1.PrismaClient();
// Extract useful information from the log object
function extractLogData(log) {
    const { level, time, msg, pid, hostname, error, path, method, username, userId, statusCode, requestId, ...context } = log;
    // Map Pino numeric log levels to string levels
    const levelMap = {
        10: 'trace',
        20: 'debug',
        30: 'info',
        40: 'warn',
        50: 'error',
        60: 'fatal'
    };
    const levelString = levelMap[level] || 'info';
    // Extract error details if present
    let errorMessage = null;
    let errorStack = null;
    if (error) {
        if (typeof error === 'object' && error !== null) {
            errorMessage = error.message || JSON.stringify(error);
            errorStack = error.stack || null;
        }
        else {
            errorMessage = String(error);
        }
    }
    // Remove sensitive or redundant fields from context
    const cleanContext = { ...context };
    delete cleanContext.level;
    delete cleanContext.time;
    delete cleanContext.msg;
    delete cleanContext.pid;
    delete cleanContext.hostname;
    return {
        timestamp: new Date(time),
        level: levelString,
        message: msg || null,
        context: Object.keys(cleanContext).length > 0 ? cleanContext : null,
        hostname: hostname || os_1.default.hostname(),
        pid: pid || process.pid,
        request_id: requestId || null,
        user_id: userId || null,
        username: username || null,
        path: path || null,
        method: method || null,
        status_code: statusCode || null,
        error_message: errorMessage,
        error_stack: errorStack
    };
}
async function default_1(opts) {
    return (0, pino_abstract_transport_1.default)(async function (source) {
        for await (const obj of source) {
            try {
                const logData = extractLogData(obj);
                // Insert log into database (non-blocking)
                prisma.log.create({
                    data: logData
                }).catch((error) => {
                    // If database insert fails, log to console but don't crash
                    console.error('Failed to write log to database:', error);
                });
            }
            catch (error) {
                // If parsing fails, log to console but don't crash the transport
                console.error('Failed to parse log entry:', error);
            }
        }
    });
}
