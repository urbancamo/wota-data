include("dbconfig.php");
include_once("include/errstr.php");
// include_once("include/sendaprs.php");
include_once("lib/phpcoord.php");

function toaprsfmt($deg) {
  $r = '';
  if($deg < 0.0) {
    $deg = $deg * -1.0;
    $r = '00';
    $l = 6;
  } else {
    $l = 7;
  }
  $dd = floor($deg);
  $r .= substr($dd * 100 + ($deg - $dd) * 60.0,0,$l);
  return $r;
}

function toddmm($deg) {
  $r = '';
  if($deg < 0.0) {
    $deg = $deg * -1.0;
    $r = '00';
    $l = 6;
  } else {
    $l = 7;
  }
  $dd = floor($deg);
  $r .= substr($dd + ($deg - $dd) * 0.60,0,$l);
  return $r;
}

$self = $_SERVER['PHP_SELF']."?page=".$_REQUEST['page'];
global $gCms;
global $errcount;
$feu =& $gCms->modules['FrontEndUsers']['object'];
$wotaid = substr($gCms->variables['page_name'],-3,3);
$user = strtoupper($feu->LoggedInName());
$ismod = stripos($feu->GetMemberGroups($feu->LoggedInId()),"Moderators") !== false;
$errcount = 0;
if($_SERVER['REQUEST_METHOD'] == "POST") {
  if($_POST['action']=="add_link") {
    $desc = htmlentities(trim(mysql_real_escape_string($_POST['desc'])));
    $url = trim(mysql_real_escape_string($_POST['url']));
    $posted_by = strtoupper(trim(mysql_real_escape_string($_POST['posted_by'])));
    $tz = date_default_timezone_get();
    date_default_timezone_set('GMT');
    $timestamp = date('YmdHis');
    date_default_timezone_set($tz);
    $sql = "INSERT INTO `links` (`wotaid`, `description`, `url`, `posted_by`, `posted_date`) VALUES (".$wotaid.",'".$desc."','".$url."','".$posted_by."',".$timestamp.")";
    $result = mysql_query($sql,$con);
  }
  if($_POST['action']=="aprs_item") {
    $tocall = strtoupper(trim(mysql_real_escape_string($_POST['tocall'])));
    if(empty($tocall)) {
      $message = errstr("Call missing");
    } else {
      sendaprsitem($tocall,$wotaid,$con);
    }
  }
}
if($_GET['action']=="dellink") {
  $id = mysql_real_escape_string($_GET['linkid']);
  if(is_numeric($id)) {
    $sql = "DELETE FROM `links` WHERE `id` = ".$id;
    $result = mysql_query($sql,$con);
  }
}

$result = mysql_query("SELECT * FROM `summits` WHERE `wotaid` = '".$wotaid."'",$con);
$row = mysql_fetch_array($result, MYSQL_ASSOC);
  if(is_null($row['sotaid'])) {
    $sotaid = "n/a";
  } else {
    $sotaid = "G/LD-".substr($row['sotaid'],-3,3);
  }

$hump = mysql_fetch_array($result, MYSQL_ASSOC);
  if(is_null($row['humpid'])) {
    $humpid = "n/a";
  } else {
    $humpid = "G/HLD-".substr($row['humpid'],-3,3);
  }

switch($row['book']) {
  case "E":
    $book = "The Eastern Fells";
    $bkurl = "eastern_fells";
    break;
  case "FE":
    $book = "The Far Eastern Fells";
    $bkurl = "far-eastern_fells";
    break;
  case "C":
    $book = "The Central Fells";
    $bkurl = "central_fells";
    break;
  case "S":
    $book = "The Southern Fells";
    $bkurl = "southern_fells";
    break;
  case "N":
    $book = "The Northern Fells";
    $bkurl = "northern_fells";
    break;
  case "NW":
    $book = "The North Western Fells";
    $bkurl = "north-western_fells";
    break;
  case "W":
    $book = "The Western Fells";
    $bkurl = "western_fells";
    break;
  case "OF":
    $book = "The Outlying Fells";
    $bkurl = "outlying_fells";
    break;
}
$heightft = round($row['height'] * 3.2808);
$osref = getOSRefFromSixFigureReference($row['reference']);
$gridid= ($row['gridid']);
$latlng = $osref->toLatLng();
$lat = rtrim(number_format($latlng->lat, 6, '.', ''), '0');
$lng = rtrim(number_format($latlng->lng, 6, '.', ''), '0');
$mapSize = 0.0075;
$lngmin = $latlng->lng - $mapSize;
$lngmax = $latlng->lng + $mapSize;
$latmin = $latlng->lat - $mapSize;
$latmax = $latlng->lat + $mapSize;
?>
<table class="fell_details">
  <tbody>
    <tr>
      <td><b>WOTA ID:</b> LDW-<?=$wotaid?></td>
      <td><b>Height:</b> <?=$row['height']?> m (<?=$heightft?> ft)</td>
    </tr>
    <tr>
      <td><b>SOTA ID:</b> <?=$sotaid?></td>
      <td><b>Grid ref:</b> <?=$row['reference']?></td>
    </tr>
    <tr>
      <td><b>HuMP ID:</b> <?=$humpid?></td>
      <td><b>QTH Locator:</b> <?=$gridid?></td>
    </tr>
    <tr>
      <td><b>Book:</b> <a href="mm_<?=$bkurl?>"><?=$book?></a></td>
      <td><b>Lat:</b> <?=$lat?> <b>Long:</b> <?=$lng?></td>
    </tr>
  </tbody>
</table>

<div id="map"><div id="popup"></div></div>
<br/>
<small>
	<a href="https://www.openstreetmap.org/#map=16/<?=$latlng->lat?>/<?=$latlng->lng?>&amp;layers=C">View Larger Map</a>
</small>
<p>&nbsp;</p>

<script>

var screenRes = window.screen.availWidth;
var scaleFactorForHitTolerance=1/250;
var hitTol = parseFloat(screenRes*scaleFactorForHitTolerance);


var styleFunction = function(feature) {
  return new ol.style.Style({
        image: new ol.style.Icon(/** @type {module:ol/style/Icon~Options} */ ({
          color: feature.get("marker-color"),
          crossOrigin: 'anonymous',
          src: '/mapping/data/dot.png',
          scale: screenRes  / 4000.0
        }))
  });
}

var summits = new ol.layer.Vector({
	source: new ol.source.Vector({
	  url: '/mapping/data/summits.json',
	  format: new ol.format.GeoJSON()
	}),
	style: styleFunction
});


var openCycleMapLayer = new ol.layer.Tile({
	source: new ol.source.OSM({
	  attributions: [
		'All maps Â© <a href="https://www.opencyclemap.org/">OpenCycleMap</a>',
		ol.source.ATTRIBUTION
	  ],
	  url: 'https:{a-c}.tile.thunderforest.com/cycle/{z}/{x}/{y}.png?apikey=c08210aeeb8644feb553d1982c78ec9b'
	})
});

var openLandscapeMapLayer = new ol.layer.Tile({
	source: new ol.source.OSM({
	  attributions: [
		'All maps Â© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a>'
	  ],
	  url: 'https://{a-c}.tile.thunderforest.com/landscape/{z}/{x}/{y}.png?apikey=c08210aeeb8644feb553d1982c78ec9b'
	})
});

 var popupElement = document.getElementById('popup');
 var popupActive = false;

 var popup = new ol.Overlay({
	element: popupElement,
	positioning: 'bottom-center',
	stopEvent: false,
	offset: [0, 0]
 });

var map = new ol.Map({
  controls: ol.control.defaults().extend([
	new ol.control.FullScreen()
  ]),
  target: 'map',
  layers: [
    //new ol.layer.Tile({source: new ol.source.OSM()}),
    //openCycleMapLayer,
    openLandscapeMapLayer,
    summits
  ],
  view: new ol.View({
    center: ol.proj.fromLonLat([<?=$latlng->lng?>, <?=$latlng->lat?>]),
    zoom: 14
  })
});
 map.addOverlay(popup);

 //display popup on click
 map.on('click', function(evt) {
	var feature = map.forEachFeatureAtPixel(evt.pixel,
	  function(feature) {
		return feature;
	  }, {
        hitTolerance: hitTol
      });
	if (feature) {
	  var coordinates = feature.getGeometry().getCoordinates();
	  popup.setPosition(coordinates);
	  var wotaId = feature.get("wotaId");
	  var wotaPageRef = wotaId;

	  var wotaFields = wotaId.split('-');
	  var wotaSeries = wotaFields[0];
	  if (wotaSeries == "LDO") {
		  var wotaRefNumber = Number(wotaFields[1]);
	  	  wotaRefNumber = wotaRefNumber + 214;
	  	  wotaPageRef = wotaSeries + "-" + wotaRefNumber;
	  }

	  var tableHead = "<table><tbody>";
	  var body = "<tr><td style='color: " + feature.get("marker-color") + "'>" + feature.get('book') + "</td></tr>" +
	   "<tr><td><a href='http://wota.org.uk/MM_" + wotaPageRef + "' target='_blank' rel='noopener noreferrer'>" + feature.get('wotaId') + ": " + feature.get('title') + "</a></td></tr>" +
	   "<tr><td>Height: " + feature.get('height') + "m, Locator: " + feature.get('qthLocator') + "</td></tr>" +
	   "<tr><td>Grid: " + feature.get('gridRef') + "</td></tr>";
	   var sota = "";
	   if (feature.get('sotaId') != "") {
	   	   sota = "SOTA ID: <a href='https://summits.sota.org.uk/summit/" + feature.get('sotaId') + "' target='_blank' rel='noopener noreferrer'>" + feature.get('sotaId') + "</a>";
	   }
	   var hump = "";
	   if (feature.get('humpId') != "") {
	   	   hump = "Hump ID: <a href='http://hema.org.uk/fullSummit.jsp?summitKey=" + feature.get('hillBaggingId') + "' target='_blank' rel='noopener noreferrer'>" + feature.get('humpId') + "</a>";
	   }
	   var refs = "";
	   if (sota != "" || hump != "") {
	   	   refs = "<tr><td>";
	   	   if (sota != "") {
	   	   	   refs = refs + sota;
	   	   	   if (hump != "") {
	   	   	   	   refs = refs + ", ";
	   	   	   }
	   	   }
	   	   refs = refs + hump + "</td></tr>";
	   }
	   var tableFoot = "</tbody></table>";
	   var content = tableHead + body + refs + tableFoot;
	  if (popupActive) {
	  	  document.getElementsByClassName("popover-content")[0].innerHTML = content;
	  } else {
		  $(popupElement).popover({
			placement: 'top',
			html: true,
			content: content
		  });
		  $(popupElement).popover('show');
		  popupActive = true;
	  }
	} else {
	  $(popupElement).popover('destroy');
	  popupActive = false;
	}
 });


 //change mouse cursor when over marker
 map.on('pointermove', function(e) {
	if (e.dragging) {
	  $(popupElement).popover('destroy');
	  popupActive = false;
	  return;
	}
	var pixel = map.getEventPixel(e.originalEvent);
	var hit = map.hasFeatureAtPixel(pixel);
	//map.getTarget().style.cursor = hit ? 'pointer' : '';
 });

</script>

<h3>Previous activations</h3>
<table class="fell_details">
  <tbody>
<?
// show last activations (if any)
$result = mysql_query("SELECT DISTINCT(callused),date FROM `activator_log` WHERE `wotaid` = ".$wotaid." ORDER BY `date` DESC LIMIT 10",$con);
if ($result && mysql_num_rows($result) ) {
  $tz = new DateTimeZone('GMT');
  while($row = mysql_fetch_array($result, MYSQL_ASSOC)) {
    $dt = new DateTime($row['date'], $tz);
    echo "<tr><td>".$row['callused']."/P on ".$dt->format('D j M Y')."</td></tr>";
  }
} else {
  echo "<tr><td>No previous activations</td></tr>";
}
// show next activation (if any)
$result = mysql_query("SELECT * FROM `alerts` WHERE `wotaid` = '".$wotaid."' AND `datetime` >= CURRENT_DATE ORDER BY `datetime` ASC LIMIT 1",$con);
if (mysql_num_rows($result) ) {
  $row = mysql_fetch_array($result, MYSQL_ASSOC);
  $tz = new DateTimeZone('GMT');
  $dt = new DateTime($row['datetime'], $tz);
  echo "<tr><td><b>Next activation by:</b> ".$row['call']." on ".$dt->format('D j M Y \a\t H:i')."</td></tr>";
}
?>
  </tbody>
</table>
<h3>Links</h3>
<table class="fell_links">
  <tbody>
<?
$result = mysql_query("SELECT * FROM `links` WHERE `wotaid` = '".$wotaid."' ORDER BY `posted_date` DESC",$con);
if (mysql_num_rows($result) ) {
  while($row = mysql_fetch_array($result, MYSQL_ASSOC)) {
    echo "<tr>";
    $desc = $row['description'];
    $url = $row['url'];
    if(strpos($url,"wota.org.uk")>0) {
      echo "<td><a href=\"".$url."\">".$desc."</a></td>";
    } else {
      echo "<td width=\"76%\"><a href=\"".$url."\" target=\"_blank\">".$desc."</a><img style=\"padding-left:2px;\" alt=\"extlink\" title=\"External link - opens in new tab\" src=\"images/external.png\" width=\"10\" height=\"10\"/></td>";
    }
    if($ismod || $row['posted_by']==$user) {
      $linkdel = " <a class=\"delX\" title=\"Delete link\" href=\"".$self."&amp;action=dellink&amp;linkid=".$row['id']."\">X</a>";
    } else {
      $linkdel = "";
    }
    echo"<td class=\"rightalign\" width=\"24%\">Posted by ".$row['posted_by'].$linkdel."</td></tr>";
  }
} else {
  echo "<tr><td><b>No links</b></td></tr>";
}
?>
    <tr><td><ul><li><a href="mm_wainwrights/mm_addlink.html?wotaid=<?=$wotaid?>">Add a link</a></li></ul></td></tr>
  </tbody>
</table>
<h3>APRS</h3>
<table class="fell_links">
  <tbody>
    <tr><td>To send this summit as an APRS object to your APRS device</td></tr>
    <tr><td>send <b>?APRSO LDW-<?=$wotaid?></b> to <b>M0XSD</b> (Note: object name is case sensitive)</td></tr>
  </tbody>
</table>

<?