require('dotenv').config({ path: __dirname + '../../.env' })
const express = require('express')
const router = express.Router()
const { eventHub } = require('../utils/helpers')
const { authorizedUsers } = require('../store/store.js')


router.get('/listUsers', async (req, res) => {
  res.send(authorizedUsers)
})

module.exports = router