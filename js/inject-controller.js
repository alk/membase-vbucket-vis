var InjectionController = {
  waiting: {},
  slaveFrame: undefined,
  slaveOrigin: undefined,
  init: function () {
    window.addEventListener("message", this.onMessage.bind(this), false);
  },
  generateId: (function () {
    var counter = 0;
    return function () {
      return "__gen_" + (counter++);
    }
  })(),
  onConnected: function () {},
  onMessage: function (event) {
    if (!this.slaveFrame && event.data == "initial") {
      console.log("got initial message!");
      this.slaveFrame = event.source;
      this.slaveOrigin = event.origin;
      this.onConnectedInternal(this);
      return;
    }

    if (this.slaveFrame !== event.source) {
      return;
    }

    var data = event.data;

    if (!('id' in data)) {
      console.log("got unknown type of message", event);
      return;
    }

    var response;
    if ((response = this.waiting[data.id])) {
      response.call(null, event);
      return;
    }

    console.log("unable to route message:", event);
  },
  onConnectedInternal: function () {
    var self = this;
    var res = self.slaveApply(function () {
      res.continuous = true;
      res.onResult = function () {
        // second call is fatal. Means, opener is dead (unloaded/closed)
        alert("opener is closed!. Nothing will work");
        window.close();
      }
      window.addEventListener("unload", function () {
        self.slaveFrame.postMessage(["cancel"], self.slaveOrigin);
      });
      self.onConnected();
    }, function (reply) {
      // disable logout timer
      LogoutTimer.onTimout = function () {}
      LogoutTimer.reset();
      reply(); // and signal we're ready
      window.addEventListener("unload", function () {reply()}, false);
    });
  },
  slaveApplyResult: function (onResult, id) {
    var self = this;
    return {
      onResult: onResult,
      id: id,
      cancel: function () {
        delete self.waiting[id];
      },
      call: function (_ignored, event) {
        this.onResult.apply(null, event.data.args);
        if (!this.continuous) {
          this.cancel();
        }
      }
    };
  },
  assertConnected: function () {
    if (!this.slaveFrame) {
      throw new Error("not initialized!");
    }
  },
  slaveApply: function (onResult, body/*, args... */) {
    this.assertConnected();

    var id = this.generateId();
    var msg = ["eval2", String(body), id].concat(Array.prototype.slice.call(arguments, 2));
    var waiter = this.slaveApplyResult(onResult, id);
    this.waiting[id] = waiter;
    this.slaveFrame.postMessage(msg, this.slaveOrigin);
    return waiter;
  },
  slaveGetFunction: function (replyFn, url) {
    $.get(url, function (data) {
      replyFn(data);
    });
  },
  slaveGet: function (url, dataFn) {
    this.slaveApply(dataFn, this.slaveGetFunction, url);
  },
  reloadPage: function () {
    var secret = String((new Date()).valueOf()) + "_" + String(Math.random());
    var c = InjectionController;

    c.slaveApply(armed, slaveBody, secret);

    function slaveBody(armed, secret) {
      function handler(event) {
        if (event.data != secret)
          return;
        window.removeEventListener("message", handler, false);
        setTimeout(function () {
          injectIntoMembase(frameURL, frame);
        }, 100);
      }
      window.addEventListener("message", handler, false)
      armed();
    }

    function armed() {
      window.addEventListener("unload", function () {
        c.slaveFrame.postMessage(secret, c.slaveOrigin);
      }, false);
      document.location.reload();
    }
  }
};
