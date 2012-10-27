
/**
 * Pipe a WAVE file to stdin, or specify the 
 */

var fs = require('fs');
var wav = require('../');
var filename = process.argv[2];

var input;
var reader = new wav.Reader();

if (filename) {
  console.error('reading WAVE info from %j', filename);
  input = fs.createReadStream(filename);
} else {
  console.error('reading WAVE info from process.stdin');
  input = process.stdin;
}

reader.on('format', onFormat);

input.pipe(reader);

function onFormat (format) {
  console.error('FORMAT');
  console.error(format);
}
