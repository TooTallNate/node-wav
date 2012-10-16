
/**
 * Module dependencies.
 */

var assert = require('assert');
var inherits = require('util').inherits;
var debug = require('debug')('wave:writer');
var Parser = require('../parser');

/**
 * Module exports.
 */

module.exports = Writer;

/**
 * RIFF Chunk IDs in Buffers.
 */

var RIFF = new Buffer('RIFF');
var WAVE = new Buffer('WAVE');
var fmt  = new Buffer('fmt ');
var data = new Buffer('data');

/**
 * The max size of the "data" chunk of a WAVE file. This is the max unsigned
 * 32-bit int value, minus 100 bytes (overkill, 44 would be safe) for the header.
 */

var MAX_WAV = 4294967295 - 100;

/**
 * The `Writer` class.
 */

function Writer (opts) {
  if (!(this instanceof Writer)) {
    return new Writer(opts);
  }
  Parser.call(this, opts);

  this.endianness = 'LE';

  this.format = 1; // raw PCM
  this.channels = 2;
  this.sampleRate = 44100;
  this.bitsPerSample = 16;

  // the first time _transform() is called, _writeHeader() will be run
  //this.immediate(this._writeHeader);
  this.buffer(0, this._writeHeader);
}
inherits(Writer, Parser);

/**
 * Writes the WAVE header.
 */

Writer.prototype._writeHeader = function (chunk, write) {
  var headerSize = 44; // TODO: 44 is only for format 1 (PCM), any other
                       // format will have a variable size...
  var dataLength = this.dataLength;
  if (null == dataLength) dataLength = MAX_WAV;
  var fileSize = dataLength + headerSize;
  var header = new Buffer(headerSize);
  var offset = 0;

  // write the "RIFF" identifier
  RIFF.copy(header, offset);
  offset += RIFF.length;

  // write the file size minus the identifier and this 32-bit int
  header['writeUInt32' + this.endianness](fileSize - 8, offset);
  offset += 4;

  // write the "WAVE" identifier
  WAVE.copy(header, offset);
  offset += WAVE.length;

  // write the "fmt " sub-chunk identifier
  fmt.copy(header, offset);
  offset += fmt.length;

  // write the size of the "fmt " chunk
  // XXX: value of 16 is hard-coded for raw PCM format. other formats have
  // different size.
  header['writeUInt32' + this.endianness](16, offset);
  offset += 4;

  // write the audio format code
  header['writeUInt16' + this.endianness](this.format, offset);
  offset += 2;

  // write the number of channels
  header['writeUInt16' + this.endianness](this.channels, offset);
  offset += 2;

  // write the sample rate
  header['writeUInt32' + this.endianness](this.sampleRate, offset);
  offset += 4

  // write the byte rate
  var byteRate = this.byteRate;
  if (null == byteRate) {
    byteRate = this.sampleRate * this.channels * this.bitsPerSample / 8;
  }
  header['writeUInt32' + this.endianness](byteRate, offset);
  offset += 4

  // write the block align
  var blockAlign = this.blockAlign;
  if (null == blockAlign) {
    blockAlign = this.channels * this.bitsPerSample / 8;
  }
  header['writeUInt16' + this.endianness](blockAlign, offset);
  offset += 2;

  // write the bits per sample
  header['writeUInt16' + this.endianness](this.bitsPerSample, offset);
  offset += 2;

  // write the "data" sub-chunk ID
  data.copy(header, offset);
  offset += data.length;

  // write the remaining length of the rest of the data
  header['writeUInt32' + this.endianness](dataLength, offset);
  offset += 4;

  // flush the header and after that pass-through "dataLength" bytes
  write(header);
  this.passthrough(dataLength);
};
