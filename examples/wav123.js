
var Reader = require('../').Reader;
var Speaker = require('speaker');

var reader = new Reader();

reader.on('format', function (format) {
  console.error('format:', format);
  //reader.pipe(process.stdout);
  var s = new Speaker(format);
  reader.pipe(s);
});

reader.on('error', function (err) {
  console.error('Reader error: %s', err);
});

process.stdin.pipe(reader);
