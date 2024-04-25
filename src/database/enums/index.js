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
        "CAN_MANAGE_ROLES": 'can_manage_roles',
        "CAN_EDIT_USER": 'can_edit_user',
        "CAN_EDIT_POST_FROM_ANOTHER_USER": 'can_edit_post_from_another_user',

        // thread perms
        "CAN_POST": 'can_post',
        "CAN_LIKE_ON_POST": 'can_like_on_post',
        "CAN_COMMENT_ON_POST": 'can_comment_on_post',
        "CAN_EDIT_POST": 'can_edit_post',

        // settings perms
        "CAN_EDIT_PROFILE": 'can_edit_profile',
        "CAN_EDIT_PHOTO": 'can_edit_photo',
        "CAN_REMOVE_ACCOUNT": 'can_remove_account'
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