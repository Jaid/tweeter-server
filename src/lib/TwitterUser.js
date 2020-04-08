import pify from "pify"
import Twit from "twit"

/**
 * @typedef {Object} FileOptions
 */

export default class TwitterUser {
  /**
   * @param {Object} options
   * @param {string} options.handle
   * @param {string} options.internalId
   * @param {string} options.oauthToken
   * @param {string} options.oauthTokenSecret
   * @param {import("./TwitterApp").default} twitterApp
   * @param {string} callbackUrl
   */
  constructor(options, twitterApp, twitterClient) {
    this.twitterClient = twitterClient
    const twit = new Twit({
      access_token: options.oauthToken,
      access_token_secret: options.oauthTokenSecret,
      consumer_key: twitterApp.consumerKey,
      consumer_secret: twitterApp.consumerSecret.twitterConsumerSecret,
    })
    this.twit = pify(twit, {
      multiArgs: true,
      include: ["postMediaChunked"],
      excludeMain: true,
    })
  }

}