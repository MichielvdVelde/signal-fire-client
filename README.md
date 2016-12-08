# signal-fire WebRTC JavaScript Client

[![Standard - JavaScript Style Guide](https://img.shields.io/badge/code%20style-standard-brightgreen.svg)](http://standardjs.com/)

The browser client for **[signal-fire](https://github.com/MichielvdVelde/signal-fire)**, a WebRTC signaling server for node.js.
Make adding peer-to-peer to your sites as easy as it can be, supporting **audio/video**
and **data channels**.

The client is designed to work with the **signal-fire signaling server**, and provides
a coherent interface that's easy to set up and use. No more tedious set-ups to perform,
just plug in your options and it's ready to go.

Like signal-fire, this client is a work in progress. New features will be added and
current functionality will be improved in the near future. Please feel welcome
to contribute!

### Features

* **Provides a clean, modern client interface for [signal-fire](https://github.com/MichielvdVelde/signal-fire) users**
  * Uses WebSockets to communicate with the *signal-fire* server
  * Messages are passed using simple JSON objects
* **No manual set up** of WebRTC connections etc - it's done for you!
* Supports **audio/video** and **data channels**
* Uses **ES6** syntax and has been tested in **Firefox 49.0.2** and **Chrome 54**

### Roadmap

* Improve error handling
* Improve documentation

### Dependencies

The client depends on the following dependencies:

* [WebRTC adapter](https://github.com/webrtc/adapter)
* [EventEmitter2](https://github.com/asyncly/EventEmitter2)

Make sure they're available to the client.

### Install

You can install the client using **bower**:

```bash
bower install signal-fire-client
```

You can also manually include [client.js](./lib/client.js). There is also a
[minified version](./lib/client.min.js) available.

### Usage

#### Media streams

The following example shows you how to set up a bidirectional media stream which
can be displayed on the page. The local stream is sent to the remote peer, and vice
versa.

For a more comprehensive example, see the [example](/example) directory.

```js
// Connect to the signal-fire server on the given url
const client = new SignalFireClient('ws://example.com:8080')

// This event is triggered when a new peer connection comes in
client.on('incoming', (peerConnection) => {
  // `peerConnection` is an instance of `SignalFirePeerConnection`

  // Use `getUserMedia` to collect the local stream
  navigator.mediaDevices.getUserMedia(mediaConstraints).then((stream) => {
    // Display the local stream in a <video> element
    localVideo.srcObject = stream
    // And add it to the peer connection
    peerConnection.addStream(stream)
  })

  // This event is triggered when there is an incoming stream
  peerConnection.on('stream', (stream) => {
    // Do with it what you want, like displaying it in a <video> element
    remoteVideo.srcObject = stream
  })
})

// Finally, connect to the server
client.connect().then((myPeerId) => {
  // `myPeerId` contains our unique ID
  console.log('Connected with peerId ' + myPeerId)
})
```

This only handles an incoming peer connection. One of the clients needs to start it.
Here's how you do it.

```js
const remotePeerId = 'someId' // The peer ID of the remote peer to connect to
client.createPeerConnection(remotePeerId).then((peerConnection) => {
  // Use `getUserMedia` to collect the local stream
  navigator.mediaDevices.getUserMedia(mediaConstraints).then((stream) => {
    // Display the local stream in a <video> element
    localVideo.srcObject = stream
    // Add the stream to the peer connection
    peerConnection.addStream(stream)
  })

  // This event is triggered when there is an incoming stream
  peerConnection.on('stream', (stream) => {
    remoteVideo.srcObject = stream
  })
})
```

That's all there is to it!

#### Data channels

The client also support setting up multiple data channels per peer connection.

```js
client.createPeerConnection(remotePeerId).then((peerConnection) => {

  // Create a data channel with the label (name) 'label'
  peerConnection.createDataChannel('label').then((channel) => {
    // `channel` is an instance of `SignalFireDataChannel`
    channel.on('message', (data) => {
      // We got a message!
    })

    // Send a message over the channel
    channel.send('Hello!')
  })

  // This event is fired on an incoming data channel
  peerConnection.on('data_channel', (channel) => {
    // `channel` is an instance of `SignalFireDataChannel`
    channel.on('message', (data) => {
      // We got a message! Send one back
      channel.send('Hello back!')
    })
  })
})
```

### Changelog

* v0.2.1
  * Made minified version available as [client.min.js](./lib/client.min.js)
* v0.2.0
  * Several bugfixes
* v0.1.0
  * Initial release

[![Standard - JavaScript Style Guide](https://cdn.rawgit.com/feross/standard/master/badge.svg)](https://github.com/feross/standard)

### License

Copyright 2016 [Michiel van der Velde](http://www.michielvdvelde.nl).

This software is licensed under the [MIT License](LICENSE).
