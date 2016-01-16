// Copyright (c) 2015 Uber Technologies, Inc.
//
// Permission is hereby granted, free of charge, to any person obtaining a copy
// of this software and associated documentation files (the "Software"), to deal
// in the Software without restriction, including without limitation the rights
// to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
// copies of the Software, and to permit persons to whom the Software is
// furnished to do so, subject to the following conditions:
//
// The above copyright notice and this permission notice shall be included in
// all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
// IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
// FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
// AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
// LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
// OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
// THE SOFTWARE.

'use strict';

var util = require('util');
var assert = require('assert');
var LogtronEntry = require('logtron/entry');

var Errors = require('./errors');
var BaseBackend = require('./base-backend');

function LogtronBackend(logtron) {
    BaseBackend.call(this);

    this.logtron = logtron;
    assert(
        typeof this.logtron === 'object' &&
        typeof this.logtron.writeEntry === 'function',
        'LogtronBackend expected first argument to be Logtron instance'
    );
}

util.inherits(LogtronBackend, BaseBackend);

LogtronBackend.prototype.willSample = function willSample(level, msg) {
    return true;
};

LogtronBackend.prototype.destroy = function destroy(cb) {
    var self = this;

    self.logtron.close(cb);
};

LogtronBackend.prototype.slog =
LogtronBackend.prototype.log = function log(record, cb) {
    var self = this;

    var entry = new LogtronEntry(
        record.data.level,
        record.data.message,
        record.meta,
        self.logtron.path
    );

    self.logtron.writeEntry(entry, cb);
};

LogtronBackend.prototype.logMany = function logMany(records, cb) {
    var self = this;

    var i;
    var done = 0;
    var errors = [];

    for (i = 0; i < records.length; i++) {
        self.log(records[i], recordDone);
    }

    function recordDone(error) {
        done++;
        if (error) {
            errors.push(error);
        }

        if (done >= records.length) {
            return cb(Errors.errorArrayToError(
                errors,
                'larch.logtron-backend.log-many.many-errors'
            ));
        }
    }
};

module.exports = createLogtronBackend;

function createLogtronBackend(opts) {
    return new LogtronBackend(opts);
}
