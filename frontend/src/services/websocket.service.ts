class WebsocketService {
  private ws: WebSocket | null = null;
  private isClosed = false;
  private pingInterval: any = null;

  connect(
    onOpen: () => void,
    onMessage: (event: MessageEvent) => void,
    onClose: () => void,
    onError: (err: any) => void
  ) {
    this.isClosed = false;
    this.ws = new WebSocket("ws://localhost:8000/ws/voice");
    this.ws.binaryType = "arraybuffer";

    this.ws.onopen = () => {
      console.log("Connected to Sentinel Backend");
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
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }
}

export const websocketService = new WebsocketService();
