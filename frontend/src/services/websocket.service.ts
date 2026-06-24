class WebsocketService {
  private ws: WebSocket | null = null;
  private isClosed = false;
  private pingInterval: any = null;
  private reconnectTimeout: any = null;

  private onOpenCb?: () => void;
  private onMessageCb?: (event: MessageEvent) => void;
  private onCloseCb?: () => void;
  private onErrorCb?: (err: any) => void;

  connect(
    onOpen: () => void,
    onMessage: (event: MessageEvent) => void,
    onClose: () => void,
    onError: (err: any) => void
  ) {
    this.isClosed = false;
    this.onOpenCb = onOpen;
    this.onMessageCb = onMessage;
    this.onCloseCb = onClose;
    this.onErrorCb = onError;

    this.ws = new WebSocket("ws://localhost:8000/ws/voice");
    this.ws.binaryType = "arraybuffer";

    this.ws.onopen = () => {
      console.log("Connected to Sentinel Backend");
      if (this.reconnectTimeout) {
        clearTimeout(this.reconnectTimeout);
        this.reconnectTimeout = null;
      }
      onOpen();
      // Start keep-alive heartbeats every 10 seconds
      this.pingInterval = setInterval(() => {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
          this.ws.send(JSON.stringify({ type: "ping" }));
        }
      }, 10000);
    };

    this.ws.onmessage = onMessage;
    
    this.ws.onclose = () => {
      if (this.pingInterval) {
        clearInterval(this.pingInterval);
      }
      onClose();

      // Auto-reconnect if connection dropped unexpectedly
      if (!this.isClosed && !this.reconnectTimeout) {
        console.log("WebSocket connection lost unexpectedly. Reconnecting in 2 seconds...");
        this.reconnectTimeout = setTimeout(() => {
          this.reconnectTimeout = null;
          this.connect(onOpen, onMessage, onClose, onError);
        }, 2000);
      }
    };
    
    this.ws.onerror = onError;
  }

  send(data: string | ArrayBuffer) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(data);
    }
  }

  isOpen(): boolean {
    return this.ws !== null && this.ws.readyState === WebSocket.OPEN;
  }

  disconnect() {
    this.isClosed = true;
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
    }
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }
}

export const websocketService = new WebsocketService();

