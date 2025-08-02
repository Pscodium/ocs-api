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
        "MASTER_ADMIN_LEVEL": 'master_admin_level',
        "CAN_EDIT_USER": 'can_edit_user',
        "CAN_DELETE_USER": 'can_delete_user',
        "CAN_UPLOAD_FILES": 'can_upload_files',

        // settings perms
        "CAN_MANAGE_SETTINGS": 'can_manage_settings'
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