export enum MsgType {
  Ping = 'ping',
  Pong = 'pong',
  FetchStream = 'fetchStream',
  FetchData = 'fetchData',
  ResourceInfoSync = 'resourceInfoSync',
}

export type RespHandler = ({ done: boolean, value: any }) => void
