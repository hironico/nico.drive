import { PerUserStorageManager, RequestContext, FileSystem, IUser } from "webdav-server/lib/index.v2";

const HUNDRED_GIGA_BYTES = 1024 * 1024 * 1024 * 100;

export class PerUserQuotaStorageManager extends PerUserStorageManager {

    perUserLimit : {
        [UUID: string]: number
    }

    constructor(defaultUserQuota: number) {
        super(defaultUserQuota);
        this.perUserLimit = {};
    }

    reserve(ctx : RequestContext, fs : FileSystem, size : number, callback : (reserved : boolean) => void) : void
    {
        let nb = this.storage[ctx.user.uid];
        if(nb === undefined) {
            nb = 0;
        }
        nb += size;

        let userLimit = this.perUserLimit[ctx.user.uid];
        if (userLimit === undefined) {
            userLimit = this.limitPerUser;
        }

        // negative user limit means no limit
        if (userLimit >= 0 && nb > userLimit) {
            return callback(false);
        }

        this.storage[ctx.user.uid] = Math.max(0, nb);        
        callback(true);
    }

    available(ctx : RequestContext, fs : FileSystem, callback : (available : number) => void) : void
    {
        const nb = this.storage[ctx.user.uid];

        let userLimit = this.perUserLimit[ctx.user.uid];
        if (userLimit === undefined) {
            userLimit = this.limitPerUser;
        }

        const available = nb === undefined ? userLimit : userLimit - nb;
        
        callback(userLimit < 0 ? HUNDRED_GIGA_BYTES : available);
    }

    /**
     * Set the quota for a given user. This is the total maximum amount of space occupied for ALL filesystems where this user has canWrite role.
     * WARNING: setting a quota equals to exactly zero will disable write access to all root directories
     * for that user.
     * @param user user to configure the quota 
     * @param limit maximum usage quota in bytes for that user
     * @returns void
     */
    setUserLimit(user: IUser, limit: number): void {
        if (user === undefined) {
            return;
        }

        if (limit === undefined) {
            return;
        }

        // normalize unlimited
        let myLimit = limit;
        if (limit < 0) {
            myLimit = -1;
        }
        this.perUserLimit[user.uid] = myLimit;
    }

    /**
     * Initialize the current amount of space used by a user.
     * Mainly called from server sartup when configuring user's filesystem. 
     * Storage is counted only for file systems the user has access to with canWrite role.
     * Read only roles do not take into consideration for computing current quota consumption
     * @param user the user to init the current storage consumption
     * @param storage the number of bytes currently used by this user
     * @returns void
     */
    setUserReserved(user: IUser, storage: number): void {
        if (user === undefined) {
            return;
        }

        if (storage === undefined) {
            return;
        }

        this.storage[user.uid] = Math.max(0, storage);
    }

    getUserReserved(user: IUser): number {
        if (user === undefined) {
            return -1;
        }

        return Math.max(0, this.storage[user.uid]);
    }
}