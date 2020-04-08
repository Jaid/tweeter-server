import crypto from "crypto"

export default (text, key) => {
  return crypto.createHmac("sha1", key).update(text).digest("base64")
}