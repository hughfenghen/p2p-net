import { RemoteNode } from "../connect/remote-node"
import { connManager } from "../connect/manager"
import { MsgType, RespHandler } from "../interface"
import { read } from "fs"

class Resource {
  // mimeType: string

  data: ArrayBuffer

  private remoteNodes: RemoteNode[] = []

  private stream: ReadableStream

  constructor(public url: string) {
    // todo: 保持N分钟，销毁资源，避免泄露
  }

  addRemoteNode(remoteNode: RemoteNode) {
    const { remoteNodes } = this
    remoteNodes.push(remoteNode)
    // 远程节点销毁时，移除Resource对其的依赖
    remoteNode.on('destroy', () => {
      remoteNodes.splice(remoteNodes.indexOf(remoteNode), 1)
    })
  }

  setStream(stream: ReadableStream) {
    this.stream = stream
  }

  // 优先读取本地资源，如果不存在尝试远程读取
  readResourceData(onResp: RespHandler): { done: boolean, value: any } {
    if (this.readLocalData(onResp)) return

    this.readRemoteData(onResp)
  }

  private readRemoteData(onResp) {
    // todo: 可以考虑按延迟选取remoteNode
    const rn = this.remoteNodes[0]
    // todo: 可能出现error
    const stream = rn.fetchStream(this.url)
    const reader = stream.getReader()
    reader.read().then(function process({ done, value }) {
      onResp({ done, value })
      if (done) return

      reader.read().then(process)
    })
  }

  // 仅读取本地资源
  readLocalData(onResp: RespHandler): boolean {
    if (this.data) {
      onResp({ done: true, value: this.data })
      return true
    }
    if (this.stream) {
      // todo: 流被locked 额外处理逻辑
      const reader = this.stream.getReader()
      reader.read().then(function process({ done, value }) {
        onResp({ done, value })
        if (done) return

        reader.read().then(process)
      })
      return true
    }

    return false
  }
}

// 管理所有资源
const Table: { [key: string]: Resource } = {}

export async function getResourceData(url: string, onResp: RespHandler) {
  if (Table[url]) {
    Table[url].readResourceData(onResp)
    return 
  }

  Table[url] = new Resource(url)
  connManager.broadcast(MsgType.ResourceInfoSync, url)
  
  const stream = await fetchResOfServer(url)
  Table[url].setStream(stream)

  Table[url].readLocalData(onResp)
}

export function readLocalResource(url: string, onResp: RespHandler) {
  if (Table[url]) {
    onResp({ done: true, value: null })
    return
  }
  Table[url].readLocalData(onResp)
}

export function addRemoteResource(url: string, remoteNode) {
  if (!Table[url]) {
    Table[url] = new Resource(url)
  }

  Table[url].addRemoteNode(remoteNode)
}

export function getAllResource(): string[] {
  return Object.keys(Table)
}

async function fetchResOfServer(url: string): Promise<ReadableStream> {
  const res = await fetch(url)
  return res.body
}
