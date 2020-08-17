import Peer from "peerjs";

export enum MsgType {
  Ping,
  Pong,
}

export class RemoteNode {

  conn: Peer.DataConnection

  delayTime: number = Infinity

  // status: 

  private tryConnect = 0

  private lastPingTs: number

  private pingMsgs = new Set()

  private pingMsgNo = 0

  private pingTimer: number

  constructor(
    private selfPeer: Peer,
    public remoteId: string,
  ) {
    this.connect()
  }

  private connect() {
    this.tryConnect += 1

    this.conn = this.selfPeer.connect(this.remoteId);
    console.log('+++++++++ connect remote: ', this.remoteId, this.conn)
    this.conn.on('open', () => {
      console.log('++++++++ remote connection opened')
      this.tryConnect = -1
      // Receive messages
      this.conn.on('data', (data) => {
        console.log('++++++++ client Received:', data);
        if (data.type === MsgType.Pong) {
          this.onPong(data)
        }
      });
      setInterval(() => {
        this.ping()
      }, 2000)
    });

    if (this.tryConnect === -1 || this.tryConnect > 3) return
    
    // setTimeout(() => {
    //   this.connect()
    // }, 3000)
  }

  private ping() {
    const msg = {
      type: MsgType.Ping,
      ts: Date.now(),
    }
    // this.pingMsgs.add(msg)
    this.conn.send(msg)
    console.log('+++++++ send:', msg)
  }

  private onPong(msg) {
    this.delayTime = Date.now() - msg.ts
    console.log(2222, this.delayTime)
    // setTimeout(() => {
    //   this.ping()
    // }, 1000)
  }

  destory() {
  
  }

}