const EventEmitter = require('events')
class EventHub extends EventEmitter {}
const eventHub = new EventHub()

module.exports = { eventHub }