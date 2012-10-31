node-wav
========
### `Reader` and `Writer` streams for Microsoft WAVE audio files

This module offers streams to help work with Microsoft WAVE files.


Installation
------------

Install through npm:

``` bash
$ npm install wav
```


Example
-------

Here's how you would play a standard PCM WAVE file out of the speakers using
`node-wav` and `node-speaker`:

``` javascript
var fs = require('fs');
var wav = require('wav');
var Speaker = require('speaker');

var file = fs.createReadStream('track01.wav');
var reader = new wav.Reader();

// the "format" event gets emitted at the end of the WAVE header
reader.on('format', function (format) {

  // the WAVE header is stripped from the output of the reader
  reader.pipe(new Speaker(format));
});

// pipe the WAVE file to the Reader instance
file.pipe(reader);
```


API
---

### Reader class


### Writer class


### FileWriter class

