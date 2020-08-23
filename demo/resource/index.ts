import { getAllResource, getResourceData } from "../../src/resource"
import { connManager } from "../../src/connect/manager"


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

// const inputEl = document.getElementById('res-input') as HTMLInputElement
// document.getElementById('get-res').addEventListener('click', () => {
//   getResourceData(inputEl.value, ({ done, value }) => {
//     console.log('~~~ input res', { done, value })
//   })
// })

// ===================

const imgsUrl = ["https://images.pexels.com/photos/4108278/pexels-photo-4108278.jpeg?auto=compress&cs=tinysrgb&dpr=1&w=500", "https://images.pexels.com/photos/4324405/pexels-photo-4324405.jpeg?auto=compress&cs=tinysrgb&dpr=1&w=500", "https://images.pexels.com/photos/4339335/pexels-photo-4339335.jpeg?auto=compress&cs=tinysrgb&dpr=1&w=500", "https://images.pexels.com/photos/4300715/pexels-photo-4300715.jpeg?auto=compress&cs=tinysrgb&dpr=1&w=500", "https://images.pexels.com/photos/3330118/pexels-photo-3330118.jpeg?auto=compress&cs=tinysrgb&dpr=1&w=500", "https://images.pexels.com/photos/266436/pexels-photo-266436.jpeg?auto=compress&cs=tinysrgb&dpr=1&w=500", "https://images.pexels.com/photos/1558916/pexels-photo-1558916.jpeg?auto=compress&cs=tinysrgb&dpr=1&w=500", "https://images.pexels.com/photos/4279097/pexels-photo-4279097.jpeg?auto=compress&cs=tinysrgb&dpr=1&w=500", "https://images.pexels.com/photos/708440/pexels-photo-708440.jpeg?auto=compress&cs=tinysrgb&dpr=1&w=500", "https://images.pexels.com/photos/3820994/pexels-photo-3820994.jpeg?auto=compress&cs=tinysrgb&dpr=1&w=500"]

document.getElementById('get-imgs').addEventListener('click', () => {
  run(imgsUrl.map(url => () => getResourceData(url, ({ done, value }) => {
    console.log('~~~~~~', { url, done, value })
  })), 3)
})

function run(queue, maxConcurrent) {
  let q = queue.slice(0)
  let c = maxConcurrent

  setInterval(function () {
    if (!q.length) return

    if (c > 0) {
      c -= 1
      q.pop()().finally(() => { c += 1 })
    }
  }, 100)
}


