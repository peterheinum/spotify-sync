require('dotenv').config({ path: __dirname + '../../.env' })
const express = require('express')()
const bodyParser = require('body-parser')
const _request = require('request')
const compression = require('compression')
const { authorizedUsers } = require('./store/store.js')

//Express config
express.use(compression())
express.use(bodyParser.json())
express.use(bodyParser.urlencoded({ extended: true }))
express.use('/', require('./auth/spotifyAuth'))
express.use('/api/ui', require('./services/ui'))

express.listen(3000, () => console.log('Webhook server is listening, port 3000'))



const { eventHub } = require('./utils/helpers')

const auth = {
  access_token: '',
  refresh_token: ''
}

let _interval

const track = {
  //Meta data
  id: '',
  artist: {},
  album: {},
  meta: {},

  //Time & Sync
  tick: 0,
  tock: 0,
  initial_track_progress: 0,
  progress_ms: 0,
  duration_ms: 0,
  is_playing: false,
  duration_ms: 0,
  last_sync_id: '',
}


const auth_headers = () => ({
  'Authorization': 'Bearer ' + authorizedUsers[0].access_token,
  'Accept': 'application/json',
  'Content-Type': 'application/json'
})

const request = async ({ options, method, log }) => {
  !options['headers'] && (options['headers'] = auth_headers())
  return new Promise((res, rej) => {
    _request[method](options, (err, response, body) => {
      log && console.log(err, body)
      err && rej(err)
      body && res(body)
    })
  })
}


const getSongInSync = async () => {
  const tock = Date.now() - track.tick
  const initial_track_progress = track.progress_ms + tock
  const progress_ms = track.progress_ms + tock - 500
  const initial_progress_ms = Date.now()

  Object.assign(track, { initial_track_progress, progress_ms, initial_progress_ms })

  _interval = setInterval(() => {
    track.progress_ms = (Date.now() - initial_progress_ms) + initial_track_progress
  }, 10)
}

const reset_variables = () => {
  Object.assign(track, {
    //Meta data
    id: '',
    artist: {},
    album: {},
    meta: {},

    //Time & Sync
    tick: 0,
    tock: 0,
    initial_track_progress: 0,
    progress_ms: 0,
    duration_ms: 0,
    is_playing: false,
    duration_ms: 0,
    last_sync_id: '',
  })
}

const track_on_track = (progress_ms) =>
  progress_ms + 200 > track.progress_ms &&
  progress_ms - 200 < track.progress_ms

const authHeaders = ({ access_token }) => ({
  headers: {
    'Authorization': 'Bearer ' + access_token,
    'Accept': 'application/json',
    'Content-Type': 'application/json'
  }
})

const getCurrentlyPlaying = async user => {
  const url = 'https://api.spotify.com/v1/me/player'

  const options = { url }
  const tick = Date.now()
  const response = await request({ options, method: 'get', ...authHeaders(user) })

  if (response.error) {
    eventHub.emit('renew_spotify_token')
    console.error('error:', response)
    return
  }

  const { item, progress_ms, is_playing } = JSON.parse(response)

  if (!item) {
    return
  }

  const { id, album, artists, duration_ms } = item
  if (is_playing && id !== track.last_sync_id && !track_on_track()) {
    reset_variables()
    clearInterval(_interval)
    Object.assign(track, { id, tick, album, artists, duration_ms, progress_ms, is_playing, last_sync_id: id })
    getSongInSync()
  }
}


const setCurrentlyPlaying = async user => {
  const url = 'https://api.spotify.com/v1/me/player/play'
  const body = {
    "context_uri": "spotify:song:6g7tnzofmW5mp56kjkkotc",
    "offset": {
      "position": 5
    },
    "position_ms": 0
  }

  const options = { url, body, json: true, ...authHeaders(user) }
  request({ options, method: 'put', log: true })
    .then(response => {
      console.log(response)
    })
    .catch(err => {
      console.log(err)
    })
}

eventHub.on('authRecieved', recievedAuth => {
  authorizedUsers.push(recievedAuth)
  const [leader, ...sheeps]
  await getCurrentlyPlaying(leader)
  sheeps.forEach(sheep => setCurrentlyPlaying(sheep))

  setInterval(() => {
    getCurrentlyPlaying()
  }, 5000)
})
