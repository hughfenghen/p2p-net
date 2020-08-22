import { RemoteNode } from "../connect/remote-node"

class Resource {
  // mimeType: string

  data: ArrayBuffer

  private remoteNodes: RemoteNode[] = []

  private stream: ReadableStream

  constructor(public url: string) {}

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
}

// 管理所有资源
const Table: { [key: string]: Resource } = {}

export async function getResource(url: string): Promise<Resource> {
  if (Table[url]) return Table[url]

  Table[url] = new Resource(url)

  const stream = await fetchResOfServer(url)
  Table[url].setStream(stream)

  return Table[url]
}

export function addRemoteResource(url: string, remoteNode) {
  if (!Table[url]) {
    Table[url] = new Resource(url)
  }

  Table[url].addRemoteNode(remoteNode)
}

async function fetchResOfServer(url: string): Promise<ReadableStream> {
  const res = await fetch(url)
  return res.body
}