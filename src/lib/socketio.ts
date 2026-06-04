import { Server } from "socket.io";
import { Socket } from "socket.io";
import { Server as HttpServer } from "http";
import { Application } from "express";

export type ThumbNotification = {
  requestId: string;
  filename: string;
  width: number;
  height: number;
  resizeFit: string;
  username: string;
  homeDir: string;
};

export class SocketIOServer {
  private io: Server;
  private activeConnections: Map<string, Set<string>> = new Map();

  constructor(app: Application, httpServer: HttpServer) {
    this.io = new Server(httpServer, {
      cors: {
        origin: true, // allow all origins with credentials
        methods: ["GET", "POST"],
        credentials: true
      }
    });

    this.setupEventHandlers();
  }

  private setupEventHandlers(): void {
    this.io.on("connection", (socket: Socket) => {
      console.log(`New socket connection: ${socket.id}`);

      socket.on("join_thumb_room", (data: { username: string; homeDir: string; requestId: string }) => {
        const { username, homeDir, requestId } = data;
        const roomName = this.getRoomName(username, homeDir, requestId);

        socket.join(roomName);
        console.log(`Socket ${socket.id} joined room: ${roomName}`);

        // Track active connections per room
        if (!this.activeConnections.has(roomName)) {
          this.activeConnections.set(roomName, new Set());
        }
        this.activeConnections.get(roomName)?.add(socket.id);
      });

      socket.on("disconnect", () => {
        console.log(`Socket disconnected: ${socket.id}`);

        // Clean up disconnected sockets from all rooms
        this.activeConnections.forEach((sockets, roomName) => {
          if (sockets.has(socket.id)) {
            sockets.delete(socket.id);
            console.log(`Removed socket ${socket.id} from room ${roomName}`);

            // Clean up empty rooms
            if (sockets.size === 0) {
              this.activeConnections.delete(roomName);
            }
          }
        });
      });
    });
  }

  public emitThumbReady(notification: ThumbNotification): void {
    const roomName = this.getRoomName(notification.username, notification.homeDir, notification.requestId);
    console.log(`Emitting thumb ready notification for room: ${roomName}`);

    this.io.to(roomName).emit("thumb_ready", notification);
  }

  private getRoomName(username: string, homeDir: string, requestId: string): string {
    return `thumb_${username}_${homeDir}_${requestId}`;
  }

  public getIO(): Server {
    return this.io;
  }
}