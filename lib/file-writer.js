
/**
 * Module dependencies.
 */

var fs = require('fs');
var Writer = require('./writer.js');

/**
 * The `FileWriter` class.
 *
 * @param {String} path The file path to write the WAVE file to
 * @param {Object} opts Object contains options for the stream and format info
 * @api public
 */

class FileWriter extends Writer {
  constructor (path, opts) {
    super(opts);
    this.path = path;
    this.file = fs.createWriteStream(path, opts);
    this.pipe(this.file);
    this.on('header', this._onHeader);
  }

  /**
   * Writes the updated WAVE header to the beginning of the file.
   * Emits a "done" event when everything is all good.
   *
   * @api private
   */
  _onHeader(header) {
    var self = this;
    var fd;

    function onOpen(err, f) {
      if (err)
        return self.emit('error', err);
      fd = f;
      fs.write(fd, header, 0, header.length, 0, onWrite);
    }

    function onWrite(err, bytesWritten) {
      if (err)
        return self.emit('error', err);
      if (bytesWritten !== header.length) {
        return self.emit('error', new Error('problem writing "header" data'));
      }
      fs.close(fd, onClose);
    }

    function onClose(err) {
      if (err)
        return self.emit('error', err);
      self.emit('done');
    }

    fs.open(self.path, 'r+', onOpen);
  }
}


/**
 * Module exports.
 */

module.exports = FileWriter;