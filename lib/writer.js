
/**
 * Module dependencies.
 */

var inherits = require('util').inherits;
var Transform = require('readable-stream/transform');
var debug = require('debug')('wave:writer');
var bufferAlloc = require('buffer-alloc');
var bufferFrom = require('buffer-from');

/**
 * Module exports.
 */

module.exports = Writer;

/**
 * RIFF Chunk IDs in Buffers.
 *
 * @api private
 */

var RIFF = bufferFrom('RIFF');
var WAVE = bufferFrom('WAVE');
var fmt = bufferFrom('fmt ');
var data = bufferFrom('data');

/**
 * The max size of the "data" chunk of a WAVE file. This is the max unsigned
 * 32-bit int value, minus 100 bytes (overkill, 44 would be safe) for the header.
 *
 * @api private
 */

var MAX_WAV = 4294967295 - 100;

/**
 * The `Writer` class accepts raw audio data written to it (only PCM audio data is
 * currently supported), and outputs a WAV file with a valid WAVE header at the
 * beginning specifying the formatting information of the audio stream.
 *
 * Note that there's an interesting problem, because the WAVE header also
 * specifies the total byte length of the audio data in the file, and there's no
 * way that we can know this ahead of time. Therefore the WAVE header will contain
 * a byte-length if `0` initially, which most WAVE decoders will know means to
 * just read until `EOF`.
 *
 * Optionally, if you are in a situation where you can seek back to the beginning
 * of the destination of the WAVE file (like writing to a regular file, for
 * example), then you may listen for the `"header"` event which will be emitted
 * _after_ all the data has been written, and you can go back and rewrite the new
 * header with proper audio byte length into the beginning of the destination
 * (though if your destination _is_ a regular file, you should use the the
 * `FileWriter` class instead).
 *
 * @param {Object} opts optional options object
 * @api public
 */

function Writer (opts) {
  if (!(this instanceof Writer)) {
    return new Writer(opts);
  }
  Transform.call(this, opts);

  // TODO: allow/properly handle other WAVE audio formats
  this.endianness = 'LE';
  this.format = 1; // raw PCM
  this.channels = 2;
  this.sampleRate = 44100;
  this.bitDepth = 16;
  this.bytesProcessed = 0;

  if (opts) {
    if (opts.format != null) this.format = opts.format;
    if (opts.channels != null) this.channels = opts.channels;
    if (opts.sampleRate != null) this.sampleRate = opts.sampleRate;
    if (opts.bitDepth != null) this.bitDepth = opts.bitDepth;
  }

  this._writeHeader();
}
inherits(Writer, Transform);

/**
 * Writes the WAVE header.
 *
 * @api private
 */

Writer.prototype._writeHeader = function () {
  debug('_writeHeader()');

  // TODO: 44 is only for format 1 (PCM), any other
  // format will have a variable size...
  var headerLength = 44;

  var dataLength = this.dataLength;
  if (dataLength == null) {
    debug('using default "dataLength" of %d', MAX_WAV);
    dataLength = MAX_WAV;
  }
  var fileSize = dataLength + headerLength;
  var header = bufferAlloc(headerLength);
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
  offset += 4;

  // write the byte rate
  var byteRate = this.byteRate;
  if (byteRate == null) {
    byteRate = this.sampleRate * this.channels * this.bitDepth / 8;
  }
  header['writeUInt32' + this.endianness](byteRate, offset);
  offset += 4;

  // write the block align
  var blockAlign = this.blockAlign;
  if (blockAlign == null) {
    blockAlign = this.channels * this.bitDepth / 8;
  }
  header['writeUInt16' + this.endianness](blockAlign, offset);
  offset += 2;

  // write the bits per sample
  header['writeUInt16' + this.endianness](this.bitDepth, offset);
  offset += 2;

  // write the "data" sub-chunk ID
  data.copy(header, offset);
  offset += data.length;

  // write the remaining length of the rest of the data
  header['writeUInt32' + this.endianness](dataLength, offset);
  offset += 4;

  // save the "header" Buffer for the end, we emit the "header" event at the end
  // with the "size" values properly filled out. if this stream is being piped to
  // a file (or anything else seekable), then this correct header should be placed
  // at the very beginning of the file.
  this._header = header;
  this.headerLength = headerLength;

  this.push(header);
};

/**
 * Called for the "end" event of this Writer instance.
 *
 * @api private
 */

Writer.prototype._onEnd = function (write) {
  debug('_onEnd()');
};

/**
 * Transform incoming data. We don't do anything special, just pass it through.
 *
 * @api private
 */

Writer.prototype._transform = function (chunk, enc, done) {
  this.push(chunk);
  this.bytesProcessed += chunk.length;
  done();
};

/**
 * Emits a "header" event after the readable side of the stream has finished.
 *
 * @api private
 */

Writer.prototype._flush = function (done) {
  debug('_flush()');
  done();
  this.dataLength = this.bytesProcessed;
  process.nextTick(this._emitHeader.bind(this));
};

/**
 * Emits the "header" event. This can safely be ignored, or if you are writing
 * this WAVE file to somewhere that is seekable (i.e. the filesystem), then you
 * should write this "header" buffer at the beginning of the file to get the
 * correct file size values in the file. This isn't too important since most audio
 * players look at the file size rather than those byte values in the header, but
 * it's good to when when possible.
 *
 * @api private
 */

Writer.prototype._emitHeader = function () {
  debug('_emitHeader()');
  var dataLength = this.dataLength;
  var headerLength = this.headerLength;
  var header = this._header;

  // write the file length at the beginning of the header
  header['writeUInt32' + this.endianness](dataLength + headerLength - 8, 4);

  // write the data length at the end of the header
  header['writeUInt32' + this.endianness](dataLength, headerLength - 4);

  this.emit('header', header);
};
