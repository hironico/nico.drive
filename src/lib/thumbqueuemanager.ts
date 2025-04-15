import { ThumbRequest } from "./imageutils";
import { Worker } from 'worker_threads';
import dotenv from 'dotenv';

dotenv.config();

export type ThumbTask = {
  id: string;
  request: ThumbRequest;
}

export class QueueManager {
  private queue: Array<ThumbTask> = [];
  private processing: Set<string> = new Set();
  private maxConcurrent: number;
  public isProcessing: boolean = false;

  constructor(maxConcurrent: number = 3) {
    this.maxConcurrent = maxConcurrent;
  }

  public isTaskQueued(id: string): boolean {
    return this.queue.some(item => item.id === id) || this.processing.has(id);
  }

  public enqueue({ id, request }: ThumbTask): void {
    if (!this.isTaskQueued(id)) {
      this.queue.push({ id, request });
    }

    // is there any room for processing this
    if (this.processing.size < this.maxConcurrent) {
      this.processQueue();
    }
  }

  private processQueue() {
    this.isProcessing = true;

    while (this.queue.length > 0 && this.processing.size < this.maxConcurrent) {
      const item = this.queue.shift();
      if (!item) continue;

      this.processing.add(item.id);

      try {
        // launch thumb request in a separated thread instead of the event queue of nodejs
        const w = new Worker('./src/lib/workerlauncher_thumbgen.js', {
          workerData: {
            request: item.request
          }
        });

        /*
        w.on('message', (result) => {
            console.log(result);
        });
        */

        w.on('exit', (code) => {
          if (code != 0) {
            console.log(`WARNING: thumb generator thread exited with return code: ${code}`);
          }

          // finshed processing, so make room for next item to process
          this.processing.delete(item.id);

          // is there anything to process and room available ?
          if (this.processing.size < this.maxConcurrent && this.getQueueLength() > 0) {
            this.processQueue();
          } else {
            this.isProcessing = false;
            console.log('No more items in the queue.');
          }
        });
      } catch (error) {
        console.log(error);
        this.processing.delete(item.id);
      }
    }
  }

  public getQueueLength(): number {
    return this.queue.length;
  }

  public getProcessingCount(): number {
    return this.processing.size;
  }
}