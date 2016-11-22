/* eslint-env browser */
(function (window) {
  if (!window.EventEmitter2) {
    throw new Error('signal-fire-client requires EventEmitter2')
  }

  class SignalFireDataChannel extends window.EventEmitter2 {
    constructor (peerConnection, label, channel, options = {}) {
      super()
      this._peerConnection = peerConnection
      this._label = label
      this._open = false

      this._channel = channel
      this._channel.onopen = () => this._onOpen()
      this._channel.onclose = () => this._onClose()
      this._channel.onmessage = (event) => this.emit('message', event.data)
    }

    send (data) {
      return new Promise((resolve, reject) => {
        if (!this._open) {
          reject(new Error('data channel closed'))
        } else {
          this._channel.send(data)
          resolve()
        }
      })
    }

    close () {
      if (!this._open) {
        this._channel.close()
      }
    }

    _onOpen () {
      this._open = true
      this.emit('open')
    }

    _onClose () {
      this._open = false
      this._channel = null
      this.emit('close')
    }
  }

  class SignalFirePeerConnection extends window.EventEmitter2 {
    constructor (client, remotePeerId, options = {}) {
      super()
      this._client = client
      this._remotePeerId = remotePeerId
      this._options = options
      this._dataChannels = {}

      this._peerConnection = new RTCPeerConnection()
      this._peerConnection.onicecandidate = (event) => this._onIceCandidate(event.candidate)
      this._peerConnection.onnegotiationneeded = () => this._onNegotiationNeeded()
      this._peerConnection.onaddstream = (event) => this._onAddStream(event.stream)
      this._peerConnection.ondatachannel = (event) => this._onDataChannel(event.channel)
    }

    addStream (stream) {
      this._peerConnection.addStream(stream)
    }

    createDataChannel (label, channel = null, options = {}) {
      return new Promise((resolve, reject) => {
        channel = channel || this._peerConnection.createDataChannel(label, options)
        let dataChannel = new SignalFireDataChannel(this, label, channel, options)
        dataChannel.on('close', () => {
          // Remove data channel when it closes
          if (this._dataChannels[label]) {
            delete this._dataChannels[label]
          }
        })
        this._dataChannels[label] = dataChannel
        resolve(dataChannel)
      })
    }

    _onIceCandidate (candidate) {
      if (candidate) {
        this._send('ice', {
          candidate: candidate
        })
      }
    }

    _onNegotiationNeeded () {
      this._peerConnection.createOffer().then((offer) => {
        return this._peerConnection.setLocalDescription(offer)
      }).then(() => {
        return this._send('offer', {
          sdp: this._peerConnection.localDescription
        })
      })
    }

    _onAddStream (stream) {
      this.emit('stream', stream)
    }

    _onDataChannel (channel) {
      this.createDataChannel(channel.label, channel).then((dataChannel) => {
        this.emit('data_channel', dataChannel)
      })
    }

    _onMessage (msg) {
      switch (msg.type) {
        case 'ice':
          this._peerConnection.addIceCandidate(new RTCIceCandidate(msg.candidate))
          break
        case 'offer':
          this._peerConnection.setRemoteDescription(msg.sdp).then(() => {
            return this._peerConnection.createAnswer()
          }).then((answer) => {
            return this._peerConnection.setLocalDescription(answer)
          }).then(() => {
            return this._send('answer', {
              sdp: this._peerConnection.localDescription
            })
          })
          break
        case 'answer':
          this._peerConnection.setRemoteDescription(new RTCSessionDescription(msg.sdp))
          break
        default:
          this.emit('unknown_message_type', msg.type, msg)
          break
      }
    }

    _send (type, msg) {
      msg.type = type
      msg.senderId = this._client._peerId
      msg.receiverId = this._remotePeerId
      msg.peerId = msg.receiverId // Hack for signal-fire v0.1.0
      return this._client.send(msg)
    }
  }

  class SignalFireClient extends window.EventEmitter2 {
    constructor (url) {
      super()
      this._url = url
      this._socket = null
      this._peerConnections = {}

      this._peerId = null
      this._open = false
      this._ready = false
    }

    connect () {
      return new Promise((resolve, reject) => {
        if (this._socket !== null) {
          reject(new Error('socket already active'))
        } else {
          this._socket = new WebSocket(this._url)

          this._socket.onopen = () => this._onSocketOpen()
          this._socket.onerror = (err) => this._onSocketError(err)
          this._socket.onclose = () => this._onSocketClose()
          this._socket.onmessage = (event) => {
            const msg = JSON.parse(event.data)
            if (this._peerId === null && msg.type === 'id' && msg.peerId) {
              this._peerId = msg.peerId
              this._ready = true
              this._socket.onmessage = (event) => this._onSocketMessage(event)
              this.emit('ready')
              resolve(this._peerId)
            }
          }
        }
      })
    }

    createPeerConnection (remotePeerId = null, options = {}) {
      return new Promise((resolve, reject) => {
        if (!this._ready) {
          reject(new Error('client not ready'))
        } else if (remotePeerId === null) {
          reject(new Error('remote peer id can not be null'))
        } else if (this._peerConnections[remotePeerId]) {
          reject(new Error('peer connection already exists. use getPeerConnection()'))
        } else {
          this._peerConnections[remotePeerId] = new SignalFirePeerConnection(this, remotePeerId, options)
          resolve(this._peerConnections[remotePeerId])
        }
      })
    }

    getPeerConnection (remotePeerId = null) {
      return new Promise((resolve, reject) => {
        if (!this._ready) {
          reject(new Error('client not ready'))
        } else if (remotePeerId === null) {
          reject(new Error('remote peer id can not be null'))
        } else if (!this._peerConnections[remotePeerId]) {
          reject(new Error('connection not found'))
        } else {
          resolve(this._peerConnections[remotePeerId])
        }
      })
    }

    send (msg) {
      return new Promise((resolve, reject) => {
        if (!this._open) {
          reject(new Error('connection not open'))
        } else if (!this._ready) {
          reject(new Error('connection not ready'))
        } else {
          this._socket.send(JSON.stringify(msg))
          resolve()
        }
      })
    }

    close () {
      if (this._socket) {
        this._socket.close()
      }
    }

    _onSocketOpen () {
      this._open = true
    }

    _onSocketError (/* error */) {
      //
    }

    _onSocketClose () {
      this._open = false
      this._ready = false
      this._socket = null
    }

    _onSocketMessage (event) {
      let msg = null
      try {
        msg = JSON.parse(event.data)
      } catch (err) { }

      if (msg !== null) {
        if (!this._peerConnections[msg.senderId]) {
          this.createPeerConnection(msg.senderId).then((peerConnection) => {
            this.emit('incoming', peerConnection)
            peerConnection._onMessage(msg)
          })
        } else {
          this._peerConnections[msg.senderId]._onMessage(msg)
        }
      }
    }
  }

  // Make the client available
  window.SignalFireClient = SignalFireClient
})(window)
