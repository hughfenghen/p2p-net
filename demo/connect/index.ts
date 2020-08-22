import { connManager } from '../../src/connect/manager'

document.getElementById('myId').innerText = connManager.peerId
const connUser = document.getElementById('content-user')
setInterval(() => {
  const lis = connManager.remoteNodes.map(rn => {
    const li = document.createElement('li')
    li.innerText = `remoteId: ${rn.remoteId}, delay: ${rn.delayTime}`
    return li
  })

  connUser.innerHTML = ''
  connUser.append(...lis)
}, 1000)

const tesRs = document.getElementById('test-rs')
document.getElementById('test-get-data').addEventListener('click', async () => {
  tesRs.innerHTML = ''
  let msg = '开始获取数据...<br>'
  let t
  let data

  msg += '--- 获取100K<br>'
  tesRs.innerHTML = msg
  t = Date.now()
  data = await connManager.fetchData({ size: 100 * 1024 })
  msg += `耗时：${Date.now() - t}<br>`
  tesRs.innerHTML = msg

  msg += '--- 获取1M<br>'
  tesRs.innerHTML = msg
  t = Date.now()
  data = await connManager.fetchData({ size: 1024 * 1024 })
  msg += `耗时：${Date.now() - t}<br>`
  tesRs.innerHTML = msg
  
  msg += '--- 获取10M<br>'
  tesRs.innerHTML = msg
  t = Date.now()
  data = await connManager.fetchData({ size: 10 * 1024 * 1024 })
  msg += `耗时：${Date.now() - t}<br>`
  tesRs.innerHTML = msg
  
  msg += '测试完成'
  tesRs.innerHTML = msg
})
