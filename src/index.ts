import Peer from 'peerjs';
import { RemoteNode, MsgType } from './remote-node';

const userId = Math.random().toString(36).slice(2)
document.body.append(`userId: ${userId}`)
async function discoverUser() {
  const userIds = await (await fetch('//192.168.1.2:9000/myapp/peerjs/peers')).json()
  return userIds.filter((id) => id !== userId)
}

async function main() {
  const peer = new Peer(userId, {
    host: '192.168.1.2',
    port: 9000,
    path: '/myapp',
    config: {
      iceServers: [
        { urls: 'stun:ks-sh-live-p2p-01.chat.bilibili.com:3478' },
        { urls: 'stun:stun.l.google.com:19302' },
        // { urls: 'turn:homeo@turn.bistri.com:80', credential: 'homeo' },
      ]
    } /* Sample servers, please use appropriate ones */
  })


  peer.on('connection', (conn) => {
    console.log('------ connection:', conn)
    conn.on('data', (data) => {
      console.log('server Received:', data);

      if (data.type === MsgType.Ping) {
        conn.send({
          ...data,
          type: MsgType.Pong,
        })
      }
    });
  });

  let rns: RemoteNode[] = []
  setInterval(async () => {
    const rnIds = rns.map(rn => rn.remoteId)
    const discoverIds = (await discoverUser()).filter(id => !rnIds.includes(id))
    if (!discoverIds.length) return

    console.log('------ discoverIds: ', discoverIds)
    const newRns = discoverIds.filter(id => !rnIds.includes(id))
      .map(id => new RemoteNode(peer, id))
    newRns.forEach(nrn => {
      const removeRn = () => {
        rns = rns.filter(rn => rn.remoteId !== nrn.remoteId)
        console.log('close conn; remain: ', rns)
      }
      nrn.conn.on('close', removeRn)
      nrn.conn.on('error', removeRn)

    })

    rns.push(...newRns)
  }, 3000)

  const div = document.createElement('div')
  document.body.append(div)
  setInterval(() => {
    div.innerText = rns.map(rn => `remoteId: ${rn.remoteId}, delay: ${rn.delayTime}`).join('\n')
  }, 1000)
}

main()

function streamProducer(onData) {
  const timerId = setInterval(() => {
    onData(new Uint8Array(1024 * 100))
  })

  return () => {
    clearInterval(timerId)
  }
}