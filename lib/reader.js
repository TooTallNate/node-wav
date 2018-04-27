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
 * Utility function
 */
function stripNull (mystring){
  return mystring.split(/\u0000/)[0].trim()
}

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
  if ('WAVE' === this.waveId) {
    this._bytes(4, this._onSubchunkID); // start processing the rest of the chunks
  } else {
    this.emit('error', new Error(f('bad "format": expected "WAVE", got %j', this.waveId)));
  }
};

Reader.prototype._onSubchunkID = function (chunk) {
  debug('onSubChunkID:', chunk);
  var subchunkID = chunk.toString('ascii');
  this.chunkId = subchunkID;
  debug('onSubChunkID: detected chunk ID', this.chunkId);
  switch(subchunkID)
  {
    case 'fmt ':
      this._bytes(4, this._onSubchunkFmtSize);
      break;
    case 'data':
      this._bytes(4, this._onSubchunkDataSize);
      break;
    case 'bext':
      this._bytes(4, this._onSubchunkBextSize);
      break;
    case 'cart':
      this._bytes(4, this._onSubchunkCartSize);
      break;
    case 'fact':
      this._bytes(4, this._onSubchunkFactSize);
      break;
    default:
      this._bytes(4, this._onSubchunkUnknownSize);
      break;
  }
}

Reader.prototype._onSubchunkUnknownSize = function (chunk) {
  debug('onSubchunkUnknownSize:',chunk);
  this.subchunkUnknownSize =  chunk['readUInt32' + this.endianness](0);
  this._bytes(this.subchunkUnknownSize, this._onSubchunkUnknown);
}

Reader.prototype._onSubchunkUnknown = function (chunk) {
  debug('onSubchunkUnknown:', chunk);
  // emit "unknown" event with the raw data for the client to deal with (if they want)
  debug('unknownChunkId:', this.chunkId)
  this.emit('unknown', {
    chunk_id : this.chunkId,
    chunk_data : chunk
  });
  this._bytes(4, this._onSubchunkID);
}

Reader.prototype._onSubchunkFmtSize = function (chunk) {
  debug('onSubchunkFmtSize:', chunk);
  this.subchunk1Size = chunk['readUInt32' + this.endianness](0);
  // TODO: assert should be 16 for PCM
  this._bytes(this.subchunk1Size, this._onSubchunkFmt);
};

Reader.prototype._onSubchunkFmt = function (chunk) {
  debug('onSubchunkFmt:', chunk);
  // TODO: support formats other than PCM?
  // lets do it!
  this.audioFormat = chunk['readUInt16' + this.endianness](0);
  debug('onSubhcunkFmt:', formats[this.audioFormat])
  if (formats[this.audioFormat])
  {
     this.audioFormatName = formats[this.audioFormat]
  } else {
     this.audioFormatName = 'Unknown';
  }
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
  this._bytes(4, this._onSubchunkID);
};


Reader.prototype._onSubchunkFactSize = function (chunk) {
  debug('onSubchunkFactSize:', chunk)
  this.subchunkFactSize = chunk['readUInt32' + this.endianness](0);
  debug('onSubchunkFactSize: Got size as ' + this.subchunkFactSize)
  this._bytes(this.subchunkFactSize, this._onSubchunkFact);
};

Reader.prototype._onSubchunkFact = function (chunk) {
  debug('onSubchunkFact:', chunk)
  sampleLength = chunk['readUInt32' + this.endianness](0);
  this.emit('fact', {
    'sampleLength': sampleLength
  });
  this._bytes(4, this._onSubchunkID);
};

Reader.prototype._onSubchunkBextSize = function (chunk) {
  debug('onSubchunkBextSize:', chunk);
  this.subchunkBextSize = chunk['readUInt32' + this.endianness](0);
  this._bytes(this.subchunkBextSize, this._onSubchunkBext);
};

Reader.prototype._onSubchunkBext = function (chunk) {
  debug('onSubchunkBext:', chunk);
  // Reference :   Specification of the Broadcast Wave Format (BWF)
  //         EBU TECH 3285 (May 2011)
  //        https://tech.ebu.ch/docs/tech/tech3285.pdf
  // Retrieved 30th April 2013
  var offset = 0;
  this.bext_Description = stripNull(chunk.toString('ascii',offset, offset+=256));
  this.bext_Originator = stripNull(chunk.toString('ascii', offset,offset+=32));
  this.bext_OriginatorReference = stripNull(chunk.toString('ascii',offset, offset+=32));
  this.bext_OriginationDate = stripNull(chunk.toString('ascii',offset,offset+=10));
  this.bext_OriginationTime = stripNull(chunk.toString('ascii',offset,offset+=8));
  this.bext_TimeReferenceLow = chunk['readUInt32' + this.endianness](offset)
  offset+=4;
  this.bext_TimeReferenceHigh = chunk['readUInt32' + this.endianness](offset)
  offset+=4;
  this.bext_Version = chunk['readUInt8'](offset++);
  this.bext_SMTPE_UMID = stripNull(chunk.toString('ascii',offset, offset+=64));
  this.bext_LoudnessValue = chunk['readUInt16' + this.endianness](offset);
  offset+=2;
  this.bext_LoudnessRange = chunk['readUInt16' + this.endianness](offset);
  offset+=2;
  this.bext_MaxTruePeakLevel = chunk['readUInt16' + this.endianness](offset);
  offset+=2;
  this.bext_MaxMomentaryLoudness = chunk['readUInt16' + this.endianness](offset);
  offset+=2;
  this.bext_MaxShortTermLoudness = chunk['readUInt16' + this.endianness](offset);
  offset+=2;
  this.bext_CodingHistory = stripNull(chunk.toString('ascii',offset, this.chunkSize)); 
  
  this.emit('bext', {
    Description : this.bext_Description,
    Originator : this.bext_Originator,
    OriginatorReference : this.bext_OriginatorReference,
    OriginationDate : this.bext_OriginationDate,
    OriginationTime : this.bext_OriginationTime,
    TimeReferenceLow : this.bext_TimeReferenceLow,
    TimeReferenceHigh : this.bext_TimeReferenceHigh,
    Version : this.bext_Version,
    SMTPE_UMID : this.bext_SMTPE_UMID,
    LoudnessValue : this.bext_LoudnessValue,
    LoudnessRange : this.bext_LoudnessRange,
    MaxTruePeakLevel : this.bext_MaxTruePeakLevel,
    MaxMomentaryLoudness : this.bext_MaxMomentaryLoudness,
    MaxShortTermLoudness : this.bext_MaxShortTermLoudness,
    CodingHistory : this.bext_CodingHistory
  });
  // carry on!
  this._bytes(4, this._onSubchunkID);
}

Reader.prototype._onSubchunkCartSize = function (chunk) {
  debug('onSubchunkCartSize:', chunk)
  this.subchunkCartSize = chunk['readUInt32'+ this.endianness](0)
  this._bytes(this.subchunkCartSize, this._onSubchunkCart)
}

Reader.prototype._onSubchunkCart = function (chunk) {
  // Reference:  AES standard for network and file transfer of audio, Audio-file transfer and exchange 
  // Radio traffic audio delivery extension to the broadcast-wave-file format
  // AES 46-2002
  // http://publications.aes.org/
          
  debug('onSubchunkCart:', chunk);
  debug('onSubchunkCart size:', this.subchunkCartSize);
  var offset = 0;
  
  this.cart_Version = chunk['readUInt32' + this.endianness](offset);
  offset += 4;
  this.cart_Title = stripNull(chunk.toString('ascii',offset,offset+=64));
  this.cart_Artist = stripNull(chunk.toString('ascii',offset,offset+=64));
  this.cart_CutID = stripNull(chunk.toString('ascii',offset,offset+=64));
  this.cart_ClientID = stripNull(chunk.toString('ascii',offset,offset+=64));
  this.cart_Category = stripNull(chunk.toString('ascii',offset,offset+=64));
  this.cart_Classification  = stripNull(chunk.toString('ascii',offset,offset+=64));
  this.cart_OutCue = stripNull(chunk.toString('ascii',offset,offset+=64));
  this.cart_StartDate = chunk.toString('ascii',offset,offset+=10);
  this.cart_StartTime = chunk.toString('ascii',offset,offset+=8);
  this.cart_EndDate = chunk.toString('ascii',offset,offset+=10);
  this.cart_EndTime = chunk.toString('ascii',offset,offset+=8);
  this.cart_ProducerAppID = stripNull(chunk.toString('ascii',offset,offset+=64));
  this.cart_ProducerAppVersion = stripNull(chunk.toString('ascii',offset,offset+=64));
  this.cart_UserDef = stripNull(chunk.toString('ascii',offset,offset+=64));
  this.cart_LevelReference = chunk['readUInt32' + this.endianness](offset, offset+=4);
  this.cart_timers = [];
  for (var i = 0; i < 8; i++)
  { // 8 "post" cart timers
    this.cart_timers.unshift({ 
      usage: stripNull(chunk.toString('ascii', offset, offset+=4)), 
      value : chunk['readUInt32' + this.endianness](offset, offset+=4)
    });
  }
  this.cart_reserved = chunk.toString('ascii',offset, offset+=276);
  this.cart_URL = chunk.toString('ascii', offset, offset+=1024);
  this.cart_tagtext = chunk.toString('ascii', offset, this.subchunkCartSize);

  this.emit('cart',{
    version: this.cart_Version,
    title: this.cart_Title ,
    artist: this.cart_Artist ,
    cut_id: this.cart_CutID ,
    client_id: this.cart_ClientID,
    category: this.cart_Category,
    classification: this.cart_Classification,
    outcue: this.cart_OutCue ,
    start_date: this.cart_StartDate,
    start_time: this.cart_StartTime,
    end_date: this.cart_EndDate,
    end_time: this.cart_EndTime ,
    producer_app_id: this.cart_ProducerAppID ,
    producer_app_version: this.cart_ProducerAppVersion ,
    userdef: this.cart_UserDef,
    level_reference: this.cart_LevelReference ,
    timers: this.cart_timers
  });
  // carry on!
  //this._bytes(4, this._onSubChunkID);
        this._bytes(4, this._onSubchunkID);
}



Reader.prototype._onSubchunkDataSize = function (chunk) {
  debug('onSubchunkDataSize:',chunk);
  this.subchunkDataSize =  chunk['readUInt32' + this.endianness](0);
  debug('onSubchunkDataSize:  ', this.subchunkDataSize);
  //this._bytes(this.subchunkDataSize, this._onSubchunkData);
  padded = this.subchunkDataSize % 2
  debug('onSubchunkDataSize: Going to pass through ' + (this.subchunkDataSize + padded) + ' bytes')
  this._passthrough( this.subchunkDataSize + padded, this._onSubchunkData );
}

Reader.prototype._onSubchunkData = function (chunk) {
  debug('onSubchunkData')
  // even though the WAV file reports a remaining byte length, in practice it
  // can't really be trusted since in streaming situations where the WAV file is
  // being generated on-the-fly, the number of remaining bytes would be impossible
  // to know beforehand. For this reason, some encoders write `0` for the byte
  // length here... In any case, we are just gonna pass through the rest of the
  // stream until EOF.
  // NOTE:   this does assume that there are no other chunks after the data chunk! 
  //     In practice, this might not be true!
  //
  // NOTE:       this is definitely not true for WAV files created by PSquared Myriad
  //
  this._bytes(4, this._onSubchunkID);
}
