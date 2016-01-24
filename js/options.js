var masterpw = "", syncloadcount = 0, syncsetcount = 0;
var bcrypt = new bCrypt();

$(document).ready(function() {
	var options = {};
    options.rules = {
        activated: {
            wordTwoCharacterClasses: true,
            wordRepetitions: true
        }
    };
	options.ui = {
        showVerdictsInsideProgressBar: true
    };
    $('#inputMasterPassword').pwstrength(options);
	
	if( loadval("smc_encrypted",0)==1 )
	{
		$.getScript("/js/master_auth.js", function() {
			master_auth(function(decpw) {
				masterpw = decpw;
				var container = opencontainer();
				$("#inputEmail").val(container.email);
				$("#inputPassword").val(container.password);
				$("#mailboxInputPassword").val(container.mailbox);
				$("#usemasterpass").attr("checked",true);
				$("#inputMasterPassword").val(decpw).removeAttr("disabled");
				$("#inputMasterPassword").pwstrength("forceUpdate");

				if( loadval("smc_valid",0)==1 ) $("#inputEmail, #inputPassword, #mailboxInputPassword").closest(".form-group").addClass("has-success");
				else if( loadval("smc_valid",0)==2 ) $("#inputEmail, #inputPassword, #mailboxInputPassword").closest(".form-group").addClass("has-error");
			});
		});
	}
	else
	{
		var container = opencontainer();
		$("#inputEmail").val(container.email);
		$("#inputPassword").val(container.password);
		$("#mailboxInputPassword").val(container.mailbox);
		$("#startlogin").attr("disabled","disabled");
		
		if( loadval("smc_valid",0)==1 ) $("#inputEmail, #inputPassword, #mailboxInputPassword").closest(".form-group").addClass("has-success");
		else if( loadval("smc_valid",0)==2 ) $("#inputEmail, #inputPassword, #mailboxInputPassword").closest(".form-group").addClass("has-error");
	}
	
	$("#selectInterval").val(loadval("smc_interval"),"5");
	if(loadval("smc_popup",false)) $("#popupNotify").attr("checked","checked");
	if(loadval("smc_startlogin",false)) $("#startlogin").attr("checked","checked");
	
	$("#usemasterpass").click(function() {
		if($(this).is(":checked")) 
		{
			$("#inputMasterPassword, #startlogin").removeAttr("disabled");
		}
		else 
		{
			$("#inputMasterPassword").attr("disabled","disabled").val("").closest(".form-group").removeClass("has-error");
			$("#startlogin").removeAttr("checked").attr("disabled","disabled");
		}
		$("#inputMasterPassword").pwstrength("forceUpdate");
	});
	
	$("#flushbutton").click(function(e) { 
		e.preventDefault();
		if(confirm("Are you sure that you want to remove all data? This includes your login informations and your pgp keys!"))
		{
			chrome.storage.sync.clear();
			localStorage.clear(); 
			chrome.browserAction.setIcon({path:"/img/favicon_grey.png"});
			window.location=window.location;
		}
	});
	$("#syncbutton").click(function(e) {
		e.preventDefault();
		
		chrome.storage.sync.get("smc_sync_set", function (sync_container) {
			if(jQuery.isEmptyObject(sync_container)) return alert("No data synced yet. Save your settings to sync them.");
			if(!confirm("Are you sure you want to override all local data with the last saved settings ("+sync_container.smc_sync_set+")?")) return;

			syncloadcount = 0;
			chrome.storage.sync.get("smc_sync_container_settings", function (sync_container) {
				var decdata = jQuery.parseJSON(sync_container.smc_sync_container_settings);
				
				localStorage.setItem("smc_encrypted", decdata.encrypted);
				localStorage.setItem("smc_encrypted_hash",  decdata.hash );
				localStorage.setItem("smc_interval", decdata.interval );
				localStorage.setItem("smc_popup", decdata.popup );
				localStorage.setItem("smc_startlogin", decdata.startlogin );
				onsyncload();
			});
			chrome.storage.sync.get("smc_sync_container_account", function (sync_container) {
				localStorage.setItem("smc_account_container", sync_container.smc_sync_container_account);
				onsyncload();
			});
		});
	});
	$("#submitbutton").click(function(e) {
		e.preventDefault();
		
		var followdir = 1;
		
		var container = {email:$("#inputEmail").val(), password:$("#inputPassword").val(), mailbox:$("#mailboxInputPassword").val()};
		localStorage.setItem("smc_valid", false);
		localStorage.setItem("smc_interval", $("#selectInterval").val());
		localStorage.setItem("smc_popup", $("#popupNotify").is(":checked"));
		localStorage.setItem("smc_startlogin", $("#startlogin").is(":checked"));
		
		var d = new Date();
		syncsetcount = 0;
		
		if( $("#usemasterpass").is(":checked") )
		{
			var encpw = $("#inputMasterPassword").val();
			if(encpw.length == 0) return $("#inputMasterPassword").closest(".form-group").addClass("has-error");
			
			masterpw = encpw;
			localStorage.setItem("smc_encrypted", 1);
			
			var hashtype = 2; //immer bCrypt
			createhash( encpw, hashtype, function(encrypted_hash) {
				var settingscontainer = {"encrypted":loadval("smc_encrypted",false), "hash":loadval("smc_encrypted_hash",false), 
					"interval":loadval("smc_interval",1), "popup":loadval("smc_popup",false), "startlogin":loadval("smc_startlogin",false)};

				savecontainer(container);
				localStorage.setItem("smc_encrypted_hash", encrypted_hash );
				chrome.storage.sync.set({"smc_sync_container_settings": JSON.stringify(settingscontainer)}, function() { onsyncset(followdir); });
				chrome.storage.sync.set({"smc_sync_set": d.getDate()+"."+(d.getMonth()+1)+"."+d.getFullYear()}, function() { onsyncset(followdir); });
				chrome.storage.sync.set({"smc_sync_container_account": loadval("smc_account_container","{}")}, function() { onsyncset(followdir); });
				
				chrome.browserAction.setIcon({path:"/img/favicon_lock.png"});
				chrome.browserAction.setPopup({popup:"html/unlock.html"});
			});
		}
		else
		{
			localStorage.setItem("smc_encrypted", 0);
			localStorage.setItem("smc_encrypted_hash", false );
			chrome.browserAction.setIcon({path:"/img/favicon_grey.png"});
			savecontainer(container);
			closeme();
		}
	});
	
	window.addEventListener('message', function(e) {
		var eventName = e.data[0];
		var data = e.data[1];
		switch(eventName) {
			case 'setHeight':
			{
				$("#infoframe").css("height",data);
				break;
			}
		}
	}, false);
});

function onsyncload()
{
	syncloadcount++;
	if(syncloadcount>=2) window.location = window.location;
}

function onsyncset(followdir)
{
	syncsetcount++;
	if(syncsetcount>=3) 
	{
		if(followdir == 1) chrome.runtime.sendMessage({ msg: "submitsave", "encpw": masterpw }, function(data) { closeme(); });
		else chrome.runtime.sendMessage({ "msg":"lock" }, function(data) { closeme(); });
	}
}

function opencontainer()
{
	var container = loadval("smc_account_container","{}");
	if(loadval("smc_encrypted",0)==1 && container.indexOf('"iv":') != -1) container = sjcl.decrypt(masterpw,container);
	if(!container.length || container == "{}") container = {email:"",password:"",mailbox:""};
	else container = jQuery.parseJSON(container);
	return container;
}

function savecontainer(array)
{
	var container = JSON.stringify(array);
	if(loadval("smc_encrypted",0)==1) container = sjcl.encrypt(masterpw,container);
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

function closeme()
{
	console.log("close");
	window.close();
}

function createhash(str, algo, func)
{
	if(!str.length) return func("");
	if(algo == 1) return func(getshahash(str)); //SHA512
	if(algo == 2) //bCrypt
	{
		if(!bcrypt.ready()) return setTimeout(function() { createhash(str, algo, func); }, 500);
		
		var salt;
		try{
			salt = bcrypt.gensalt(10);
			bcrypt.hashpw( str, salt, function(result) {
				return func(result);
			}, function() {});
		}catch(err){
			return alert(err);
		}
	}
}

function getshahash(str)
{
	var shaObj = new jsSHA(str, "TEXT");
	var hash = shaObj.getHash("SHA-512", "HEX");
	return hash;
}