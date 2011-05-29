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
      this.onConnected(this);
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
  slaveApplyResult: function (onResult, id) {
    var self = this;
    return {
      onResult: onResult,
      id: id,
      cancel: function () {
        delete self.waiting[id];
      },
      call: function (_ignored, event) {
        this.cancel();
        onResult.apply(null, event.data.args);
      }
    };
  },
  slaveApply: function (onResult, body/*, args... */) {
    if (!this.slaveFrame) {
      throw new Error("not initialized!");
    }

    var id = this.generateId();
    var msg = ["eval2", String(body), id].concat(Array.prototype.slice.call(arguments, 2));
    var waiter = this.slaveApplyResult(onResult, id);
    this.waiting[id] = waiter;
    this.slaveFrame.postMessage(msg, this.slaveOrigin);
  },
  slaveGetFunction: function (replyFn, url) {
    $.get(url, function (data) {
      replyFn(data);
    });
  },
  slaveGet: function (url, dataFn) {
    this.slaveApply(dataFn, this.slaveGetFunction, url);
  }
};
