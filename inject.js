// javascript:(function(d,s1,h){s1=d.createElement('script');s1.setAttribute('src','http://lh-alt:9000/js/infect.js');alkInfectURL="http://lh-alt:9000/vbuckets-vis.html";h=d.querySelector('body');h.appendChild(s1);})(document);

//__f=function(prop,propV,v){v=document.createElement('script');v.setAttribute('src',src);return(v)}; document.createElement('script');_vis_s.setAttribute('src', 'http://lh-alt:9000/js/inject.js')document.scrdocument.querySelector("head").appendChild(

// javascript:(function(){readConvertLinksToFootnotes=false;readStyle='style-newspaper';readSize='size-medium';readMargin='margin-narrow';_readability_script=document.createElement('script');_readability_script.type='text/javascript';_readability_script.src='http://lab.arc90.com/experiments/readability/js/readability.js?x='+(Math.random());document.documentElement.appendChild(_readability_script);_readability_css=document.createElement('link');_readability_css.rel='stylesheet';_readability_css.href='http://lab.arc90.com/experiments/readability/css/readability.css';_readability_css.type='text/css';_readability_css.media='all';document.documentElement.appendChild(_readability_css);_readability_print_css=document.createElement('link');_readability_print_css.rel='stylesheet';_readability_print_css.href='http://lab.arc90.com/experiments/readability/css/readability-print.css';_readability_print_css.media='print';_readability_print_css.type='text/css';document.getElementsByTagName('head')[0].appendChild(_readability_print_css);})();

function alkDoInfect(frameURL) {
  window.alkInfectURL = null;
  window.addEventListener("message", recvMessage, false);
  var frameElement = document.createElement("iframe");
  frameElement.setAttribute("style", "position:absolute;left:0;top:0;width:100%;height:100%;background:white;");
  document.body.appendChild(frameElement);
  frameElement.setAttribute('src', frameURL);
  var frame = frameElement.contentWindow;
  var initialInterval = setInterval(function () {
    console.log("posting initial message");
    frame.postMessage("initial", frameURL);
  }, 200);

  var service = {
    "eval": function () {
      frame.postMessage(eval(arguments[0]), frameURL);
    },
    "eval2": function () {
      (function (f, args) {
        function postMsg(data) {
          frame.postMessage(data, frameURL);
        }
        f.apply(null, [postMsg].concat(Array.prototype.slice.call(args, 1)));
      })(eval("("+arguments[0]+")"), arguments);
    },
    "xhr": function (openArgs, sendArg, headers, responseHeaders) {
      var xhr = new XMLHttpRequest();
      xhr.onreadystatechange = function () {
        if (xhr.readyState != 4)
          return;
        var reply = [xhr.status,
                     xhr.text,
                     (responseHeaders || []).map(function (h) {
                       return xhr.getResponseHeader(h);
                     })];
        frame.postMessage(reply, frameURL);
      }
      xhr.open.apply(xhr, openArgs);
      for (var k in (headers || {})) {
        xhr.setRequestHeader(k, headers[k]);
      }
      xhr.send();
    }
  };

  function recvMessage(event) {
    if (event.source != frame)
      return;

    if (initialInterval !== undefined) {
      clearInterval(initialInterval);
      initialInterval = undefined;
    }

    var data = event.data;
    if (!(data instanceof Array)) {
      return;
    }
    console.log("obeying command from master: ", data);
    service[data[0]].apply(service, data.slice(1));
  }
}
if (window.alkInfectURL)
  alkDoInfect(alkInfectURL);
