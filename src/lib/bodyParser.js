import bodyParser from "koa-bodyparser"
import {config} from "src/core"

export default bodyParser({
  formLimit: config.apiPayloadLimit,
  textLimit: config.apiPayloadLimit,
  jsonLimit: config.apiPayloadLimit,
  strict: false,
})