require('dotenv').config({ path: __dirname + '../../.env' })
const express = require('express')
const router = express.Router()
const { authorizedUsers } = require('../store/store.js')
const { eventHub } = require('../utils/helpers.js')


router.get('/listUsers', async (req, res) => {
  res.send(authorizedUsers)
})

router.get('/removeUser/:hash', async (req, res) => {
  const { hash } = req.params
  const match = authorizedUsers.find(user => user.hash == hash)
  if(match) {
    match.isActive = false
    authorizedUsers.splice(authorizedUsers.indexOf(match), 1)
    authorizedUsers.push(match)
  }
  res.send(!!match)
})

router.get('/joinUser/:hash', async (req, res) => {
  const { hash } = req.params
  const match = authorizedUsers.find(user => user.hash == hash)
  match.isActive = true
  res.send(!!match)
})

router.get('/sync', async (req, res) => {
  res.send(
    authorizedUsers.length > 1
      ? { status: 1, message: 'Sync will start' }
      : { status: 0, message: 'Not enough people' }
  )

  authorizedUsers.length > 1 && eventHub.emit('sync')
})



module.exports = router