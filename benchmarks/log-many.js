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

/*eslint no-console: 0*/

var util = require('util');
var console = require('console');
// var heapdump = require('heapdump');
var process = global.process;
var assert = require('assert');
var setImmediate = require('timers').setImmediate;

var BaseBackend = require('../base-backend.js');

var MULTIPLE = 1;

var SYNC_ITERATIONS = 1000 * 1000;
var ASYNC_ITERATIONS = 1000 * 1000;
var SEQ_ITERATIONS = 1000 * 1000;
var LOOP_SIZE = 1000;
var RECORDS = ['foo', 'bar', 'baz'];
var SANITY_COUNTER = 0;

function PerfBackend() {
    BaseBackend.call(this);
}
util.inherits(PerfBackend, BaseBackend);

PerfBackend.prototype.log = function log(record, cb) {
    SANITY_COUNTER++;

    assert(cb, 'must have cb');
    process.nextTick(cb);
};

function testSyncCalls() {
    var backend = new PerfBackend();
    var counter = MULTIPLE * SYNC_ITERATIONS;

    var start = Date.now();
    nextLoop();

    function nextLoop() {
        if (counter <= 0) {
            return onComplete();
        }

        for (var i = 0; i < LOOP_SIZE; i++) {
            counter--;
            backend.logMany(RECORDS, noop);
        }
        setImmediate(nextLoop);
    }

    function onComplete() {
        var end = Date.now();
        console.log('time taken %d %d', end - start, SANITY_COUNTER);
        console.log('counters', {
            ALLOC_COUNTER: global.ALLOC_COUNTER,
            REUSE_COUNTER: global.REUSE_COUNTER
        });
    }
}

function testAsyncCalls() {
    /* Do not inline */
    var backend = new PerfBackend();
    var reqCounter = MULTIPLE * ASYNC_ITERATIONS;
    var resCounter = MULTIPLE * ASYNC_ITERATIONS;

    var start = Date.now();
    nextLoop();

    function nextLoop() {
        if (reqCounter <= 0) {
            return;
        }

        for (var i = 0; i < LOOP_SIZE; i++) {
            reqCounter--;
            backend.logMany(RECORDS, onComplete);
        }
        setImmediate(nextLoop);
    }

    function onComplete() {
        if (--resCounter === 0) {
            var end = Date.now();
            console.log('time taken %d %d', end - start, SANITY_COUNTER);
            console.log('counters', {
                ALLOC_COUNTER: global.ALLOC_COUNTER,
                REUSE_COUNTER: global.REUSE_COUNTER
            });
        }
    }
}

function testSequentialCalls() {
    var backend = new PerfBackend();
    var counter = (MULTIPLE * SEQ_ITERATIONS) + 1;

    var start = Date.now();

    nextIter();

    function nextIter() {
        if (--counter === 0) {
            return onComplete();
        } else if (counter % 1000 === 0) {
            backend.logMany(RECORDS, noop);
            return setImmediate(nextIter);
        }

        backend.logMany(RECORDS, nextIter);
    }

    function onComplete() {
        var end = Date.now();
        console.log('time taken %d %d', end - start, SANITY_COUNTER);
        console.log('counters', {
            ALLOC_COUNTER: global.ALLOC_COUNTER,
            REUSE_COUNTER: global.REUSE_COUNTER
        });
    }
}

function main(argv) {
    var test = argv[0];
    if (argv[1]) {
        MULTIPLE = parseInt(argv[1], 10);
    }

    console.log('running bench: %d', process.pid);

    // setTimeout(dumpHeap, 2500);

    if (test === 'sync-calls') {
        testSyncCalls();
    } else if (test === 'async-calls') {
        testAsyncCalls();
    } else if (test === 'seq-calls') {
        testSequentialCalls();
    } else {
        assert(false, 'test must be a known test');
    }
}

if (require.main === module) {
    main(process.argv.slice(2));
}

function noop() {}

// function dumpHeap() {
//     console.log('start dump');
//     heapdump.writeSnapshot();
//     console.log('fini dump');
// }
