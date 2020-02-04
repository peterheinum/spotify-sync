const EventEmitter = require('events')
class EventHub extends EventEmitter {}
const eventHub = new EventHub()

const authHeaders = ({ access_token }) => ({
  headers: {
    'Authorization': 'Bearer ' + access_token,
    'Accept': 'application/json',
    'Content-Type': 'application/json'
  }
})

module.exports = { eventHub, authHeaders }