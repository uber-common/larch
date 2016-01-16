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

function FanoutRequest() {
    this.self = null;
    this.onItem = null;
    this.onComplete = null;
    this._resultCollectors = null;
    this._resultCollectorLength = 0;

    this.cb = null;
    this.counter = null;
    this.results = null;
}

FanoutRequest.prototype.run =
function run(records, cb) {
    this.counter = records.length;
    this.cb = cb;

    if (this._resultCollectorLength < this.counter) {
        this.ensureResultCollectors();
    }

    for (var i = 0; i < records.length; i++) {
        var onItem = this.onItem;
        var onResult = this._resultCollectors[i].onResult;
        onItem(this, records[i], i, onResult);
    }
};

FanoutRequest.prototype.ensureResultCollectors =
function ensureResultCollectors() {
    var counter = this.counter;

    if (!this._resultCollectors) {
        this._resultCollectors = [];
    }

    var start = this._resultCollectors.length;
    for (var i = start; i < counter; i++) {
        this._resultCollectors[i] = new ResultObject(this, i);
    }
    this._resultCollectorLength = this._resultCollectors.length;
};

FanoutRequest.prototype.insertResult =
function insertResult(key, err, value) {
    this.results[key] = new Result(err, value);

    if (--this.counter === 0) {
        var onComplete = this.onComplete;
        onComplete(this, this.results, this.cb);
    }
};

FanoutRequest.freeList = [];
for (var i = 0; i < 1000; i++) {
    FanoutRequest.freeList.push(new FanoutRequest());
}

FanoutRequest.alloc = function alloc(ctx, onItem, onComplete) {
    var req;

    if (FanoutRequest.freeList.length === 0) {
        req = new FanoutRequest();
    } else {
        req = FanoutRequest.freeList.pop();
    }

    req.self = ctx;
    req.onItem = onItem;
    req.onComplete = onComplete;
    req.results = [];

    return req;
};

FanoutRequest.release = function release(req) {
    req.results = null;

    FanoutRequest.freeList.push(req);
};

module.exports = FanoutRequest;

function ResultObject(req, key) {
    this.req = req;
    this.key = key;

    this.onResult = null;
    this.allocClosure();
}

ResultObject.prototype.allocClosure =
function allocClosure() {
    var self = this;

    self.onResult = onResult;

    function onResult(err, result) {
        self.req.insertResult(self.key, err, result);
    }
};

function Result(err, value) {
    this.err = err;
    this.value = value;
}
