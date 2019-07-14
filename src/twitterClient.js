import path from "path"

import config from "lib/config"
import logger from "lib/logger"
import globby from "globby"
import fsp from "@absolunet/fsp"
import Twit from "twit"
import pify from "pify"

/**
 * @typedef {Object} User
 * @prop {string} internalId
 * @prop {string} id
 * @prop {string} handle
 * @prop {string} oauthToken
 * @prop {string} oauthTokenSecret
 * @prop {Twit} twit
 */

class TwitterClient {

  constructor() {
    this.oauthCallback = `${config.protocol}://${config.host}:${config.apiPort}/callback`
    this.usersFolder = path.join(logger.appFolder, "users")
  }

  async init() {
    const userFiles = await globby("*/credentials.yml", {
      cwd: this.usersFolder,
      onlyFiles: true,
      absolute: true,
    })
    const loadUsersJobs = userFiles.map(async file => {
      const user = await fsp.readYaml(file)
      const twit = new Twit({
        access_token: user.oauthToken,
        access_token_secret: user.oauthTokenSecret,
        consumer_key: config.twitterConsumerKey,
        consumer_secret: config.twitterConsumerSecret,
      })
      user.twit = pify(twit, {
        multiArgs: true,
        include: ["postMediaChunked"],
        excludeMain: true,
      })
      return user
    })
    /**
     * @type {User[]}
     */
    this.users = await Promise.all(loadUsersJobs)
    logger.info("Started twitterClient with %s users", this.users.length)
    logger.debug("Callback: %s", this.oauthCallback)
  }

  getUserByInternalId(id) {
    return this.users.find(({internalId}) => internalId === id)
  }

  getFolderForUser(internalId) {
    return path.join(this.usersFolder, internalId)
  }

  getCredentialsPathForUser(internalId) {
    return path.join(this.getFolderForUser(internalId), "credentials.yml")
  }

  async tweet(internalId, text) {
    try {
      const user = this.getUserByInternalId(internalId)
      if (!user) {
        throw new new Error("User not found")
      }
      await user.twit.post("statuses/update", {
        status: text,
      })
    } catch (error) {
      logger.error("Could not tweet for @%s: %s", internalId, error)
    }
  }

  async uploadMedia(internalId, file, text) {
    try {
      const user = this.getUserByInternalId(internalId)
      if (!user) {
        throw new new Error("User not found")
      }
      const [{media_id_string: mediaId}] = await user.twit.postMediaChunked({
        file_path: file,
      })
      logger.info("Media %s", mediaId)
      await user.twit.post("statuses/update", {
        status: text,
        media_ids: mediaId,
      })
    } catch (error) {
      logger.error("Could not post media %s for @%s: %s", file, internalId, error)
    }
  }

}

export default new TwitterClient