var append_data = window.location.search.substring(1), loaded = 0;

$(document).ready(function() {
	$("#loadframe").attr("src", 'https://protonmail.com/login?'+append_data);
});

chrome.runtime.onMessage.addListener(
    function(request, sender, sendResponse) {
		if(loaded) return;
		if(request.msg == "fill_frame_success")
		{
			var newdimensions = (request.location=="inbox") ? [500,400] : [500,600];
			$("body, #loadframe").css({"height":newdimensions[0]+"px","width":newdimensions[1]+"px","opacity":"1"});
			$("#loader").hide();
			window.resizeTo(newdimensions[1]+18,newdimensions[0]+42);
			loaded = 1;
		}
	}
);