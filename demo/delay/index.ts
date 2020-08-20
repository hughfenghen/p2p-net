import { createManager } from '../../src/connect/manager'
import { responseTask } from '../../src/service'

const userId = Math.random().toString(36).slice(2)
const connManager = createManager(userId)

const div = document.createElement('div')
document.body.append(div)

document.getElementById('myId').innerText = userId
setInterval(() => {
  div.innerText = connManager.remoteNodes.map(rn => `remoteId: ${rn.remoteId}, delay: ${rn.delayTime}`).join('\n')
}, 1000)
