var fs = require('fs');
var bunyan = require('bunyan');
var bunyanDebugStream = require('bunyan-debug-stream');
var bunyanPretty = require('bunyan-pretty');
var PrettyStream = require('bunyan-prettystream');

var prettyStdOut = new PrettyStream();
prettyStdOut.pipe(process.stdout);

var RotatingFileStream = require('bunyan-rotating-file-stream')

var logDir = process.env.OPENSHIFT_LOG_DIR || process.env.VIADUCT_LOGS_DIR || 'logs'
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir);
}

var logger = bunyan.createLogger(
  {
    src: true,
    name: 'logger',
    streams: [
      {
        level: 'trace',
        stream: new RotatingFileStream({
          path: logDir + '/log_trace.txt',
          period: '30d',   // hourly rotation
          threshold: '20m',      // Rotate log files larger than 10 megabytes
          rotateExisting: true,  // Give ourselves a clean file when we start up, based on period
          totalSize: '40m',      // Don't keep more than 20mb of archived log files         }
          totalFiles: 2,
          gzip: true             // Compress the archive log files to save space
        }),
      },
      {
        level: 'trace',
        stream: prettyStdOut,
      },
      {
        level: 'debug',
        stream: new RotatingFileStream({
          path: logDir + '/log_debug.txt',
          period: '30d',   // daily rotation
          threshold: '20m',      // Rotate log files larger than 10 megabytes
          rotateExisting: true,  // Give ourselves a clean file when we start up, based on period
          totalSize: '40m',      // Don't keep more than 20mb of archived log files
          totalFiles: 2,
          gzip: true             // Compress the archive log files to save space
        })
      },
      {
        level: 'info',
        stream: new RotatingFileStream({
          path: logDir + '/log_info.txt',
          period: '30d',   // daily rotation
          threshold: '20m',      // Rotate log files larger than 10 megabytes
          rotateExisting: true,  // Give ourselves a clean file when we start up, based on period
          totalSize: '40m',      // Don't keep more than 20mb of archived log files
          totalFiles: 3,
          gzip: true             // Compress the archive log files to save space
        })
      },
      {
        level: 'warn',
        stream: new RotatingFileStream({
          level: 'warn',
          path: logDir + '/log_warn.txt',
          period: '30d',          // daily rotation
          threshold: '20m',      // Rotate log files larger than 10 megabytes
          rotateExisting: true,  // Give ourselves a clean file when we start up, based on period
          totalSize: '40m',      // Don't keep more than 20mb of archived log files
          totalFiles: 3,
          gzip: true             // Compress the archive log files to save space
        })
      },
      {
        level: 'error',
        stream: new RotatingFileStream({
          path: logDir + '/log_error.txt',
          period: '30d',          // daily rotation
          threshold: '20m',      // Rotate log files larger than 10 megabytes
          rotateExisting: true,  // Give ourselves a clean file when we start up, based on period
          totalSize: '40m',      // Don't keep more than 20mb of archived log files
          totalFiles: 3,
          gzip: true             // Compress the archive log files to save space
        })
      },
      {
        level: 'fatal',
        stream: new RotatingFileStream({
          path: logDir + '/log_fatal.txt',
          period: '30d',   // daily rotation
          threshold: '20m',      // Rotate log files larger than 10 megabytes
          rotateExisting: true,  // Give ourselves a clean file when we start up, based on period
          totalSize: '40m',      // Don't keep more than 20mb of archived log files
          totalFiles: 3,
          gzip: true             // Compress the archive log files to save space
        })
      },
    ],
    serializers: bunyanDebugStream.serializers,
  }
  );

module.exports = logger