
/**
 * Module dependencies.
 */

var util = require('util');
var Parser = require('stream-parser');
var Transform = require('readable-stream/transform');
var debug = require('debug')('wave:reader');
var inherits = util.inherits;
var f = util.format;

/**
 * Values for the `audioFormat` byte.
 */

var formats = {
  WAVE_FORMAT_UNKNOWN: 0x0000, // Microsoft Unknown Wave Format
  WAVE_FORMAT_PCM: 0x0001, // Microsoft PCM Format
  WAVE_FORMAT_ADPCM: 0x0002, // Microsoft ADPCM Format
  WAVE_FORMAT_IEEE_FLOAT: 0x0003, // IEEE float
  WAVE_FORMAT_VSELP: 0x0004, // Compaq Computer's VSELP
  WAVE_FORMAT_IBM_CVSD: 0x0005, // IBM CVSD
  WAVE_FORMAT_ALAW: 0x0006, // 8-bit ITU-T G.711 A-law
  WAVE_FORMAT_MULAW: 0x0007, // 8-bit ITU-T G.711 µ-law
  WAVE_FORMAT_EXTENSIBLE: 0xFFFE // Determined by SubFormat
};

/**
 * Module exports.
 */

module.exports = Reader;

/**
 * The `Reader` class accepts a WAV audio file written to it and outputs the raw
 * audio data with the WAV header stripped (most of the time, PCM audio data will
 * be output, depending on the `audioFormat` property).
 *
 * A `"format"` event gets emitted after the WAV header has been parsed.
 *
 * @param {Object} opts optional options object
 * @api public
 */

function Reader (opts) {
  if (!(this instanceof Reader)) {
    return new Reader(opts);
  }
  Transform.call(this, opts);

  this._bytes(4, this._onRiffID);
}
inherits(Reader, Transform);

/**
 * Mixin `Parser`.
 */

Parser(Reader.prototype);

// the beginning of the WAV file
Reader.prototype._onRiffID = function (chunk) {
  debug('onRiffID: %o', chunk);
  var id = this.riffId = chunk.toString('ascii');
  if (id === 'RIFF') {
    debug('detected little-endian WAVE file');
    this.endianness = 'LE';
    this._bytes(4, this._onChunkSize);
  } else if (id === 'RIFX') {
    debug('detected big-endian WAVE file');
    this.endianness = 'BE';
    this._bytes(4, this._onChunkSize);
  } else {
    this.emit('error', new Error(f('bad "chunk id": expected "RIFF" or "RIFX", got %j', id)));
  }
};

// size of the WAV
Reader.prototype._onChunkSize = function (chunk) {
  debug('onChunkSize: %o', chunk);
  this.chunkSize = chunk['readUInt32' + this.endianness](0);
  this._bytes(4, this._onFormat);
};

// the RIFF "format", should always be "WAVE"
Reader.prototype._onFormat = function (chunk) {
  debug('onFormat: %o', chunk);
  this.waveId = chunk.toString('ascii');
  if (this.waveId === 'WAVE') {
    this._bytes(4, this._onSubchunk1ID);
  } else {
    this.emit('error', new Error(f('bad "format": expected "WAVE", got %j', this.waveId)));
  }
};

// size of the "subchunk1" (the header)
Reader.prototype._onSubchunk1ID = function (chunk) {
  debug('onSubchunk1ID: %o', chunk);
  var subchunk1ID = chunk.toString('ascii');
  this.chunkId = subchunk1ID;
  if (subchunk1ID === 'fmt ') {
    this._bytes(4, this._onSubchunk1Size);
  } else {
    this.emit('error', new Error(f('bad "fmt id": expected "fmt ", got %j', subchunk1ID)));
  }
};

Reader.prototype._onSubchunk1Size = function (chunk) {
  debug('onSubchunk1Size: %o', chunk);
  this.subchunk1Size = chunk['readUInt32' + this.endianness](0);
  // TODO: assert should be 16 for PCM
  this._bytes(this.subchunk1Size, this._onSubchunk1);
};

Reader.prototype._onSubchunk1 = function (chunk) {
  debug('onSubchunk1: %o', chunk);
  this.audioFormat = chunk['readUInt16' + this.endianness](0);
  this.channels = chunk['readUInt16' + this.endianness](2);
  this.sampleRate = chunk['readUInt32' + this.endianness](4);
  this.byteRate = chunk['readUInt32' + this.endianness](8); // useless...
  this.blockAlign = chunk['readUInt16' + this.endianness](12); // useless...
  this.bitDepth = chunk['readUInt16' + this.endianness](14);
  this.signed = this.bitDepth !== 8;

  var format = {
    audioFormat: this.audioFormat,
    endianness: this.endianness,
    channels: this.channels,
    sampleRate: this.sampleRate,
    byteRate: this.byteRate,
    blockAlign: this.blockAlign,
    bitDepth: this.bitDepth,
    signed: this.signed
  };

  switch (format.audioFormat) {
    case formats.WAVE_FORMAT_PCM:
      // default, common case. don't need to do anything.
      break;
    case formats.WAVE_FORMAT_IEEE_FLOAT:
      format.float = true;
      break;
    case formats.WAVE_FORMAT_ALAW:
      format.alaw = true;
      break;
    case formats.WAVE_FORMAT_MULAW:
      format.ulaw = true;
      break;
  }

  this.emit('format', format);

  this._bytes(4, this._onSubchunk2ID);
};

Reader.prototype._onSubchunk2ID = function (chunk) {
  debug('onSubchunk2ID: %o', chunk);
  var subchunk2ID = chunk.toString('ascii');

  if (subchunk2ID === 'data') {
    // Data Chunk - "data"
    this._bytes(4, this._onDataChunkSize);
  } else if (subchunk2ID === 'fact') {
    // Fact Chunk - "fact"
    this._bytes(4, this._onFactChunkSize);
  } else {
    // Unknown Chunk - parse it an emit a "chunk" event
    debug('parsing unknown %o chunk', subchunk2ID);
    this.unknownID = subchunk2ID;
    this._bytes(4, this._onUnknownChunkSize);
  }
};

// size of the remaining data in this WAV file
Reader.prototype._onDataChunkSize = function (chunk) {
  debug('onDataChunkSize: %o', chunk);
  var chunkSize = chunk['readUInt32' + this.endianness](0);

  if (chunkSize === 0) {
    // Some encoders write `0` for the byte length here in the case of a WAV file
    // being generated on-the-fly. In that case, we're just gonna passthrough the
    // remaining bytes assuming they're going to be audio data.
    chunkSize = Infinity;
  }

  this._passthrough(chunkSize, this._onDataChunkDone);
};

Reader.prototype._onDataChunkDone = function () {
  debug('onFactChunkDone');
  // now we're done with the "data" chunk so read a new "chunk ID" to figure out
  // what's next
  this._bytes(4, this._onSubchunk2ID);
};

Reader.prototype._onFactChunkSize = function (chunk) {
  debug('onFactChunkSize: %o', chunk);
  var chunkDataSize = chunk['readUInt32' + this.endianness](0);
  this._bytes(chunkDataSize, this._onFactChunkData);
};

Reader.prototype._onFactChunkData = function (chunk) {
  debug('onFactChunkData: %o', chunk);
  // There is currently only one field defined for the format dependant data.
  // It is a single 4-byte value that specifies the number of samples in the
  // waveform data chunk.
  //
  // The number of samples field is redundant for sampled data, since the Data
  // chunk indicates the length of the data. The number of samples can be
  // determined from the length of the data and the container size as determined
  // from the Format chunk.
  var numSamples = chunk['readUInt32' + this.endianness](0);
  debug('number of samples: %o', numSamples);
  this.numSamples = numSamples;

  // now we're done with the "fact" chunk so read a new "chunk ID" to figure out
  // what's next
  this._bytes(4, this._onSubchunk2ID);
};

Reader.prototype._onUnknownChunkSize = function (chunk) {
  debug('onUnknownChunkSize: %o', chunk);
  var chunkSize = chunk['readUInt32' + this.endianness](0);
  this._bytes(chunkSize, this._onUnknownChunkData);
};

Reader.prototype._onUnknownChunkData = function (chunk) {
  debug('onUnknownChunkData: %o', chunk);

  this.emit('chunk', {
    id: this.unknownID,
    data: chunk
  });

  // now we're done with the "unknown" chunk so read a new "chunk ID" to figure
  // out what's next
  this._bytes(4, this._onSubchunk2ID);
};
