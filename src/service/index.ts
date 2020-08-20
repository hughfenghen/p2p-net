
function streamProducer(onData) {
  const timerId = setInterval(() => {
    onData({ value: new Uint8Array(1024 * 100), done: false })
  }, 100)

  setTimeout(() => {
    clearInterval(timerId)
    onData({ done: true })
  }, 1000)

}

export function responseTask(onData) {
  streamProducer(onData)
}

export function queryTask() {
}