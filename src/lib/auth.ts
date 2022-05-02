import { UserConfig } from "../models/UserConfig";

import usersConfig from '../../users_config.json';

export class AuthConfig {
    users: Array<UserConfig> = [];

    load = () : void => {
        if (typeof usersConfig === 'undefined') {
            console.log('ERROR: users_config.json file not found !');
            return;
        }

        
    }
}
