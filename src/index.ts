import Peer from 'peerjs';

const userId = Math.random().toString(36).slice(2)

async function discoverUser() {
  const userIds = await (await fetch('//192.168.1.2:9000/myapp/peerjs/peers')).json()
  return userIds.filter((id) => id !== userId)
}

async function main() {
  const peer = new Peer(userId, {
    host: '192.168.1.2',
    port: 9000,
    path: '/myapp'
  })
  
  peer.on('connection', (conn) => {
    conn.on('data', function (data) {
      console.log('peer Received:', data);
      document.body.innerText = data.toString();
    });
  });

  const otherIds = await discoverUser()
  if (!otherIds.length) return

  const conn = peer.connect(otherIds[0]);
  conn.on('open', () => {
    console.log('connection opened')
    // Receive messages
    conn.on('data', function (data) {
      console.log('peer1 Received:', data);
    });

    // Send messages
    conn.send('11111111111');
  });
}

main()