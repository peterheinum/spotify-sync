require('dotenv').config({ path: __dirname + '../../.env' })
const express = require('express')
const router = express.Router()
const { authorizedUsers } = require('../store/store.js')
const { eventHub } = require('../utils/helpers.js')


router.get('/listUsers', async (req, res) => {
  res.send(authorizedUsers.map(({ displayName, url, isActive }) => ({ displayName, url, isActive })))
})

router.get('/removeUser/:hash', async (req, res) => {
  const { hash } = req.params
  const user = authorizedUsers.find(user => user.hash == hash)
  if(user) {
    user.isActive = false
    authorizedUsers.splice(authorizedUsers.indexOf(user), 1)
    authorizedUsers.push(user)
  }
  res.send(!!user)
})

router.get('/joinUser/:hash', async (req, res) => {
  const { hash } = req.params
  const user = authorizedUsers.find(user => user.hash == hash)
  if(user) {
    user.isActive = true
  }
  res.send(!!user)
})

router.get('/sync/:hash', async (req, res) => {
  const hash = req.params
  const user = authorizedUsers.find(user => user.hash == hash)
  res.send(
    user
      ? { status: 1, message: 'Sync will start' }
      : { status: 0, message: 'Not enough people' }
  )

  user && eventHub.emit('syncUser', user)
})



module.exports = router