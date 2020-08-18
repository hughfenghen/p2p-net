import Peer from "peerjs";

export enum MsgType {
  Ping,
  Pong,
}

interface DataConnection extends Peer.DataConnection {
  extSend(params: any, onResp: ({ data: any, done: boolean }) => void): void
}

// 扩展conn，允许通过回调获取响应
function extConnect(conn: Peer.DataConnection): DataConnection {
  let reqIdflag = 0
  const respHandlers = {}
  conn['extSend'] = (params, onResp) => {
    reqIdflag += 1
    respHandlers[reqIdflag] = onResp

    conn.send({
      reqId: reqIdflag,
      params,
    })
  }
  conn.on('data', ({ reqId, data, done = true }) => {
    respHandlers[reqId]?.({ data, done })
    if (done) {
      delete respHandlers[reqId]
    }
  })
  
  return conn as DataConnection
}

export class RemoteNode {

  conn: DataConnection

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

    this.conn = extConnect(this.selfPeer.connect(this.remoteId))
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
    // this.conn.send(msg)
    const t = Date.now()
    this.conn.extSend({ type: MsgType.Ping }, () => {
      this.delayTime = Date.now() - t
      console.log(2222, this.delayTime)
    })
    console.log('+++++++ send:', msg)
  }

  private onPong(msg) {
    // setTimeout(() => {
    //   this.ping()
    // }, 1000)
  }

  destory() {
  
  }

}