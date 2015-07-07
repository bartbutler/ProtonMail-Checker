var bcrypt = new bCrypt();

$(document).ready(function() {
	if( loadval("smc_encrypted",0)==0 ) closeme();
	$("#decmasterpw").focus();
	centerdialog("#masterpopup");
	$("#dellog").click(function() {
		chrome.storage.sync.clear();
		localStorage.clear(); 
		chrome.browserAction.setPopup({popup:""});
		chrome.browserAction.setIcon({path:"/img/favicon_grey.png"});
		chrome.runtime.sendMessage({ msg: "lock" }, function() {
			closeme();
		});
	});
	$("#declogin").click(function() {
		var decpw = $("#decmasterpw").val();
		if( decpw.length == 0 ) return;
		
		$("#declogin").attr("disabled","disabled");
		checkhash(decpw, loadval("smc_encrypted_hash",false), function(result) {
			if(result) 
			{
				chrome.runtime.sendMessage({ msg: "submitsave", "encpw": decpw }, function() {
					chrome.browserAction.setPopup({popup:""});
					chrome.browserAction.setIcon({path:"/img/favicon_lock.png"});
					closeme();
				});
			}
			else
			{
				$("#declogin").removeAttr("disabled");
				$("#decmasterpw").val("").closest(".form-group").addClass("has-error");
			}
		});
	});
	$("#decmasterpw").keyup(function(event){
		if(event.keyCode == 13) $("#declogin").click();
	});
});

function loadval(key,def)
{
	var retval = localStorage.getItem(key);
	if( retval == undefined ) retval = def;
	return retval;
}

function centerdialog(div)
{
	$(".modal-dialog",div).css({"position":"absolute",
			"left":($(window).width()/2-$(".modal-dialog",div).width()/2)+"px",
			"top":($(window).height()/2-$(".modal-dialog",div).height()/2)+"px"});
}

function closeme()
{
	window.close();
}

function checkhash(pw, hash, func)
{
	if( hash.indexOf("$") == -1 ) //SHA-512
	{
		var result = getshahash(pw)==hash;
		return func(result);
	}
	//bCrypt
	if(!bcrypt.ready()) return setTimeout(function() { checkhash(pw,hash,func); }, 500); 
	try {
       	bcrypt.checkpw( pw, hash, function(result) {
			return func(result); 
		}, function() {});
    }catch(err){
		return alert(err);
    }
}

function getshahash(str)
{
	var shaObj = new jsSHA(str, "TEXT");
	var hash = shaObj.getHash("SHA-512", "HEX");
	return hash;
}