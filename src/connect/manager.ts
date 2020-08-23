import Peer from 'peerjs'
import { RemoteNode } from './remote-node'
import { MsgType } from '../interface'

const peerId = Math.random().toString(36).slice(2)

// 无法连接，放弃的的名单
const abandonedList: string[] = []
abandonedList.push(peerId)

const remoteNodes: RemoteNode[] = []

const config = {
  // host: '192.168.1.2',
  // port: 9000,
  host: 'fenghen-p2p-server.herokuapp.com',
  secure: true,
  path: '/myapp',
  config: {
    iceServers: [
      { urls: 'stun:ks-sh-live-p2p-01.chat.bilibili.com:3478' }
    ],
  }
}

const peer = new Peer(peerId, config)

const flowStatistics = {}
setInterval(() => {
  remoteNodes.forEach(node => {
    flowStatistics[node.remoteId] = {
      download: node.downloadBytes,
      upload: node.uploadBytes,
    }
  })
}, 1000)

// todo: discoverUrl
async function discoverUser(discoverUrl?) {
  // const userIds = await (await fetch('//192.168.1.2:9000/myapp/peerjs/peers')).json()
  const userIds = await (await fetch('https://fenghen-p2p-server.herokuapp.com/myapp/peerjs/peers')).json()
  return userIds
}

async function startScan() {
  setInterval(async () => {
    const rnIds = remoteNodes.map(rn => rn.remoteId)
    const discoverIds = (await discoverUser())
      .filter(id => !(rnIds.includes(id) || abandonedList.includes(id)))

    if (!discoverIds.length) return

    console.log('========== discoverIds: ', discoverIds)

    discoverIds.forEach(createRemoteNode)
  }, 3000)

}

function createRemoteNode(flag: string | Peer.DataConnection) {
  const id = typeof flag === 'string' ? flag : flag.peer
  // 连接已存在
  if (remoteNodes.some(n => n.remoteId === id)) return false

  const conn = typeof flag === 'string' ? peer.connect(id) : flag

  const rn = new RemoteNode(conn)
  console.log('============ createRemoteNode', rn)
  rn.on('destroy', () => {
    remoteNodes.splice(remoteNodes.indexOf(rn), 1)
  })

  remoteNodes.push(rn)
}

peer.on('connection', (conn) => {
  console.log('------ Received connection:', conn)
  createRemoteNode(conn)
  conn.on('open', () => {
  })
});

startScan()

export const connManager = {
  peerId,
  remoteNodes,
  flowStatistics,
  fetchData(params): Promise<any> {
    if (!remoteNodes.length) return

    const curNodes = [...remoteNodes]

    return curNodes[0].fetchData({ name: 'test', ...params })
  },
  broadcast(msgType: MsgType, msg) {
    remoteNodes.forEach(node => {
      node.sendSimpleMsg(msgType, msg)
    })
  }
}
