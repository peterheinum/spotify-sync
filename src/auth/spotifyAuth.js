require('dotenv').config({ path: __dirname + '../../.env' })
const express = require('express')
const router = express.Router()
const _request = require('request')
const { eventHub } = require('../utils/helpers')

const request = async ({ options, method }) => {
  return new Promise((res, rej) => {
    _request[method](options, (err, response, body) => {
      err && rej(err)
      body && res(body)
    })
  })
}

router.get('/', async (req, res) => {
  const redirect_uri = encodeURIComponent('http://spync.herokuapp.com/callback')
  const scopes = 'user-read-playback-state user-modify-playback-state'
  const url = `https://accounts.spotify.com/authorize?client_id=${process.env.SPOTIFY_CLIENT_ID}&response_type=code&scope=${scopes}&redirect_uri=${redirect_uri}`
  res.redirect(url)
})

router.get('/callback', async (req, res) => {
  const { code } = req.query
  console.log(req.query)
  const options = {
    url: 'https://accounts.spotify.com/api/token',
    form: {
      'code': code,
      'grant_type': 'authorization_code',
      'redirect_uri': 'http://spync.herokuapp.com/callback'
    },
    headers: {
      Authorization: 'Basic ' + (Buffer.from(process.env.SPOTIFY_CLIENT_ID + ':' + process.env.SPOTIFY_CLIENT_SECRET).toString('base64'))
    },
    json: true
  }

  const response = await request({ options, method: 'post' })
  const { access_token, refresh_token } = response

  eventHub.emit('authRecieved', { access_token, refresh_token })
  res.sendFile(__dirname + '/index.html')
})

module.exports = router