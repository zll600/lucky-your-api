/**
 * Redis Cluster
 *
 * Implement redis commands compatible on style with ioredis and
 * use object stream to exec large amount of commands asynchronously.
 */

const { Transform } = require('stream')
const Redis = require('ioredis')
const calculateSlot = require('cluster-key-slot')
const { REDIS_CLUSTER_PASSWORD, REDIS_NAT_MAP } = require('../constants')
const { promisify } = require('util')
 
const COMMAND = [
  'expire', 'expireat', 'pttl', 'ttl',
  'bitcount', 'get', 'getbit', 'incr', 'incrby', 'set', 'setbit', 'setex', 'setnx',
  'hdel', 'hexists', 'hget', 'hgetall', 'hincrby', 'hkeys', 'hmget', 'hset', 'hsetnx',
  'lindex', 'lpop', 'lpush', 'lpushx', 'lrange', 'lrem', 'rpop', 'rpoplpush', 'rpush', 'rpushx',
  'sadd', 'scard', 'sismember', 'smembers', 'spop', 'srem',
  'zadd', 'zcard', 'zcount', 'zincrby', 'zmscore', 'zrange', 'zrangebyscore', 'zrank', 'zrem',
  'zrevrange', 'zrevrangebyscore', 'zrevrank', 'zscore', 'evalsha', 'eval', 'getdel', 'srandmember',
]
 
const EXCOMMAND = ['incr', 'decr', 'lset', 'setbit', 'incrby', 'decrby', 'hset', 'sadd', 'zadd', 'zincrby', 'rpush', 'rpushx', 'lpush', 'lpushx'].map(item => item += 'Ex')
 
function formatArgs(args) {
  return Array.isArray(args) && Array.isArray(args[0])
    ? args[0]
    : args
}
 
function argsToPairs(args) {
  const obj = {}
  let index = 0
  while (index <= args.length - 2) {
    obj[args[index]] = args[index + 1]
    index += 2
  }

  return obj
}
 
function pairsToArgs(pairs) {
  return Object.keys(pairs).reduce((total, current) => total.concat(current, pairs[current]), [])
}
 
class RedisCluster {
  constructor(nodes, options = {}) {
    this._cluster = new Redis.Cluster(nodes, {
      ...options,
      lazyConnect: true,
    })
    this._cluster.expire
  }
 
  async connect() {
    await this._cluster.connect()
    this._stream = new Transform({
      decodeStrings: false,
      highWaterMark: 128,
      objectMode: true,
      transform(chunk, _encoding, callback) {
        if (!Array.isArray(chunk)) {
          callback(new Error('Invalid command'))
        } else {
          callback(null, chunk)
        }
      },
    })
    this._stream.on('data', (chunk) => {
      const [cmd, ...args] = chunk
      if (COMMAND.includes(cmd)) {
        this._cluster[cmd](...args).catch(err => console.error('[RedisCluster] Stream error:', err))
      } else {
        this[cmd](...args).catch(err => console.error('[RedisCluster] Stream error:', err))
      }
    })
    this._stream.on('error', (err) => {
      console.error('[RedisCluster] Unexpected stream error:', err)
    })

    return 'OK'
  }
 
  /**
    * split cross-slot keys into multiple same-slot keys
    *
    * @param {Array<string>} keys - array of keys
    * @returns {Array<Array<string>>} - matrix of keys
    */
  _splitKeys(keys) {
    const keyMap = keys.reduce((total, current) => {
      const slot = calculateSlot(current)
      if (!total[slot]) {
        total[slot] = []
      }
      total[slot].push(current)

      return total
    }, {})

    return Object.values(keyMap)
  }
 
  async del(...keys) {
    const args = formatArgs(keys)
    const chunks = this._splitKeys(args)
    const result = await Promise.all(chunks.map(x => this._cluster.del(...x)))

    return result.reduce((total, current) => total + current, 0)
  }
 
  async exists(...keys) {
    const args = formatArgs(keys)
    const chunks = this._splitKeys(args)
    const result = await Promise.all(chunks.map(x => this._cluster.exists(...x)))

    return result.reduce((total, current) => total + current, 0)
  }
 
  async mget(...keys) {
    const args = formatArgs(keys)
    const chunks = this._splitKeys(args)
    const result = await (async () => {
      const obj = {}
      await Promise.all(
        chunks.map(chunk => (async () => {
          const res = await this._cluster.mget(...chunk)
          chunk.forEach((x, i) => {
            obj[x] = res[i]
          })
        })()),
      )

      return obj
    })()

    return args.map(x => result[x])
  }
 
  async mset(...args) {
    const pairs = args.length === 1 ? args[0] : argsToPairs(args)
    const chunks = this._splitKeys(Object.keys(pairs))
      .map(x => x.reduce((total, current) => {
        total[current] = pairs[current]

        return total
      }, {}))
    await Promise.all(chunks.map(x => this._cluster.mset(x)))

    return 'OK'
  }
 
  async msetnx(...keys) {
    const args = formatArgs(keys)
    const pairs = argsToPairs(args)
    const chunks = this._splitKeys(Object.keys(pairs))
      .map(x => x.reduce((total, current) => {
        total[current] = pairs[current]

        return total
      }, {}))
    const result = await Promise.all(chunks.map(x => this._cluster.msetnx(...pairsToArgs(x))))

    return result.every(x => x === 1) ? 1 : 0
  }
 
  async pipeline(commands) {
    if (commands.some(x => !this[x[0]])) {
      throw new Error('Unsupported command')
    }
 
    const result = []
    for (let i = 0; i < commands.length; i += 1) {
      try {
        const [cmd, ...args] = commands[i]
        const res = await this[cmd](...args)
        result.push([null, res])
      } catch (err) {
        result.push([err, null])
      }
    }

    return result
  }
 
  /**
    * streaming process all commands, used for senarios of heavy write or asynchronous write.
    *
    * @param {Array<Array<string>>} commands - matrix of commands
    */
  stream(commands) {
    if (commands.some(x => !this[x[0]])) {
      throw new Error('Unsupported command')
    }
 
    commands.forEach(x => this._stream.write(x))
  }
}
 
EXCOMMAND.forEach(x => {
  RedisCluster.prototype[x] = async function (...args) {
    const originCommand = x.slice(0, x.length - 2)
    const originParameters = args.splice(0, args.length - 1)
    const [result] = await Promise.all([
      this._cluster[originCommand](...originParameters),
      this._cluster.expire(originParameters[0], args[0]),
    ])

    return result
  }
})
 
COMMAND.forEach(x => {
  RedisCluster.prototype[x] = function (...args) {
    return this._cluster[x](...args)
  }
})
 
const redisOptions = {
  ...REDIS_CLUSTER_PASSWORD ? { password: REDIS_CLUSTER_PASSWORD } : {},
}

const natMap = {}
for (const { intranet, extranet } of REDIS_NAT_MAP) {
  natMap[`${intranet.host}:${intranet.port}`] = extranet
}
const redisCluster = new RedisCluster(
  [
    {
      host: REDIS_NAT_MAP[0].extranet.host,
      port: REDIS_NAT_MAP[0].extranet.port,
    },
  ],
  {
    redisOptions,
    natMap,
  })
 
const redisClusterGetAsync = promisify(redisCluster.get).bind(redisCluster)
 
module.exports = {
  RedisCluster,
  redisCluster,
  redisClusterGetAsync,
}
 