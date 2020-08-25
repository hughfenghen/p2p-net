import { RemoteNode } from "../connect/remote-node"
import { connManager } from "../connect/manager"
import { MsgType, RespHandler } from "../interface"

function concatArrayBuffers(buf1: ArrayBuffer, buf2: ArrayBuffer) {
  if (!buf1) return buf2
  if (!buf2) return buf1

  const tmp = new Uint8Array(buf1.byteLength + buf2.byteLength)
  tmp.set(new Uint8Array(buf1), 0)
  tmp.set(new Uint8Array(buf2), buf1.byteLength)
  return tmp.buffer
};


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

    // 当前资源已无法获取，重来一遍从CDN上读取
    if (this.readRemoteData(onResp)) return

    getResourceData(this.url, onResp)
  }

  private readRemoteData(onResp) {
    if (!this.remoteNodes.length) return false
    // todo: 可以考虑按延迟选取remoteNode
    const rn = this.remoteNodes[0]
    // todo: 可能出现error, 超时
    const stream = rn.fetchStream(this.url)
    const reader = stream.getReader()
    reader.read().then(function process({ done, value }) {
      onResp({ done, value })
      if (done) return

      reader.read().then(process)
    })

    return true
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
      let data = null

      const process = ({ done, value }) => {
        onResp({ done, value })
        data = concatArrayBuffers(data, value)
        if (done) {
          this.data = data
          reader.releaseLock()
          return
        }

        reader.read().then(process)
      }

      reader.read().then(process)
      return true
    }

    return false
  }
}


// 创建资源管理器
function createResourceTable() {
  const Table: { [key: string]: Resource } = {}
  const lastAccessTimes = {}
  const expiresTime = 3 * 60 * 1000
  
  let checkTimer = null
  
  function runCheck() {
    if (checkTimer) return

    // 5s 检查一次失效资源, 避免内存泄露
    checkTimer = setInterval(function () {
      for (const url in lastAccessTimes) {
        if (Date.now() - lastAccessTimes[url] > expiresTime) {
          delete lastAccessTimes[url]
          delete Table[url]
        }
      }
      if (Object.keys(lastAccessTimes).length === 0) clearInterval(checkTimer)
    }, 5000)
  }

  // todo: 资源删除、失效时间更新，是否要同步远端？
  return {
    get(url: string) {
      // 重置失效时间
      if (lastAccessTimes[url]) lastAccessTimes[url] = Date.now()

      return Table[url]
    },
    add(url: string, resource: Resource) {
      if (Table[url]) throw new Error(`Resource<${url}> already exists`)
      
      lastAccessTimes[url] = Date.now()
      Table[url] = resource
      connManager.broadcast(MsgType.ResourceInfoSync, url)
      runCheck()
    },
    getAll() {
      return { ...Table }
    }
  }
}

const ResourceTable = createResourceTable()

export async function getResourceData(url: string, onResp: RespHandler) {
  if (ResourceTable.get(url)) {
    ResourceTable.get(url).readResourceData(onResp)
    return 
  }

  ResourceTable.add(url, new Resource(url))
  
  const stream = await fetchResOfServer(url)
  ResourceTable.get(url).setStream(stream)

  ResourceTable.get(url).readLocalData(onResp)
}

export function readLocalResource(url: string, onResp: RespHandler) {
  if (!ResourceTable.get(url).readLocalData(onResp)) {
    onResp({ done: true, value: null })
  }
}

export function addRemoteResource(url: string, remoteNode) {
  if (!ResourceTable.get(url)) {
    ResourceTable.add(url, new Resource(url))
  }

  ResourceTable.get(url).addRemoteNode(remoteNode)
}

export function getAllResource(): string[] {
  return Object.keys(ResourceTable.getAll())
}

async function fetchResOfServer(url: string): Promise<ReadableStream> {
  const res = await fetch(url)
  return res.body
}
