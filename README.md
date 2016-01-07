# Larch

It's a logging framework. Currently it's main use is to reservoir sample logs
and forward them to [Logtron](http://github.com/uber/logtron). In the long
term, it may replace Logtron. It can be used like this:

```javascript
var Logtron = require('logtron');

var ReservoirBackend = require('larch/reservoir-backend');
var LevelRouterBackend = require('larch/level-router-backend');
var DropBackend = require('larch/drop-backend');

var logtronLogger = Logtron({...});

var reservoir = ReservoirBackend({
    backend: LogtronBackend(logtronLogger),
    statsd: options.statsd
});

// debug logs sent to drop backend; rest of logs are reservoir sampled
// then sent to Logtron
var levelRouterBackend = LevelRouterBackend({
    backends: {
        debug: DropBackend(),
        default: reservoir
    }
});

var logger = LarchLogger({
    backends: [levelRouterBackend],
    statsd: options.statsd
});

logger.warn('warn string', {meta: 'object'});
```

## Using `willSample($level)`

The top level Larch object, as well as each backend, has a method `willSample`.
This method returns `true` if any backend after this backend in the object tree
is interested in taking a log with level `$level`. This can be used to avoid
allocating space for large meta objects, like so:

```javascript
if (larch.willSample('warn')) {
    larch.swarn('thing failed!', {
        count: this.count,
        length: this.length,
        largeArrayOfThings: this.bigArray,
        hugeAmountOfUsefulDebuggingInfo: this.stuff
    });
}
```

This way, we can do less work when we have a lot of logs because we don't have
to allocate the large meta object.

Regular log methods (`.log`, `.error`, etc) will first compute a sampling
decision. Log methods prefixed with an `s` (`.slog`, `.serror`, etc) will use
a previously computed sampling decision. Calling an `s` method without first
calling `.willSample($level)` will throw.

# Contributors

* [Russ Frank](http://github.com/rf)
* [Mark Yen](http://github.com/markyen)

# License

MIT.
