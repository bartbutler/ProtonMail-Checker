var senddata = decodeURIComponent(window.location.search.substring(1)), mythread = "", endlocation = "";
if(senddata.indexOf("&")!=-1)
{
	var tempsplit = senddata.split("&");
	mythread = tempsplit[0];
	endlocation = tempsplit[1];
}

console.log("content script waiting");

$(window).load(function() {
	console.log("content script loaded");
	if(senddata == "redirected")
	{
		if(window.location.href.indexOf("/inbox/")!=-1)
		{
			var elem = '#header, a[aria-label=Back], #sidebar';
			waitforelement(elem, function() {
				$(elem).hide();
				$(".message-toolbar").css("border-top","1px solid #e6e6e6");
			}, function() {});
		}
		pagetweaks();
	}
	else if(mythread.length > 10) 
	{
		chrome.runtime.sendMessage({ msg: "init_frame", thread: mythread}, function(response) {
			console.log(response);
			document.getElementById("username").value = response.username;
			document.getElementById("password").value = response.password;
			document.getElementById("password").dispatchEvent(new Event('change'));
			
			setTimeout(function() {
				document.getElementById("login_btn").click();
				
				waitforelement('#unlock_btn', function() {
					document.getElementById("password").value = response.mailbox;
					setTimeout(function() {
						document.getElementById("password").dispatchEvent(new Event('change'));
						document.getElementById("unlock_btn").click();

						waitforelement('#pm_conversations', function() {
							if(endlocation!="inbox") window.location = "https://mail.protonmail.com/"+endlocation+"?redirected";
							pagetweaks();
							chrome.runtime.sendMessage({ msg: "fill_frame_success", thread: mythread, location: endlocation });
						}, function() { 
							chrome.runtime.sendMessage({ msg: "fill_frame_error", thread: mythread }); 
							window.close();
						});
						return;
					}, 1000);
				}, function() {
					chrome.runtime.sendMessage({ msg: "fill_frame_error", thread: mythread });
					window.close();
				}, function() {
					document.getElementById("password").dispatchEvent(new Event('change'));
					document.getElementById("login_btn").click();
				});
			}, 1000);
		});
	}
	else pagetweaks();
});

function pagetweaks()
{
	return console.log("page tweaks");
	$(document).on('click', 'div.col-xs-4[ng-click="reply(message)"]', function() {
		$("#messageHead").fadeOut();
		$("#composerFrame").detach().insertBefore("#message-content");
	});
}

function waitforelement(element,successfunc,timeoutfunc,elsefunc)
{
	var timeout = 0;
	var checktimer = setInterval(function() {
		if($(element).length)
		{
			clearInterval(checktimer);
			return successfunc();
		}
		else if(typeof elsefunc !== 'undefined') 
		{
			elsefunc();
		}
		timeout++;
		if(timeout > 10*10) //10 sekunden
		{
			clearInterval(checktimer);
			return timeoutfunc();
		}
	}, 100);
}