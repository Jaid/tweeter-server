import EventEmitter from "events"

import logger from "lib/logger"

import "src/startDate"

class Core extends EventEmitter {

  async init() {
    logger.info(`${_PKG_TITLE} v${_PKG_VERSION}`)
  }

}

export default new Core