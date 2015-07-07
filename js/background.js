var lastnotifamount = 0, checktimer, decpw = false, logoutcontext = false, loggedin = 0, useronpage = false;

chrome.browserAction.setBadgeBackgroundColor({ color: [255, 0, 0, 255] });
chrome.browserAction.onClicked.addListener(function(activeTab){ oniconclick(); });
chrome.notifications.onClicked.addListener(function(notificationId, byUser) { if(notificationId=="smc-mail-notifier") oniconclick(); });

initscript();

//#################################

chrome.contextMenus.create({
    "title": "Check Mails",
	"contexts": ["browser_action"],
	"onclick" : checkit
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
	if(useronpage)
	{
		useronpage = false;
		console.log("is paused, unblocking");
		return;
	}
	else console.log("not paused, running");
	var container = opencontainer();
	if( !container.email.length ) return chrome.browserAction.setIcon({path:"/img/favicon_grey.png"});
	
	$.get("https://protonmail.ch/login", function(data) {
		var container = opencontainer();
		if( !container.email.length || !container.password.length ) return chrome.browserAction.setIcon({path:"/img/favicon_grey.png"});
		
		var token = stringbetween(data, '<input type=\'hidden\' name=\'__csrf_magic\' value="', '"');
		$.post("https://protonmail.ch/login", {"__csrf_magic":token, "UserName":container.email, "Password":container.password, "submit_button":"", "hashed_pw":gethash(container.password)}, function(data) {
			if(data.indexOf('</i>Decrypt Mailbox</h1>')==-1) return cancellogin();
			
			var expire = (new Date().getTime()/1000) + 60;
			chrome.cookies.set({"url":"https://protonmail.ch/","domain":".protonmail.ch","path":"/","expirationDate": expire,"secure":true,"name":"protonmail_pw","value":"true"}, function (cookie){
				$.get("https://protonmail.ch/inbox", function(data) {
					parseContent(data);
				});
			});
		});
	});
}

function cancellogin()
{
	loggedin = 0;
	chrome.browserAction.setBadgeText({text: 'ERR'});
	localStorage.setItem("smc_valid", 2);
	chrome.browserAction.setIcon({path:"img/favicon_red.png"});
	$.get("https://protonmail.ch/sign-out");
}

function parseContent(data)
{
	loggedin = 1;
	chrome.browserAction.setIcon({path:"img/favicon.png"});
	var re = /<strong>(.*?)<\/strong>\s+<em class='number(?: hide)?'>(.+?)<\/em>\s+<\/a>/g;

	var inboxes = {}, totalcount = 0, body_text = "";;
    while(match = re.exec(data)) 
	{
		var value = parseInt(match[2]);
		totalcount+=value;
        inboxes[match[1]] = value;
		body_text = body_text+"\n"+value+" unread messages in "+match[1];
    }

	if( totalcount > 0 )
	{
		if( totalcount > lastnotifamount && loadval("smc_popup",false) )
		{
			var unreadnum = (totalcount-lastnotifamount);
			var popup_title = unreadnum>1 ? unreadnum+" new messages!" : "1 new message!";

			chrome.notifications.create(
				'smc-mail-notifier',{   
					type: 'basic', 
					iconUrl: 'img/favicon_128.png', 
					title: popup_title, 
					message: body_text,
					isClickable: true
				},function() {});
		}
		lastnotifamount = totalcount;
		chrome.browserAction.setBadgeText({text: ""+totalcount});
	}
	else chrome.browserAction.setBadgeText({text: ''});
	localStorage.setItem("smc_valid", 1);
	
	$.get("https://protonmail.ch/sign-out", function(data) {
		if(loadval("smc_erasecookies",false))
		{
			chrome.cookies.getAll({"domain":".protonmail.ch"}, function(cookies) {
				for(var i=0; i<cookies.length;i++) {
					chrome.cookies.remove({'url': "http" + (cookies[i].secure ? "s" : "") + "://" + cookies[i].domain + cookies[i].path, name: cookies[i].name});
				}
			});
		}
	});
	
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
		chrome.browserAction.setPopup({popup:""});
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

function islocked()
{
	return (loadval("smc_encrypted",0)==1);
}

function oniconclick()
{
	if( islocked()===true && decpw == false ) return window.open("html/unlock.html",'_blank');
	if(loggedin) 
	{
		chrome.browserAction.setBadgeText({text: ''});
		window.open("https://protonmail.ch/login",'_blank');
	}
	else window.open("html/options.html",'_blank');
}

function opencontainer()
{
	var container = loadval("smc_account_container","{}");
	if(loadval("smc_encrypted",0)==1 && container.indexOf('"iv":') != -1) container = sjcl.decrypt(decpw,container);
	if(!container.length || container == "{}") container = {email:"",password:""};
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

function stringbetween(str, start, end)
{
	var startpos = str.indexOf(start)+start.length;
	var endpos = str.indexOf(end, startpos );
	//console.log("startpos:"+startpos+"/endpos:"+endpos);
	return str.substring( startpos , endpos );
}

chrome.runtime.onMessage.addListener(
    function(request, sender, sendResponse) {
        if(request.msg == "masterauth_request")
		{
			chrome.runtime.sendMessage({ msg: "masterauth_answer", "auth": decpw, process: request.process });
			sendResponse(true);
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
		else if(request.msg == "pause")
		{
			useronpage = true;
			//console.log("pause request received");
		}
		else if(request.msg == "unpause")
		{
			useronpage = false;
			//console.log("unpause request");
		}
    }
);