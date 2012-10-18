
/**
 * Module dependencies.
 */

var assert = require('assert');
var inherits = require('util').inherits;
var debug = require('debug')('wave:reader');
var Parser = require('../parser');

/**
 * Module exports.
 */

module.exports = Reader;

/**
 * The `Reader` class reads WAV audio files and output raw PCM audio data.
 *
 * References:
 *  - http://www.sonicspot.com/guide/wavefiles.html
 *  - https://ccrma.stanford.edu/courses/422/projects/WaveFormat/
 *  - http://www-mmsp.ece.mcgill.ca/Documents/AudioFormats/WAVE/WAVE.html
 */

function Reader (opts) {
  if (!(this instanceof Reader)) {
    return new Reader(opts);
  }
  Parser.call(this, opts);
  this.endianness = 'LE';
  this.buffer(4, this._onChunkID);
}
inherits(Reader, Parser);

Reader.prototype._onChunkID = function (chunk) {
  debug('onChunkID:', chunk);
  // TODO: support RIFX
  var id = chunk.toString('ascii');
  if ('RIFF' === id) {
    this.buffer(4, this._onChunkSize);
  } else {
    this.emit('error', new Error('bad "chunk id": ' + wave));
  }
};

// size of the WAV
Reader.prototype._onChunkSize = function (chunk) {
  debug('onChunkSize:', chunk);
  this.chunkSize = chunk['readUInt32' + this.endianness](0);
  this.buffer(4, this._onFormat);
};

Reader.prototype._onFormat = function (chunk) {
  debug('onFormat:', chunk);
  var wave = chunk.toString('ascii');
  if ('WAVE' === wave) {
    this.buffer(4, this._onSubchunk1ID);
  } else {
    this.emit('error', new Error('bad "format": ' + wave));
  }
};

// size of the "subchunk1" (the header)
Reader.prototype._onSubchunk1ID = function (chunk) {
  debug('onSubchunk1ID:', chunk);
  var subchunk1ID = chunk.toString('ascii');
  if ('fmt ' === subchunk1ID) {
    this.buffer(4, this._onSubchunk1Size);
  } else {
    this.emit('error', new Error('bad "fmt id": ' + wave));
  }
};

Reader.prototype._onSubchunk1Size = function (chunk) {
  debug('onSubchunk1Size:', chunk);
  this.subchunk1Size = chunk['readUInt32' + this.endianness](0);
  // TODO: assert should be 16 for PCM
  this.buffer(this.subchunk1Size, this._onSubchunk1);
};

Reader.prototype._onSubchunk1 = function (chunk) {
  debug('onSubchunk1:', chunk);
  // XXX: support formats other than PCM?
  this.audioFormat = chunk['readUInt16' + this.endianness](0);
  this.numChannels = chunk['readUInt16' + this.endianness](2);
  this.sampleRate = chunk['readUInt32' + this.endianness](4);
  this.byteRate = chunk['readUInt32' + this.endianness](8);
  this.blockAlign = chunk['readUInt16' + this.endianness](12);
  this.bitsPerSample = chunk['readUInt16' + this.endianness](14);
  this.emit('format', this);
  this.buffer(4, this._onSubchunk2ID);
};

Reader.prototype._onSubchunk2ID = function (chunk) {
  debug('onSubchunk2ID:', chunk);
  // TODO: assert "data"
  this.subchunk2ID = chunk.toString('ascii');
  this.buffer(4, this._onSubchunk2Size);
};

// size of the remaining data in this WAV file
Reader.prototype._onSubchunk2Size = function (chunk) {
  debug('onSubchunk2Size:', chunk);
  this.subchunk2Size = chunk['readUInt32' + this.endianness](0);
  this.passthrough(this.subchunk2Size, this._onEnd);
};

Reader.prototype._onEnd = function () {
  debug('onEnd');
  this.done = true;
};
