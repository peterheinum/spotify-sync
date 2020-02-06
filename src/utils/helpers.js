const EventEmitter = require('events')
class EventHub extends EventEmitter { }
const eventHub = new EventHub()

const authHeaders = ({ access_token }) => ({
  headers: {
    'Authorization': 'Bearer ' + access_token,
    'Accept': 'application/json',
    'Content-Type': 'application/json'
  }
})

const toHash = str => {
  let hash = 0, i, chr
  if (str.length === 0) return hash
  for (i = 0; i < str.length; i++) {
    chr = str.charCodeAt(i)
    hash = ((hash << 5) - hash) + chr
  }
  return hash
}

const get = (key, obj) =>
  obj.hasOwnProperty(key)
    ? obj[key]
    : {}


module.exports = { eventHub, authHeaders, toHash, get }