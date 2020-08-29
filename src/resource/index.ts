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

async function fetchResOfServer(url: string): Promise<ArrayBuffer> {
  const res = await fetch(url, { cache: 'no-cache' })
  // todo: 流式读取，也许可以降低延迟
  if (res.ok) return res.arrayBuffer()
  throw new Error(`url: ${url}, res: ${res.status}`)
}

class Resource {
  // mimeType: string

  private data: ArrayBuffer

  private fetchPromise: Promise<ArrayBuffer> | null = null

  private remoteNodes: RemoteNode[] = []

  constructor(
    public url: string,
    public source: 'local' | 'remote'
  ) {}

  addRemoteNode(remoteNode: RemoteNode) {
    const { remoteNodes } = this
    remoteNodes.push(remoteNode)
    // 远程节点销毁时，移除Resource对其的依赖
    remoteNode.on('destroy', () => {
      remoteNodes.splice(remoteNodes.indexOf(remoteNode), 1)
    })
  }

  setData(data: any) {
    this.data = data
    this.source = 'local'
  }

  setFetchPromise(fetchPromise: Promise<ArrayBuffer>) {
    this.fetchPromise = fetchPromise
    fetchPromise.then((data) => {
      this.setData(data)
      this.fetchPromise = null
    }).catch(() => {
      this.fetchPromise = null
    })
  }

  // 优先读取本地资源，如果不存在尝试远程读取
  readResourceData(onResp: RespHandler): { done: boolean, value: any } {
    if (this.readLocalData(onResp)) return

    if (this.readRemoteData(onResp)) return

    console.error('未读取到本地资源数据')
    onResp({ done: true, value: null })
  }

  private readRemoteData(onResp: RespHandler) {
    if (!this.remoteNodes.length) return false
    // todo: 可以考虑按延迟选取remoteNode
    const rn = this.remoteNodes[0]
    // todo: 可能出现error, 超时(rn destroy, error事件)
    const stream = rn.fetchStream(this.url)
    const reader = stream.getReader()

    let data
    let fetchResolve
    const fetchPromise = new Promise<ArrayBuffer>((resolve, reject) => {
      fetchResolve = resolve
      // todo: 超时需要reject
    })
    this.setFetchPromise(fetchPromise)
    const process = ({ done, value }) => {
      // onResp({ done, value })
      data = concatArrayBuffers(data, value)
      if (done) {
        fetchResolve(data)
        
        onResp({ done, value: data })
        reader.releaseLock()
        return
      }

      reader.read().then(process)
    }
    reader.read().then(process)

    return true
  }

  // 仅读取本地资源
  readLocalData(onResp: RespHandler): boolean {
    if (this.data) {
      onResp({ done: true, value: this.data })
      return true
    } else if (this.fetchPromise) {
      this.fetchPromise.then((data) => {
        onResp({ done: true, value: data })
      }).catch(() => {
        onResp({ done: true, value: null })
      })
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
  
  function runExpiresCheck() {
    if (checkTimer) return

    // 5s 检查一次失效资源, 避免内存泄露
    checkTimer = setInterval(function () {
      for (const url in lastAccessTimes) {
        if (Date.now() - lastAccessTimes[url] > expiresTime) {
          delete lastAccessTimes[url]
          delete Table[url]
        }
      }

      if (Object.keys(lastAccessTimes).length === 0) {
        // 没有资源时终止定时器，等待添加资源时启动
        clearInterval(checkTimer)
        checkTimer = null
      }
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

      // 本地资源需要广播给其他节点，告知他们可以在当前节点读取资源
      if (resource.source === 'local') {
        connManager.broadcast(MsgType.ResourceInfoSync, url)
      }
      runExpiresCheck()
    },
    delete(url: string) {
      delete Table[url]
      delete lastAccessTimes[url]
    },
    getAll() {
      return { ...Table }
    }
  }
}

const ResourceTable = createResourceTable()
let serverDownloadBytes = 0

export async function getResourceData(url: string, onResp: RespHandler) {
  if (ResourceTable.get(url)) {
    ResourceTable.get(url).readResourceData(onResp)
    return 
  }

  const res = new Resource(url, 'local')
  const fetchPromise = fetchResOfServer(url)
  res.setFetchPromise(fetchPromise)
  ResourceTable.add(url, res)
  
  try {
    const data = await fetchPromise
    serverDownloadBytes += data.byteLength
    onResp({ done: true, value: data })
    if (!data) {
      console.error('未读取到CDN资源数据')
    }
  } catch (e) {
    ResourceTable.delete(url)
    console.error(e)
    throw e
  }

}

/**
 * 只读取本地资源数据，用于给远程p2p节点分享数据
 * @param url 
 * @param onResp 
 */
export function readLocalResource(url: string, onResp: RespHandler) {
  const res = ResourceTable.get(url)
  if (!res) {
    onResp({ done: true, value: null })
    return
  }
  if (!res.readLocalData(onResp)) {
    onResp({ done: true, value: null })
  }
}

/**
 * 添加一个远程节点资源
 * @param url 
 * @param remoteNode 可从此节点获取数据
 */
export function addRemoteResource(url: string, remoteNode) {
  if (!ResourceTable.get(url)) {
    ResourceTable.add(url, new Resource(url, 'remote'))
  }

  ResourceTable.get(url).addRemoteNode(remoteNode)
}

export function getAllResource(): string[] {
  return Object.keys(ResourceTable.getAll())
}

export function getServerDownloadBytes() {
  return serverDownloadBytes
}
