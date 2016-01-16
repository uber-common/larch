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

var console = require('console');
var process = global.process;
// var assert = require('assert');
var setImmediate = require('timers').setImmediate;

var MULTIPLE = 1;

var SYNC_ITERATIONS = 1000 * 1000 * 1;
// var ASYNC_ITERATIONS = 1000 * 1000;
// var SEQ_ITERATIONS = 1000 * 1000;
var LOOP_SIZE = 1000;
// var RECORDS = ['foo', 'bar', 'baz'];
var SANITY_COUNTER = 0;

function onTaskItem(req, item, index, cb) {
    process.nextTick(cb);
}

function onTaskDone(hreq, results, cb) {
    cb();
}

function testSyncCalls() {
    var counter = MULTIPLE * SYNC_ITERATIONS;

    var start = Date.now();
    nextLoop();

    function nextLoop() {
        if (counter <= 0) {
            return onComplete();
        }

        for (var i = 0; i < LOOP_SIZE; i++) {
            counter--;

            var task = new ParallelTask(null, onTaskItem, onTaskDone);
            task.results = [];
            task.onButts = onTaskItem;
            task.onButts2 = onTaskDone;
            // task.run(RECORDS, noop);
        }
        setImmediate(nextLoop);
    }

    function onComplete() {
        var end = Date.now();
        console.log('time taken %d %d', end - start, SANITY_COUNTER);
    }
}

function main() {
    testSyncCalls();
}

function ParallelTaskFunctionTable(onItem, onComplete) {
    this.onItem = onItem;
    this.onComplete = onComplete;
}

function ParallelTask(ctx, onItem, onComplete) {
    this.results = null;
    // this.results = [];
    this.self = ctx;
    this.fnTable = new ParallelTaskFunctionTable(onItem, onComplete);
    this.onButts = null;
    this.onButts2 = null;

    this.cb = null;
    this.counter = null;
}

if (require.main === module) {
    console.log('pid %d', process.pid);
    main();
}
