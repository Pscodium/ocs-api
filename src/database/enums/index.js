/* eslint-disable no-prototype-builtins */
const ENUMS = {
    UserRoles: {
        "ADMIN": "admin",
        "DEVELOPER": "developer",
        "OWNER": "owner",
        "CUSTOMER": "customer",
        "DEFAULT": "default"
    },
    UserStatus: {
        "ACTIVE": "active",
        "INACTIVE": "inactive",
        "OFFLINE": "offline",
    },
    Permissions: {
        // admin perms
        "ADMIN": "admin",
        "USER": "user",
    },
    Threads: {
        Reactions: {
            "POST_LIKE": "post_like",
            "COMMENT_LIKE": "comment_like"
        }
    },
    values: function (enumObj) {
        return Object.keys(enumObj).map(function (key) {
            return enumObj[key];
        });
    },
    keys: (enumObj) => {
        return Object.keys(enumObj);
    }
};

/**
 * @type {ENUMS}
 */
const enums = {};

for (const enumKey in ENUMS) {
    if (ENUMS.hasOwnProperty(enumKey)) {
        enums[enumKey] = Object.freeze(ENUMS[enumKey]);
    }
}

/**
 * @typedef {ENUMS} enums
 */

module.exports = enums;