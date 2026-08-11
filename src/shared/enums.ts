/**
 * Frozen enum catalog. Kept structurally identical to the legacy enums, including
 * the quirk that Permissions has only ADMIN/USER — so references like
 * Permissions.CAN_POST resolve to undefined (used intentionally by storage routes).
 */
const RAW = {
    UserRoles: {
        ADMIN: 'admin',
        DEVELOPER: 'developer',
        OWNER: 'owner',
        CUSTOMER: 'customer',
        DEFAULT: 'default',
    },
    UserStatus: {
        ACTIVE: 'active',
        INACTIVE: 'inactive',
        OFFLINE: 'offline',
    },
    Permissions: {
        ADMIN: 'admin',
        USER: 'user',
    },
    Threads: {
        Reactions: {
            POST_LIKE: 'post_like',
            COMMENT_LIKE: 'comment_like',
        },
    },
};

type EnumMap = Record<string, string | undefined>;

export const UserRoles: EnumMap = Object.freeze(RAW.UserRoles);
export const UserStatus: EnumMap = Object.freeze(RAW.UserStatus);
export const Permissions: EnumMap = Object.freeze(RAW.Permissions);
export const Threads = Object.freeze(RAW.Threads);

export const values = (enumObj: Record<string, unknown>): unknown[] =>
    Object.keys(enumObj).map((key) => enumObj[key]);
export const keys = (enumObj: Record<string, unknown>): string[] => Object.keys(enumObj);

export default { UserRoles, UserStatus, Permissions, Threads, values, keys };
