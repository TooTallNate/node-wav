/* eslint-env mocha */

/**
 * Module dependencies.
 */

var fs = require('fs');
var path = require('path');
var assert = require('assert');
var Reader = require('../').Reader;

describe('Reader', function () {
  describe('RIFF - Little-endian', function () {
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

    describe('gameover.wav', function () {
      var fixture = path.resolve(__dirname, 'fixtures', 'gameover.wav');

      it('should emit a "format" event', function (done) {
        var reader = new Reader();
        reader.on('format', function (format) {
          // wave format
          assert.equal('RIFF', this.riffId);
          assert.equal(1, format.audioFormat);

          // pcm format
          assert.equal('LE', format.endianness);
          assert.equal(1, format.channels);
          assert.equal(22050, format.sampleRate);
          assert.equal(16, format.bitDepth);
          assert.equal(true, format.signed);
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

    describe('M1F1-float32-AFsp.wav', function () {
      var fixture = path.resolve(__dirname, 'fixtures', 'M1F1-float32-AFsp.wav');

      it('should emit a "format" event', function (done) {
        var reader = new Reader();
        reader.on('format', function (format) {
          assert.equal(3, format.audioFormat);
          assert.equal(2, format.channels);
          assert.equal(8000, format.sampleRate);
          assert.equal(32, format.bitDepth);
          assert.equal(true, format.signed);
          assert.equal(true, format.float);
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

    describe('M1F1-float64-AFsp.wav', function () {
      var fixture = path.resolve(__dirname, 'fixtures', 'M1F1-float64-AFsp.wav');

      it('should emit a "format" event', function (done) {
        var reader = new Reader();
        reader.on('format', function (format) {
          assert.equal(3, format.audioFormat);
          assert.equal(2, format.channels);
          assert.equal(8000, format.sampleRate);
          assert.equal(64, format.bitDepth);
          assert.equal(true, format.signed);
          assert.equal(true, format.float);
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
  describe('BWF - Broadcast Wave Extension', function () {
    describe('CC_0101.wav', function () {
    var fixture = path.resolve(__dirname, 'fixtures', 'CC_0101.wav');
    it('should emit a "bext" event', function (done) {
      var reader = new Reader();
      reader.on('bext', function (bext) {
        assert.equal('Dick Pierce', bext.Originator);
        assert.equal('CartChunk.org', bext.OriginatorReference);
        assert.equal('2001/09/13', bext.OriginationDate);
        assert.equal('07:50:05', bext.OriginationTime); // Dick gets up early :)
        assert.equal('CartChunk.org linear PCM sample file containing \'bext\' and \'cart\' chunks', 
          bext.Description);
        assert.equal(0,bext.TimeReferenceLow);
        assert.equal(0,bext.TimeReferenceHigh);
        done();
      });
      fs.createReadStream(fixture).pipe(reader).resume();
    });
    it('should emit a "cart" event', function (done) {
      var reader = new Reader();
      reader.on('cart', function (cart) {
        assert.equal('Cart Chunk: the traffic data file format for the Radio Industry', cart.title);
        assert.equal('Jay Rose, dplay.com', cart.artist);
        assert.equal('DEMO-0101', cart.cut_id);
        assert.equal('CartChunk.org', cart.client_id);
        assert.equal('DEMO', cart.category);
        assert.equal('1900/01/01', cart.start_date);
        assert.equal('00:00:00',cart.start_time);
        assert.equal('2099/12/31',cart.end_date);
        assert.equal('23:59:59',cart.end_time);
        assert.equal('AUDICY',cart.producer_app_id);
        assert.equal('3.10/623',cart.producer_app_version);
        assert.equal('Demo ID showing basic \'cart\' chunk attributes', cart.userdef);
        assert.equal(32768, cart.level_reference);
        assert.equal('the Radio Industry', cart.outcue);
        assert.equal('EOD',cart.timers[0].usage);
        assert.equal(201024, cart.timers[0].value);
        assert.equal('SEC1', cart.timers[6].usage);
        assert.equal(152533, cart.timers[6].value);
        assert.equal('MRK', cart.timers[7].usage);
        assert.equal(112000, cart.timers[7].value);
        done();
      });
      fs.createReadStream(fixture).pipe(reader).resume();
    });
  });

  });
  describe('RIFX - Big-endian', function () {
    describe('gameover-rifx.wav', function () {
      var fixture = path.resolve(__dirname, 'fixtures', 'gameover-rifx.wav');

      it('should emit a "format" event', function (done) {
        var reader = new Reader();
        reader.on('format', function (format) {
          // wave format
          assert.equal('RIFX', this.riffId);
          assert.equal(1, format.audioFormat);

          // pcm format
          assert.equal('BE', format.endianness);
          assert.equal(1, format.channels);
          assert.equal(22050, format.sampleRate);
          assert.equal(16, format.bitDepth);
          assert.equal(true, format.signed);
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
});
