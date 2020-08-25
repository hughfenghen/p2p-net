import { getAllResource, getResourceData } from "../../src/resource"
import { connManager } from "../../src/connect/manager"
import livePlayer from './live_players.js'

document.getElementById('myId').innerText = connManager.peerId
const connUser = document.getElementById('conn-user')
setInterval(() => {
  const lis = connManager.remoteNodes.map(rn => {
    const li = document.createElement('li')
    li.innerText = `remoteId: ${rn.remoteId}, delay: ${rn.delayTime}`
    return li
  })

  connUser.innerHTML = ''
  connUser.append(...lis)
}, 1000)

const resTable = document.getElementById('res-table')
const p2pUpload = document.getElementById('p2p-upload-size')
const p2pDownload = document.getElementById('p2p-download-size')
setInterval(() => {
  resTable.innerHTML = ''
  const items = getAllResource().map((url) => {
    const li = document.createElement('li')
    li.textContent = url
    return li
  })
  resTable.append(...items)
  
  // @ts-ignore
  const { download, upload } = Object.values(connManager.flowStatistics)
    .reduce((s, p) => {
      // @ts-ignore
      s.upload += p.upload
      // @ts-ignore
      s.download += p.download
      return s
    }, { download: 0, upload: 0 })
  
  p2pUpload.textContent = String(Math.round(upload / 1024))
  p2pDownload.textContent = String(Math.round(download / 1024))
}, 1000)

// -------------- player -------------------

const videoElement = document.getElementById('video')
const mediaSource = new window.MediaSource()
const url = 'http://111.231.13.74/live/46936/index.m3u8'

const p2pContext = {
  fetchAsBuffer(url: string) {
    // console.log('------- fetchAsBuffer: ', url)
    getResourceData(url, ({ value, done }) => {
      // console.log('------- fetchData: ', url, done)
      if (value) this._onResult(url, value)
    })
  }, 
  onPlaylistUpdate(flag, entry) {
    // console.log('----- onPlaylistUpdate: ', flag, entry)
  }
}

// @ts-ignore
const mediaPlayer = new livePlayer.Hls7Player(
  mediaSource, 
  videoElement, 
  true, 
  p2pContext
)
mediaPlayer.keepUsedBuffer = 10; // keep max used buffer in seconds
mediaPlayer.src = url