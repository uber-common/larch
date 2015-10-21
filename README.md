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

# Contributors

* [Russ Frank](http://github.com/rf)
* [Mark Yen](http://github.com/markyen)

# License

MIT.
