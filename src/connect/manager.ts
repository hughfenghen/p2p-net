import Peer from "peerjs"
import { RemoteNode } from "./remote-node"
import { responseTask } from "../service"
import { MsgType } from "../interface"

let peer
// 无法连接，放弃的的名单
const abandonedList = []

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

    remoteNodes.push(...discoverIds.map(id => new RemoteNode(peer, id)))

    // newRns.forEach(nrn => {
    //   const removeRn = () => {
    //     remoteNodes = remoteNodes.filter(rn => rn.remoteId !== nrn.remoteId)
    //     console.log('close conn; remain: ', remoteNodes)
    //   }
    //   nrn.conn.on('close', removeRn)
    //   nrn.conn.on('error', removeRn)

    // })
  }, 3000)

}

export function createManager(userId) {
  abandonedList.push(userId)
  peer = new Peer(userId, config)

  peer.on('connection', (conn) => {
    console.log('------ Received connection:', conn)
    conn.on('open', () => {
      console.log('------ Received connection opened:', conn)
    })
    conn.on('error', () => {
      console.log('------ Received connection error:', conn)
    })
    conn.on('close', () => {
      console.log('------ Received connection close:', conn)
    })

    conn.on('data', ({ params, reqId }) => {
      console.log('-------- server Received:', reqId, params);

      if (params.type === MsgType.Ping) {
        conn.send({ reqId })
      }

      if (params.type === MsgType.FetchData) {
        // 返回10M数据
        conn.send({ reqId, value: new Uint8Array(params.size), done: true })
      }

      if (params.type === MsgType.CancelQuery) {
        // todo
      }
    });
  });

  startScan()

  return {
    remoteNodes,
    fetchData(params): Promise<any> {
      if (!remoteNodes.length) return

      const curNodes = [...remoteNodes]

      return curNodes[0].fetchData({ name: 'test', ...params })      
    },
    queryRemote() {
      if (!remoteNodes.length) return

      const curNodes = [...remoteNodes]

      return curNodes[0].fetchStream({ name: 'test' })

    //   curNodes.forEach(node => { })
    }
  }
}
