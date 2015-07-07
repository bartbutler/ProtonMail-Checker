setInterval(function() {
	gopause();
}, 5*1000);
gopause();

window.onunload = function() {
   chrome.runtime.sendMessage({ msg: "unpause" });
};

function gopause()
{
	chrome.runtime.sendMessage({ msg: "pause" });
}