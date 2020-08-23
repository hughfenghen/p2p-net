import Peer from "peerjs";
import { TinyEmitter } from 'tiny-emitter'
import { MsgType, RespHandler } from "../interface";
import { addRemoteResource, readLocalResource } from "../resource";

interface DataConnection extends Peer.DataConnection {
  extSend(params: any, onResp?: RespHandler): void
}

// 扩展conn，允许通过回调获取响应
function extConnect(conn: Peer.DataConnection): DataConnection {
  let reqIdflag = 0
  const respHandlers = {}
  const timer = {}
  conn['extSend'] = (params, onResp) => {
    console.debug('[rn] extSend', params)
    const curReqId = `${conn.peer}-${reqIdflag + 1}`
    reqIdflag += 1

    respHandlers[curReqId] = onResp
    // 设定超时，避免handler堆积
    timer[curReqId] = window.setTimeout(() => {
      delete respHandlers[curReqId]
    }, 10000)

    conn.send({
      reqId: curReqId,
      params,
    })
  }
  // 这里只处理本地发出去的请求，的回应
  // 远程请求的响应在serverHandler中
  conn.on('data', ({ reqId, value, done = true }) => {
    console.debug('[rn] extRecv', { done, value })
    clearTimeout(timer[reqId])

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

  private pingTimer: number
  private pingTimtoutTimer: number
  private openTimtoutTimer: number

  private lossPacketCount = 0

  private emitter = new TinyEmitter()

  on = this.emitter.on

  emit = this.emitter.emit

  remoteId: string

  downloadBytes = 0

  uploadBytes = 0

  constructor(conn: Peer.DataConnection) {
    this.remoteId = conn.peer
    this.conn = extConnect(conn)

    if (this.conn.open) {
      this.ping()
    } else {
      this.openTimtoutTimer = window.setTimeout(() => {
        console.error('open connection timeout')
        this.destroy()
      }, 10000)
      this.conn.on('open', () => {
        clearTimeout(this.openTimtoutTimer)
        console.log('++++++++ remote connection opened')
        this.ping()
      });
    }

    this.conn.on('data', this.serverHandler)

    this.conn.on('error', (err) => {
      console.error(err)
      this.destroy() 
    })
  }

  private ping() {
    const t = Date.now()
    this.pingTimtoutTimer = window.setTimeout(() => {
      this.lossPacketCount += 1
      console.error('超时次数：', this.lossPacketCount, this.remoteId)

      // 超时3次 断开连接
      if (this.lossPacketCount >= 3) {
        this.destroy()
        return
      }

      this.ping()
    }, 3000)

    console.debug('++++++++ ping')
    this.conn.extSend({ type: MsgType.Ping }, () => {
      this.delayTime = Date.now() - t
      clearTimeout(this.pingTimtoutTimer)
      this.lossPacketCount = 0

      this.pingTimer = window.setTimeout(() => {
        this.ping()
      }, 1000)
    })
  }

  // 响应远程请求
  private serverHandler = ({ params, reqId }) => {
    // 如果是本地发起的请求的响应, 没有params.type
    if (!params || !params.type) return

    console.debug('-------- server Received:', reqId, params);
    const { conn } = this
    switch (params.type) {
      case MsgType.Ping:
        conn.send({ reqId, done: true })
        break
      case MsgType.FetchData:
        conn.send({ reqId, value: new Uint8Array(params.size), done: true })
        break
      case MsgType.ResourceInfoSync:
        addRemoteResource(params.msg, this)
        break
      case MsgType.FetchStream:
        readLocalResource(params.url, ({ done, value }) => {
          conn.send({ reqId, done, value })
          if (value && value.byteLength) {
            this.uploadBytes += value.byteLength
          }
        })
        break
    }
  }

  sendSimpleMsg(type: MsgType, msg) {
    return new Promise((resolve) => {
      this.conn.extSend({ type, msg }, ({ value }) => {
        resolve(value)
      })
    })
  }

  // 目前只用于测试获取数据延时 
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

  fetchStream(url: string) {
    return new ReadableStream({
      start: (controller) => {
        this.conn.extSend(
          { type: MsgType.FetchStream, url },
          ({ value, done }) => {
            controller.enqueue(value)
            if (done) controller.close()

            if (value && value.byteLength) {
              this.downloadBytes += value.byteLength
            }
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
    clearInterval(this.pingTimtoutTimer)
    clearInterval(this.openTimtoutTimer)
    this.conn.close()

    this.emit('destroy')
  }

}