<?php
// send a packet to APRS
function sendaprs($user,$pass,$packet) {
	$host = 'euro.aprs2.net';
	$postdata = "user $user pass $pass\r\n" .
    	"$user>APRS:$packet\r\n";
	$fp = fsockopen($host,srvr.aprs-is.net:8080);
	fputs($fp,"POST / HTTP/1.0\r\n");
	fputs($fp,"Host: $host\r\n");
	fputs($fp,"Accept-Type: text/plain\r\n");
	fputs($fp,"Content-Type: application/octet-stream\r\n");
    fputs($fp,"Content-Length: ".strlen($postdata)."\r\n\r\n");
	fputs($fp,$postdata);
	fclose($fp);							
}

?>