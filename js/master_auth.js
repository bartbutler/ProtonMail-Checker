var masterpw = "";

function master_auth(func)
{
	if(masterpw.length) return func(masterpw);
	var identifier = randomString(200);
	
	chrome.runtime.sendMessage({ msg: "masterauth_request", process: identifier}, function(response) {
		if(response.auth == false) return window.close(); //needs auth first
		masterpw = response.auth;
		return func(masterpw);
	});
}

function randomString(len, charSet) 
{
    charSet = charSet || 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    var randomString = '';
    for (var i = 0; i < len; i++) {
    	var randomPoz = Math.floor(Math.random() * charSet.length);
    	randomString += charSet.substring(randomPoz,randomPoz+1);
    }
    return randomString;
}