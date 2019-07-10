import EventEmitter from "events"

import authServer from "./authServer"
import twitterClient from "./twitterClient"

import "lib/startDate"

class Core extends EventEmitter {

  async init() {
    await twitterClient.init()
    await authServer.init()
  }

}

export default new Core