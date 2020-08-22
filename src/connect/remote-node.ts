import Peer from "peerjs";
import { TinyEmitter } from 'tiny-emitter'
import { MsgType } from "../interface";

interface DataConnection extends Peer.DataConnection {
  extSend(params: any, onResp: ({ value: any, done: boolean }) => void): void
}

// 扩展conn，允许通过回调获取响应
function extConnect(conn: Peer.DataConnection): DataConnection {
  let reqIdflag = 0
  const respHandlers = {}
  conn['extSend'] = (params, onResp) => {
    const curReqId = reqIdflag + 1
    reqIdflag = curReqId

    respHandlers[curReqId] = onResp

    conn.send({
      reqId: curReqId,
      params,
    })

    return () => {
      conn.send({
        params: {
          type: MsgType.CancelQuery,
          reqId: curReqId,
        }
      })
    }
  }
  conn.on('data', ({ reqId, value, done = true }) => {
    respHandlers[reqId]?.({ value, done })
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

  private lossPacketCount = 0

  private emitter = new TinyEmitter()

  public on = this.emitter.on
  
  public emit = this.emitter.emit

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

      // 检测连接状态
      this.ping()
    });
    this.conn.on('error', () => { this.destroy() })

    if (this.tryConnect === -1 || this.tryConnect > 3) return
  }

  private ping() {
    const t = Date.now()
    const timeoutTimer = setTimeout(() => {
      this.lossPacketCount += 1
      console.error('超时次数：', this.lossPacketCount)

      // 超时3次 断开连接
      if (this.lossPacketCount >= 3) {
        this.destroy()
        return
      } 

      this.ping()
    }, 10000)

    this.conn.extSend({ type: MsgType.Ping }, () => {
      this.delayTime = Date.now() - t
      clearTimeout(timeoutTimer)
      this.lossPacketCount = 0

      setTimeout(() => {
        this.ping()
      }, 1000)
    })
  }
  
  fetchData(params) {
    return new Promise((resolve) => {
      this.conn.extSend({
        type: MsgType.FetchData,
        ...params,
      }, ({ value }) => {
        resolve(value)
      })
    })
  }

  fetchStream(params) {
    return new ReadableStream({
      start(controller) {
        this.conn.extSend(
          { type: MsgType.Query, params },
          ({ value, done }) => {
            if (done) controller.close()
            controller.enqueue(value)
          }
        )
      },
      cancel() {
        // todo: cancel conn
      }
    });
  }

  destroy() {
    console.warn('销毁远程连接...')
    clearInterval(this.pingTimer)
    this.conn.close()

    this.emit('destroy')
  }

}