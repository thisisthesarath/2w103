
var __b_release_mode = false;
var tag_hdr = document.getElementsByTagName('head')[0];
['SIPml.js', 'src/tinySIP/src/tsip_api.js'].forEach(function (file) {
    var tag_script = document.createElement('script');
    tag_script.setAttribute('type', 'text/javascript');
    tag_script.setAttribute('src', file + "?svn=252");
    tag_hdr.appendChild(tag_script);
});
