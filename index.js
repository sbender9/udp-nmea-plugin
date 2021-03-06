const dgram = require('dgram')
const os = require('os')
const { Netmask } = require('netmask')

const pkgData = require('./package.json')

const DELIMITERS = {
  None: '',
  CRLF: '\r\n',
  LF: '\n'
}

module.exports = function (app) {
  let socket
  let onStop = []

  return {
    start: options => {
      const address = options.ipaddress || options.broadcastAddress
      console.log(address)
      if (address && address != '-') {
        socket = dgram.createSocket('udp4')
        socket.bind(options.ipaddress, function () {
          socket.setBroadcast(true)
        })

        console.log(options.lineDelimiter)
        const delimiter = DELIMITERS[options.lineDelimiter] || ''
        console.log(delimiter.length)
        const send = message => {
          const msg = `${message}${delimiter}`
          socket.send(
            msg,
            0,
            msg.length,
            options.port,
            options.ipaddress
          )
        }
        console.log(options)
        if (typeof options.nmea0183 === 'undefined' || options.nmea0183) {
          app.signalk.on('nmea0183', send)
          onStop.push(() => {
            app.signalk.removeListener('nmea0183', send)
          })
        }
        if (typeof options.nmea0183out === 'undefined' || options.nmea0183) {
          app.on('nmea0183out', send)
          onStop.push(() => {
            app.removeListener('nmea0183out', send)
          })
        }
        app.setProviderStatus(`Using address ${address}`)
      } else {
        app.setProviderError('No address specified')
      }
    },
    stop: () => {
      onStop.forEach(f => f())
      onStop = []
      if (socket) {
        socket.close()
        socket = undefined
      }
    },
    schema,
    id: 'udp-nmea-sender',
    name: pkgData.description
  }
}

function schema () {
  return {
    type: 'object',
    properties: {
      ipaddress: {
        type: 'string',
        title: 'IP Address (overrides broadcast address if entered)'
      },
      broadcastAddress: {
        type: 'string',
        enum: ['-'].concat(getBroadcastAddresses()),
        default: '-'
      },
      port: {
        type: 'number',
        title: 'Port',
        default: 2000
      },
      nmea0183: {
        type: 'boolean',
        title: 'Use server event nmea0183',
        default: true
      },
      nmea0183out: {
        type: 'boolean',
        title: 'Use server event nmea0183out',
        default: true
      },
      lineDelimiter: {
        type: 'string',
        title: 'Line delimiter',
        enum: ['None', 'LF', 'CRLF'],
        default: 'None'
      }
    }
  }
}

function getBroadcastAddresses () {
  const result = []
  const ifaces = os.networkInterfaces()
  Object.keys(ifaces).forEach(id => {
    ifaces[id].forEach(addressInfo => {
      if (addressInfo.family === 'IPv4' && !addressInfo.internal) {
        const block = new Netmask(
          `${addressInfo.address}/${addressInfo.netmask}`
        )
        result.push(block.broadcast)
      }
    })
  })
  return result
}
