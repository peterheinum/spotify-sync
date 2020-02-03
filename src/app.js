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
express.use('/api/', require('./services/api'))

const port = process.env.PORT || 3000
express.listen(port, () => console.log(`Webhook server is listening, port ${port}`))

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

const request = async ({ options, method }) => {
  !options['headers'] && (options['headers'] = auth_headers())
  return new Promise((res, rej) => {
    _request[method](options, (err, response, body) => {
      err && rej(err)
      body && res(body)
    })
  })
}


const getSongInSync = async () => {
  const tock = Date.now() - track.tick
  const initial_track_progress = track.progress_ms + tock
  const progress_ms = track.progress_ms + tock
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
    return Promise.resolve(false)
  }

  const { item, progress_ms, is_playing } = JSON.parse(response)

  if (!item) {
    return Promise.resolve(false)
  }

  const { id, album, artists, duration_ms } = item
  if (is_playing && id !== track.last_sync_id && !track_on_track()) {
    reset_variables()
    clearInterval(_interval)
    Object.assign(track, { id, tick, album, artists, duration_ms, progress_ms, is_playing, last_sync_id: id })
    getSongInSync()
    broadCastSong()
    return Promise.resolve(true)
  }
  return Promise.resolve(false)
}


const setCurrentlyPlaying = async user => {
  const url = 'https://api.spotify.com/v1/me/player/play'
  const { id, progress_ms } = track
  const body = {
    "uris": ["spotify:track:" + id],
    "position_ms": progress_ms
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

const test = async user => {
  const url = 'https://api.spotify.com/v1/me/player/play'

  const body = {
    "uris": ["spotify:track:561F1zqRwGPCTMRsLsXVtL"],
    "position_ms": track.progress_ms
  }
  

  const options = { url, body, json: true, ...authHeaders(user) }
  console.log(options)
  request({ options, method: 'put' })
    .then(response => {
      console.log(response)
    })
    .catch(err => {
      console.log(err)
    })
}

const broadCastSong = () => {
  const [_, followers] = authorizedUsers
  followers.forEach(follower => setCurrentlyPlaying(follower))
}

eventHub.on('sync', async () => {
  const [leader] = authorizedUsers
  const success = await getCurrentlyPlaying(leader)
  // success && test(leader)
  success && broadCastSong()
  setInterval(() => {
    getCurrentlyPlaying(leader)
  }, 5000)
})

eventHub.on('authRecieved', async recievedAuth => {
  authorizedUsers.push(recievedAuth)
})
