const { MongoClient } = require('mongodb')

let _db = null
let _client = null

async function connect() {
  if (_db) return _db
  const uri = process.env.MONGO_URI || 'mongodb://localhost:27017/lingchong'
  _client = new MongoClient(uri)
  await _client.connect()
  _db = _client.db()
  console.log('[DB] MongoDB connected:', _db.databaseName)

  await _ensureIndexes()
  return _db
}

async function _ensureIndexes() {
  const rankings = _db.collection('rankings')
  await rankings.createIndex({ floor: -1, totalTurns: 1, updatedAt: -1 })
  await rankings.createIndex({ petDexCount: -1, updatedAt: -1 })
  await rankings.createIndex({ maxCombo: -1, updatedAt: -1 })
  await rankings.createIndex({ platform: 1, platformOpenId: 1 }, { unique: true })

  const players = _db.collection('players')
  await players.createIndex({ platform: 1, platformOpenId: 1 }, { unique: true })
  console.log('[DB] Indexes ensured')
}

async function getDb() {
  if (!_db) await connect()
  return _db
}

module.exports = { connect, getDb }
