require('dotenv').config({ path: __dirname + '../../.env' })
const express = require('express')
const router = express.Router()
const _request = require('request')
const { eventHub, authHeaders } = require('../utils/helpers')

const request = async ({ options, method }) => {
  return new Promise((res, rej) => {
    _request[method](options, (err, response, body) => {
      err && rej(err)
      body && res(body)
    })
  })
}

router.get('/', async (req, res) => {
  const redirect_uri = encodeURIComponent(process.env.CALLBACK_URI || 'http://spync.herokuapp.com/callback')
  const scopes = 'user-read-playback-state user-modify-playback-state user-read-email user-read-private'
  const url = `https://accounts.spotify.com/authorize?client_id=${process.env.SPOTIFY_CLIENT_ID}&response_type=code&scope=${scopes}&redirect_uri=${redirect_uri}`
  res.redirect(url)
})

const getUserInfo = async user => {
  const options = {
    url: 'https://api.spotify.com/v1/me',
    ...authHeaders(user)
  }
  const response = await request({ options, method: 'get' })
  const { display_name, images, email } = JSON.parse(response)
  Object.keys(JSON.parse(response)).forEach(key => {console.log(key)})
  const [profileImage] = images
  const { url } = profileImage
  return Promise.resolve({ url, email, displayName: display_name })
}

router.get('/callback', async (req, res) => {
  const { code } = req.query
  const options = {
    url: 'https://accounts.spotify.com/api/token',
    form: {
      'code': code,
      'grant_type': 'authorization_code',
      'redirect_uri': process.env.CALLBACK_URI || 'http://spync.herokuapp.com/callback'
    },
    headers: {
      Authorization: 'Basic ' + (Buffer.from(process.env.SPOTIFY_CLIENT_ID + ':' + process.env.SPOTIFY_CLIENT_SECRET).toString('base64'))
    },
    json: true
  }

  const user = await request({ options, method: 'post' })
  res.location('/')
  res.sendFile(__dirname + '/index.html')
  const { url, displayName, email } = await getUserInfo(user)
  eventHub.emit('authRecieved', { ...user, url, displayName, email })
})

module.exports = router