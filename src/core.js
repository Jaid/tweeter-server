import EventEmitter from "events"

import logger from "lib/logger"
import config from "lib/config"
import Twit from "twit"

import "lib/startDate"

class Core extends EventEmitter {

  async init() {
    this.twit = new Twit({
      consumer_key: config.twitterConsumerKey,
      consumer_secret: config.twitterConsumerSecret,
      access_token: config.twitterAccessToken,
      access_token_secret: config.twitterAccessSecret,
    })
  }

}

export default new Core