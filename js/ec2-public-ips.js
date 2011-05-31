InjectionController.onConnected = reloadData;

InjectionController.init();

function reloadData() {
  InjectionController.slaveApply(onResult, function (reply) {
    // unfortunately due to bug in /diag/eval implementation we have to call eval from inside eval :(, thus extra escaping
    var code = 'S = "{json, [rpc:call(N, erlang, apply, [fun () -> {struct, [{nodeName, N}, {publicIP, list_to_binary(os:cmd(\\"curl -s http://169.254.169.254/latest/mata-data/public-ipv4\\"))}]} end, []]) || N <- [node() | nodes()]]}.",' +
      '{value, V, _} = eshell:eval(S,[]), V.';
    $.post("/diag/eval", code, function (data, status) {
      reply(data, status);
    }, "json");
  });

  function onResult(data, status) {
    console.log("data:", data);
    console.log("status:", status);

    var container = $('address-list');
    container.empty();
    if (status !== 'success') {
      alert('crap: ' + status);
      return;
    }

    var template = $('address-list-template').textContent;
    container.innerHTML = Mustache.to_html(template, {pairs: data});
  }
}
