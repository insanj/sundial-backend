'use strict';

// encrypt
var bcrypt = require('bcrypt');

function cryptPassword(password, callback) {
  bcrypt.genSalt(10, function(err, salt) {
    if (err) {
      return callback(err);
    }

    bcrypt.hash(password, salt, function(err, hash) {
      return callback(err, hash);
    });
  });
};

function comparePassword(plainPass, hashword, callback) {
  bcrypt.compare(plainPass, hashword, function(err, isPasswordMatch) {
    return err == null ? callback(null, isPasswordMatch) : callback(err);
  });
};

module.exports = {
  cryptPassword, comparePassword,
};
