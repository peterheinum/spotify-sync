require('dotenv').config({ path: __dirname + '../../.env' })
const express = require('express')
const router = express.Router()
const { authorizedUsers } = require('../store/store.js')
const { eventHub } = require('../utils/helpers.js')


router.get('/listUsers', async (req, res) => {
  res.send(authorizedUsers)
})

router.get('/sync', async (req, res) => {
  res.send(
    authorizedUsers.length > 0
      ? { status: 1, message: 'Sync will start' }
      : { status: 0, message: 'Not enough people' }
  )

  authorizedUsers.length > 0 && eventHub.emit('sync')
})



module.exports = router