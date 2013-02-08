
/**
 * Module dependencies.
 */

var fs = require('fs');
var path = require('path');
var assert = require('assert');
var Reader = require('../').Reader;

describe('Reader', function () {

  describe('1up.wav', function () {
    var fixture = path.resolve(__dirname, 'fixtures', '1up.wav');

    it('should emit a "format" event', function (done) {
      var reader = new Reader();
      reader.on('format', function (format) {
        assert.equal(1, format.audioFormat);
        assert.equal(1, format.channels);
        assert.equal(11025, format.sampleRate);
        assert.equal(8, format.bitDepth);
        assert.equal(false, format.signed);
        done();
      });
      fs.createReadStream(fixture).pipe(reader).resume();
    });

    it('should emit an "end" event', function (done) {
      var reader = new Reader();
      reader.on('end', done);
      fs.createReadStream(fixture).pipe(reader).resume();
    });

  });

});
