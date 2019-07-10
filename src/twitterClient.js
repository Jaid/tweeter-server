import crypto from "crypto"

import got from "got"
import config from "lib/config"
import logger from "lib/logger"
import Oauth from "oauth-1.0a"
import queryString from "query-string"

const hash_function = (base_string, key) => {
  return crypto
    .createHmac("sha1", key)
    .update(base_string)
    .digest("base64")
}

class TwitterClient {

  constructor() {
    this.client = new Oauth({
      hash_function,
      consumer: {
        key: config.twitterConsumerKey,
        secret: config.twitterConsumerSecret,
      },
      signature_method: "HMAC-SHA1",
    })
  }

  async init() {
  }

  async signGot(options) {
    options = {
      method: "POST",
      ...options,
    }
    const signedOauthRequest = this.client.authorize(options)
    return got(options.url, {
      method: options.method,
      form: signedOauthRequest,
      headers: this.client.toHeader(signedOauthRequest),
    })
  }

  async getRequestToken() {
    const requestOptions = {
      url: "https://api.twitter.com/oauth/request_token",
      data: {
        oauth_callback: `${config.protocol}://${config.host}:${config.port}/callback`,
      },
    }
    const requestTokenRequest = await this.signGot(requestOptions)
    return requestTokenRequest.body |> queryString.parse
  }

}

export default new TwitterClient