require('dotenv').config()
const express = require('express')
const cors = require('cors')
const { connect } = require('./db')
const authRouter = require('./routes/auth')
const playerRouter = require('./routes/player')
const rankingRouter = require('./routes/ranking')

const app = express()

app.use(cors())
app.use(express.json({ limit: '1mb' }))

app.get('/health', (req, res) => res.json({ status: 'ok', ts: Date.now() }))

app.use('/api', authRouter)
app.use('/api/player', playerRouter)
app.use('/api/ranking', rankingRouter)

const PORT = process.env.PORT || 8000

app.listen(PORT, async () => {
  console.log(`[Server] running on port ${PORT}`)
  try {
    await connect()
  } catch (err) {
    console.error('[Server] MongoDB connection failed, will retry on first request:', err.message)
  }
})
