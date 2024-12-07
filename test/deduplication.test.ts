import {describe, expect, test} from '@jest/globals';

import { messageCountThumbQueue, publishToThumbQueue } from '../src/lib/rabbit_thumbgen';
import { ThumbRequest } from '../src/lib/imageutils';

describe('ensure deduplication is correctly setup', () => {
    test('send 20 thumb requests get only one in queue', async () => {
        const thumbReq: ThumbRequest = {
          fullFilename: '/tmp/to/the/file/image.cr2',
          width: 800,
          height: 800,
          resizeFit: 'fill'
        }

        let times = 20;
        while(times > 0) {
          publishToThumbQueue(thumbReq);
          times--;
        }          
        
        const count = await messageCountThumbQueue();
        expect(count).toBe(1);
      });
})
