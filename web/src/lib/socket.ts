type Handler = (e: any) => void;

class Socket {
  private ws?: WebSocket;
  private handlers = new Set<Handler>();
  private queue: string[] = [];

  constructor() { this.connect(); }

  private emit(e: any) { this.handlers.forEach((h) => h(e)); }

  private connect() {
    const proto = location.protocol === "https:" ? "wss" : "ws";
    const ws = new WebSocket(`${proto}://${location.host}/ws`);
    this.ws = ws;
    ws.onopen = () => {
      this.emit({ type: "socket.open" });
      this.queue.splice(0).forEach((m) => ws.send(m));
    };
    ws.onmessage = (ev) => { try { this.emit(JSON.parse(ev.data)); } catch { /* ignore */ } };
    ws.onclose = () => { this.emit({ type: "socket.close" }); setTimeout(() => this.connect(), 600); };
  }

  send(msg: object) {
    const s = JSON.stringify(msg);
    if (this.ws?.readyState === WebSocket.OPEN) this.ws.send(s);
    else this.queue.push(s);
  }

  on(h: Handler) { this.handlers.add(h); return () => { this.handlers.delete(h); }; }
}

export const socket = new Socket();