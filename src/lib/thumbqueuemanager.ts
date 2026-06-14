import { ThumbRequest } from "./imageutils";
import { Worker } from 'worker_threads';
import dotenv from 'dotenv';
import { SocketIOServer } from "./socketio";

dotenv.config();

export type ThumbTask = {
  id: string;
  request: ThumbRequest;
  username: string;
  homeDir: string;
  requestId: string;
}

export class QueueManager {
  private queue: Array<ThumbTask> = [];
  private processing: Set<string> = new Set();
  private maxConcurrent: number;
  private socketIO: SocketIOServer | null = null;
  public isProcessing: boolean = false;

  constructor(maxConcurrent: number = 3) {
    this.maxConcurrent = maxConcurrent;
  }

  public setSocketIO(socketIO: SocketIOServer): void {
    this.socketIO = socketIO;
  }

  public isTaskQueued(id: string): boolean {
    return this.queue.some(item => item.id === id) || this.processing.has(id);
  }

  public enqueue(task: ThumbTask): void {
    if (!this.isTaskQueued(task.id)) {
      this.queue.push(task);
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
        // NOTE: The application must have been build 
        const w = new Worker('./dist/lib/workerlauncher_thumbgen.js', {
          workerData: {
            request: item.request
          }
        });

        // Capture the success/error result posted by the worker thread
        let workerResult: { success: boolean; error?: string } = { success: true };

        w.on('message', (result: { success: boolean; error?: string }) => {
          workerResult = result;
        });

        w.on('exit', (code) => {
          if (code != 0) {
            console.log(`WARNING: thumb generator thread exited with return code: ${code}`);
            // Non-zero exit without a prior message means an uncaught crash
            if (workerResult.success) {
              workerResult = { success: false, error: `Worker exited with code ${code}` };
            }
          }

          // finished processing, so make room for next item to process
          this.processing.delete(item.id);

          // emit socket.io notification so the client knows the thumb status
          if (this.socketIO) {
            this.socketIO.emitThumbReady({
              requestId: item.requestId,
              filename: item.request.fullFilename,
              width: item.request.width,
              height: item.request.height,
              resizeFit: item.request.resizeFit,
              username: item.username,
              homeDir: item.homeDir,
              status: workerResult.success ? 'success' : 'error',
              error: workerResult.error
            });
          }

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
