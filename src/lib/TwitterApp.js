import OauthClient from "oauth-1.0a"
import queryString from "query-string"

import hashOauth from "lib/hashOauth"

export default class TwitterApp {

  /**
   * @param {string} consumerKey
   * @param {string} consumerSecret
   */
  constructor(consumerKey, consumerSecret, twitterClient) {
    this.twitterClient = twitterClient
    this.consumerKey = consumerKey
    this.consumerSecret = consumerSecret
    this.oauthClient = new OauthClient({
      hash_function: hashOauth,
      consumer: {
        key: consumerKey,
        secret: consumerSecret,
      },
      signature_method: "HMAC-SHA1",
    })
  }

  /**
   * @return {Promise<Object>}
   */
  async getRequestToken() {
    const requestOptions = {
      url: "https://api.twitter.com/oauth/request_token",
      data: {
        oauth_callback: this.twitterClient.config.callbackUrl,
      },
    }
    const response = await this.twitterClient.signGot(requestOptions)
    return queryString.parse(response.body)
  }

  async signGot(options, oauthToken) {
    options = {
      method: "POST",
      ...options,
    }
    const signedOauthRequest = this.oauthClient.authorize(options, oauthToken)
    return this.twitterClient.core.got(options.url, {
      method: options.method,
      form: options.data,
      headers: this.oauthClient.toHeader(signedOauthRequest),
    })
  }

}