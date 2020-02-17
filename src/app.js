require('dotenv').config({ path: __dirname + '../../.env' })
const express = require('express')()
const bodyParser = require('body-parser')
const _request = require('request')
const compression = require('compression')

//Utils & Shared variables
const { authorizedUsers } = require('./store/store.js')
const { eventHub, authHeaders, get } = require('./utils/helpers')

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
  last_sync_id: '',
}

const request = async ({ options, method }) => new Promise((resolve, reject) => {
  _request[method](options, (err, response, body) => {
    err && reject(err)
    body && resolve(body)
  })
})


const getSongInSync = () => {
  // const tock = Date.now() - track.tick
  // const initial_track_progress = track.progress_ms + tock
  // const progress_ms = track.progress_ms + tock
  // const initial_progress_ms = Date.now()

  // Object.assign(track, { initial_track_progress, progress_ms, initial_progress_ms })

  // _interval = setInterval(() => {
  //   track.progress_ms = (Date.now() - initial_progress_ms) + initial_track_progress
  // }, 10 )
}

const resetVariables = () => {
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
    last_sync_id: '',
  })
}

const track_on_track = (progress_ms) =>
  progress_ms + 200 > track.progress_ms &&
  progress_ms - 200 < track.progress_ms

const setTrackId = async () => {
  const [dj] = authorizedUsers
  const url = 'https://api.spotify.com/v1/me/player'
  const options = { url, ...authHeaders(dj) }
  const tick = Date.now()
  const response = await request({ options, method: 'get' })
  const { item, progress_ms, is_playing } = JSON.parse(response)
  const { id } = item
  if(track.last_sync_id != id) {
    resetVariables()
    console.log(' tryna reset!!')
  }

  is_playing && Object.assign(track, { id, progress_ms, tick, last_sync_id: id })
  getSongInSync()
}

const getCurrentTrackId = async user => {
  const url = 'https://api.spotify.com/v1/me/player'
  const options = { url, ...authHeaders(user) }
  const response = await request({ options, method: 'get' })
  return get('id', get('item', JSON.parse(response)))
}


const setCurrentlyPlaying = async (user, log) => {
  const url = 'https://api.spotify.com/v1/me/player/play'
  const { id, progress_ms } = track
  const body = {
    "uris": ["spotify:track:" + id],
    "position_ms": 0 // progress_ms //TODO FIX THIS SO PROGRESS MS IS ALWAYS RESET ON NEW SONG
  }
  log && console.log(body)
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
  const [__, ...followers] = authorizedUsers
  followers.filter(e => e.isActive).forEach(follower => setCurrentlyPlaying(follower))
}

const syncUsers = async () => {
  const [__, ...followers] = authorizedUsers
  await setTrackId()
  const songIds = []
  for (let i = 0; i < followers.length; i++) {
    const { access_token, isActive } = followers[i]
    const id = await getCurrentTrackId({ access_token })
    songIds.push({ id, access_token, isActive })
  }  
  
  console.log({songIds})
  songIds.filter(x => x.id != track.id).forEach(user => {
    console.log(user.isActive)
    console.log('_______')
    user.isActive && setCurrentlyPlaying(user, true)

  })
}


eventHub.on('syncUser', async user => {
  const startPolling = user => {
    setCurrentlyPlaying(user)
    setInterval(() => {
      syncUsers()
    }, 2500)
  }

  authorizedUsers.indexOf(user) == 0 
    ? setTrackId()
    : startPolling(user)
})
