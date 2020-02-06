require('dotenv').config({ path: __dirname + '../../.env' })
const express = require('express')()
const bodyParser = require('body-parser')
const _request = require('request')
const compression = require('compression')

//Utils & Shared variables
const { authorizedUsers } = require('./store/store.js')
const { eventHub, authHeaders } = require('./utils/helpers')

//Express config
express.use(compression())
express.use(bodyParser.json())
express.use(bodyParser.urlencoded({ extended: true }))
express.use('/', require('./auth/spotifyAuth'))
express.use('/api/', require('./services/api'))

express.use('/home/:user', (req, res) => {
  res.sendFile(__dirname + '/index.html')
})

const port = process.env.PORT || 3000
express.listen(port, () => console.log(`Webhook server is listening, port ${port}`))


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

const request = async ({ options, method }) => new Promise((resolve, reject) => {
  _request[method](options, (err, response, body) => {
    err && reject(err)
    body && resolve(body)
  })
})


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

const getCurrentlyPlaying = async user => {
  console.log('PING')
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
    "position_ms": progress_ms + 1000
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

const broadCastSong = () => {
  const [_, ...followers] = authorizedUsers
  followers.filter(e => e.isActive).forEach(follower => setCurrentlyPlaying(follower))
}

eventHub.on('sync', async () => {
  const [leader] = authorizedUsers
  if (leader) {
    const success = await getCurrentlyPlaying(leader)
    success && broadCastSong()
    setInterval(() => {
      getCurrentlyPlaying(leader)
    }, 5000)
  }
})
