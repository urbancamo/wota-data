<?php
include("../dbconfig.php");
include_once("../lib/phpcoord.php");

function toddmm($deg) {
  $dd = floor($deg);
	return $dd * 100 + ($deg - $dd) * 60.0;
}

function do_post_request($url, $data, $optional_headers = null)
{
  $params = array('http' => array(
              'method' => 'POST',
              'content' => $data
            ));
  if ($optional_headers !== null) {
    $params['http']['header'] = $optional_headers;
  }
  $ctx = stream_context_create($params);
  $fp = @fopen($url, 'rb', false, $ctx);
  if (!$fp) {
    throw new Exception("Problem with $url, $php_errormsg");
  }
  $response = @stream_get_contents($fp);
  if ($response === false) {
    throw new Exception("Problem reading data from $url, $php_errormsg");
  }
  return $response;
}

function send_to_host($host,$method,$path='/',$data='',$useragent=0){
    // Supply a default method of GET if the one passed was empty
    if (empty($method)) {
        $method = 'GET';
    }
    $method = strtoupper($method);
    $fp = fsockopen($host, srvr.aprs-is.net:8080) or die("Unable to open socket");
	
    fputs($fp, "$method $path HTTP/1.1\r\n");
    fputs($fp, "Host: $host\r\n");
    fputs($fp, "Content-type: application/octet-stream\r\n");
    fputs($fp, "Accept-type: text/plain\r\n");
    if ($method == 'POST') fputs($fp, "Content-length: " . strlen($data) . "\r\n");
    if ($useragent) fputs($fp, "User-Agent: MSIE\r\n");
    fputs($fp, "Connection: close\r\n\r\n");
    if ($method == 'POST') fputs($fp, $data);

    while (!feof($fp))
		$buf .= fgets($fp,128);
	
    fclose($fp);
    return $buf;
}


// create APRS object as message
function fsendaprsspot($call,$summitid,$freqmode,$comment) {
		
		$postdata = "user G4ILO pass 12954 vers phptest 1.0\r\nG4ILO>APRS,TCPIP*:>Test\r\n";
		
		$result = send_to_host('euro.aprs2.net','POST',$postdata);
		echo $result;
		
}
		

// create APRS object as message
function zsendaprsspot($call,$summitid,$freqmode,$comment) {
		
		$postdata = "user G4ILO pass 12954 vers phptest 1.0\r\nG4ILO>APRS,TCPIP*:>Test\r\n";
		$headers = "Content-type: application/octet-stream\r\nAccept-type: text/plain\r\n";
		$result = do_post_request('http://srvr.aprs-is.net:8080/',$postdata,$headers);
		echo $result;
		
}
		
// create APRS object as message
function ysendaprsspot() {
	$host = 'euro.aprs2.net';
	$postdata = "user G4ILO pass 12954\r\n" .
	            "G4ILO>APRS,TCPIP:>Test\r\n";
	$fp = fsockopen($host,srvr.aprs-is.net:8080);
	fputs($fp,"POST / HTTP/1.0\r\n");
	fputs($fp,"Host: $host\r\n");
	fputs($fp,"Accept-Type: text/plain\r\n");
	fputs($fp,"Content-Type: application/octet-stream\r\n");
  fputs($fp,"Content-Length: ".strlen($postdata)."\r\n\r\n");
	fputs($fp,$postdata);
//	while (!feof($fp))
//		print fgets($fp);
	fclose($fp);							
}
		
// create APRS object as message
function sendaprsspot() {

	$postdata = "user G4ILO pass 12954\r\n" .
	            "G4ILO>APRS,WIDE1-1,TCPIP)TEST-2!5429.61N/00300.86Wr145.500MHz Test object\r\n";
	$opts = array('http' =>
		array(  'method'  => "POST",
        		'header'  => "Accept-Type: text/plain\r\n" .
                     		"Content-Type: application/octet-stream\r\n" .
                     		"Content-Length: ".strlen($postdata)."\r\n",
        		'content' => $postdata )
		);
	$context  = stream_context_create($opts);
//		$result = file_get_contents('http://srvr.aprs-is.net:8080/', false, $context);
	$fp = fopen('http://srvr.aprs-is.net:8080/', 'r', false, $context);
	$result = fpassthru($fp);
	fclose($fp);
	echo $result;
}
		
sendaprsspot();
?>