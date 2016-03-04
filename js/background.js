var checktimer, decpw = false, logoutcontext = false, loggedin = 0, privateKey, lastcheckstamp, frame_token = 0;
var atm_count = 0, clientID = "Other", clientSecret = "2d68e9ae4140ca5f288560c54ea1d2e0", isdebugging = false;

chrome.browserAction.setBadgeBackgroundColor({ color: [255, 0, 0, 255] });
chrome.browserAction.onClicked.addListener(function(activeTab){ oniconclick(); });
chrome.notifications.onClicked.addListener(function(notificationId, byUser) { popup_press(notificationId, 1); });
chrome.notifications.onButtonClicked.addListener(function(notificationId, buttonIndex) { popup_press(notificationId, buttonIndex); });
chrome.webRequest.onHeadersReceived.addListener(
  function (details) {
    for (var i = 0; i < details.responseHeaders.length; ++i) {
      if (details.responseHeaders[i].name.toLowerCase() == 'x-frame-options') {
        details.responseHeaders.splice(i, 1);
        return {
			responseHeaders: details.responseHeaders
        };
      }
    }
  }, { urls: ["https://mail.protonmail.com/*"] }, ["blocking", "responseHeaders"]
);

initscript();

//#################################

chrome.contextMenus.create({
    "title": "Check Mails",
	"contexts": ["browser_action"],
	"onclick" : function() {
		lastcheckstamp = 0;
		checkit();
	}
});
logoutcontext = chrome.contextMenus.create({ 
    "title": "Lock Account",
	"contexts": ["browser_action"],
	"onclick" : function() {
		decpw = false;
		clearInterval(checktimer);
		loggedin = 0;
		initscript();
	},
	"enabled" : false
});

function checkit()
{
	var container = opencontainer();
	if( !container.email.length || !container.mailbox.length ) return chrome.browserAction.setIcon({path:"/img/favicon_grey.png"});
	if(isdebugging) return console.log("not checking, debugging popup");
	
	$.ajaxSetup({
		beforeSend: function(xhr) {
			xhr.setRequestHeader('x-pm-apiversion', 1);
			xhr.setRequestHeader('x-pm-appversion', clientID);
			xhr.setRequestHeader('Content-Type', 'application/json;charset=utf-8');
		}
	});
	
	var senddata = { Username: container.email, Password: container.password, ResponseType: "token", ClientID: clientID, ClientSecret: clientSecret, GrantType: "password", RedirectURI: "https://protonmail.ch", State: randomString(15), Scope: "" };
	$.ajax({
		url: 'https://api.protonmail.ch/auth',
		method: 'POST',
		data: JSON.stringify(senddata),
		success: function(data3) {
			$.getScript("/js/openpgp.min.js", function() {
				privateKey = openpgp.key.readArmored(data3.EncPrivateKey).keys[0];
				var retdec = privateKey.decrypt(container.mailbox);
				if(retdec === false)
				{
					cancellogin();
					return console.log("Mailbox PW wrong!");
				}
				pgpMessage = openpgp.message.readArmored(data3.AccessToken);
				openpgp.decryptMessage(privateKey, pgpMessage).then(function(plaintext) {
					var access_token = plaintext;
					
					$.ajaxSetup({
						beforeSend: function(xhr) {
							xhr.setRequestHeader('x-pm-apiversion', 1);
							xhr.setRequestHeader('x-pm-appversion', clientID);
							xhr.setRequestHeader('Content-Type', 'application/json;charset=utf-8');
							xhr.setRequestHeader('Authorization', 'Bearer '+access_token);
							xhr.setRequestHeader('x-pm-uid', data3.Uid);
						}
					});
					
					$.ajax({
						url: 'https://api.protonmail.ch/messages?Location=0&Unread=1',
						method: 'GET',
						success: function(data4) {
							parseContent(data4);
						},
						error: function() {
							console.log("error2");
							cancellogin();
						}
					});
				}).catch(function(error) {
					console.log("Decryption Error: "+error);
					cancellogin();
				});
			});
		},
		error: function() {
			console.log("error1");
			cancellogin();
		}
	});
}

function cancellogin()
{
	loggedin = 0;
	chrome.browserAction.setBadgeText({text: 'ERR'});
	atm_count = 0;
	localStorage.setItem("smc_valid", 2);
	chrome.browserAction.setIcon({path:"img/favicon_red.png"});
}

function parseContent(data)
{
	var container = opencontainer();
	loggedin = 1;
	chrome.browserAction.setIcon({path:"img/favicon.png"});

	if( data.Total > 0 )
	{
		var body_text = "";
		$.each( data.Messages, function(key, value) {
			if(value.Time > lastcheckstamp && loadval("smc_popup",false))
			{
				get_message(value.ID, function(subject, plaintext) {
					var showtext = parse_message(plaintext, 250);
					chrome.notifications.create(
						value.ID ,{   
							type: 'basic', 
							title: subject,
							iconUrl: 'img/favicon_128.png', 
							message: showtext,
							buttons: [{title: 'Mark as Read'},{title: 'Open / Answer'}],
							isClickable: true
						},function(notificationId) {}
					);
				});
			}
		});
		chrome.browserAction.setBadgeText({text: ""+data.Total});
		atm_count = data.Total;
	}
	else 
	{
		chrome.browserAction.setBadgeText({text: ''});
		atm_count = 0;
	}
	localStorage.setItem("smc_valid", 1);
	lastcheckstamp = Math.round((new Date()).getTime() / 1000);
	
	return true;
}

function initscript(decpw2)
{
	if( islocked()===true )
	{
		if( typeof decpw2 == 'undefined' )
		{
			chrome.browserAction.setIcon({path:"img/favicon_lock.png"});
			chrome.browserAction.setPopup({popup:"html/unlock.html"});
			if(jQuery.isNumeric(logoutcontext)) chrome.contextMenus.update(logoutcontext, {"enabled":false});
			if(loadval("smc_startlogin",false)) window.open("html/unlock.html",'_blank');
			return;
		}
		decpw = decpw2;
		chrome.contextMenus.update(logoutcontext, {"enabled":true});
		set_proton_popup();
		chrome.browserAction.setIcon({path:"img/favicon_grey.png"});
	}
	else 
	{
		if(jQuery.isNumeric(logoutcontext)) chrome.contextMenus.update(logoutcontext, {"enabled":false});
		chrome.browserAction.setIcon({path:"img/favicon_grey.png"})
	}

	checktimer = setInterval(function() {
		checkit();
	}, parseInt(loadval("smc_interval",1))*60*1000);
	checkit();
}

function popup_press(notificationId, buttonIndex)
{
	if(atm_count>0) atm_count--;
	if(atm_count>0) chrome.browserAction.setBadgeText({text: ""+atm_count});
	else chrome.browserAction.setBadgeText({text: ''});

	chrome.notifications.clear(notificationId, function() {});
	if(buttonIndex==0) 
	{
		var senddata = {"IDs":[notificationId]};
		$.ajax({
			url: 'https://api.protonmail.ch/messages/read',
			method: 'PUT',
			data: JSON.stringify(senddata),
			success: function(data5) {
				//console.log("ajax success mark read");
			},
			error: function() {
				//console.log("ajax error message retrieval");
			}
		});
		return;
	}
	
	open_proton_frame("inbox/"+notificationId, 600, 500);
}

function get_message(id, func)
{
	$.ajax({
		url: 'https://api.protonmail.ch/messages/'+id,
		method: 'GET',
		success: function(data5) {
			pgpMessage = openpgp.message.readArmored(data5.Message.Body);
			openpgp.decryptMessage(privateKey, pgpMessage).then(function(plaintext) {
				func(data5.Message.Subject, plaintext, data5.Message);
			}).catch(function(error) {
				console.log("Decryption Error MSG: "+error);
				func(data5.Message.Subject, data5.Message.Body, data5.Message);
			});
		},
		error: function() {
			console.log("ajax error message retrieval");
		}
	});
}

function parse_message(plaintext, max_length)
{
	var placeholder = '%1337%';
	plaintext = plaintext.replace(/<br>/g,placeholder);
	var showtext = decodeEntities(plaintext);
	var boundary = '--------';
	if(showtext.indexOf(boundary)!=-1) showtext = showtext.substr(0, showtext.indexOf(boundary));
	showtext = showtext.replace(new RegExp(placeholder, 'g'), "\n");
	if(max_length != -1 && showtext.length > max_length) showtext = showtext.substr(0, max_length)+"...";
	return showtext.trim();
}

chrome.runtime.onMessage.addListener(
    function(request, sender, sendResponse) {
        if(request.msg == "masterauth_request")
		{
			sendResponse({ msg: "masterauth_answer", "auth": decpw, process: request.process });
		}
		else if(request.msg == "submitsave")
		{
			decpw = request.encpw;
			clearInterval(checktimer);
			initscript(decpw);
			sendResponse(true);
		}
		else if(request.msg == "lock")
		{
			decpw = false;
			atmsid = "";
			clearInterval(checktimer);
			initscript();
			sendResponse(true);
		}
		else if(request.msg == "show_message")
		{
			get_message(request.thread, function(subject, plaintext, obj) {
				var showtext = parse_message(plaintext, -1);
				chrome.runtime.sendMessage({ msg: "answer_message", thread: request.thread, "subject": subject, message: showtext, from_name: obj.SenderName, from_adress: obj.SenderAddress});
			});
			sendResponse(true);
		}
		else if(request.msg == "init_frame" ) //&& request.thread == gethash(frame_token) && frame_token != 0
		{
			var container = opencontainer();
			sendResponse({ msg: "fill_frame", thread: request.thread, username: container.email, password: container.password, mailbox: container.mailbox });
		}
		else if(request.msg == "fill_frame_success" && request.thread == gethash(frame_token) && frame_token != 0)
		{
			frame_token = 0;
			set_proton_popup();
			sendResponse(true);
		}
		else if(request.msg == "fill_frame_error")
		{
			frame_token = 0;
			cancellogin();
			sendResponse(true);
		}
    }
);

function popupwindow(url, title, w, h) {
	var left = (screen.width/2)-(w/2);
	var top = (screen.height/2)-(h/2);
	return window.open(url, title, 'toolbar=no, location=no, directories=no, status=no, menubar=no, scrollbars=no, resizable=no, copyhistory=no, width='+w+', height='+h+', top='+top+', left='+left);
} 

function islocked()
{
	return (loadval("smc_encrypted",0)==1);
}

function randomString(len, charSet) {
    charSet = charSet || 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    var randomString = '';
    for (var i = 0; i < len; i++) {
    	var randomPoz = Math.floor(Math.random() * charSet.length);
    	randomString += charSet.substring(randomPoz,randomPoz+1);
    }
    return randomString;
}

function oniconclick()
{
	if( islocked()===true && decpw == false ) return window.open("html/unlock.html",'_blank');
	if(loggedin || isdebugging) 
	{
		chrome.browserAction.setBadgeText({text: ''});
		atm_count = 0;
		open_proton_frame("inbox", 600, 500);
	}
	else window.open("html/options.html",'_blank');
}

function open_proton_frame(path, w, h) //markme
{
	frame_token = randomString(100);
	popupwindow("html/popup_browser.html?"+encodeURIComponent(gethash(frame_token)+"&"+path), '_blank', w, h); 
}

function set_proton_popup()
{
	frame_token = randomString(100);
	var path = "inbox";
	return chrome.browserAction.setPopup({popup:"html/popup_browser.html?"+encodeURIComponent(gethash(frame_token)+"&"+path)});
}

function opencontainer()
{
	var container = loadval("smc_account_container","{}");
	if(loadval("smc_encrypted",0)==1 && container.indexOf('"iv":') != -1) container = sjcl.decrypt(decpw,container);
	if(!container.length || container == "{}") container = {email:"",password:"",mailbox:""};
	else container = jQuery.parseJSON(container);
	return container;
}

function savecontainer(container)
{
	var container = JSON.stringify(array);
	if(loadval("smc_encrypted",0)==1) container = sjcl.encrypt(decpw,container);
	localStorage.setItem("smc_account_container", container);
}

function loadval(key,def)
{
	var retval = localStorage.getItem(key);
	if( retval == undefined ) retval = def;
	if(retval == "true") retval = true;
	else if(retval == "false") retval = false;
	return retval;
}

function gethash(str)
{
	var shaObj = new jsSHA("SHA-512", "TEXT");
	shaObj.update(str);
	var hash = shaObj.getHash("B64");
	return hash;
}

var decodeEntities = (function () {
        //create a new html document (doesn't execute script tags in child elements)
        var doc = document.implementation.createHTMLDocument("");
        var element = doc.createElement('div');

        function getText(str) {
            element.innerHTML = str;
            str = element.textContent;
            element.textContent = '';
            return str;
        }

        function decodeHTMLEntities(str) {
            if (str && typeof str === 'string') {
                var x = getText(str);
                while (str !== x) {
                    str = x;
                    x = getText(x);
                }
                return x;
            }
        }
        return decodeHTMLEntities;
    })();

function stringbetween(str, start, end)
{
	var startpos = str.indexOf(start)+start.length;
	var endpos = str.indexOf(end, startpos );
	return str.substring( startpos , endpos );
}